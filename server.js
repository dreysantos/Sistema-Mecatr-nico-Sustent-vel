const express = require("express");
const path = require("path");
const os = require("os");
require("dotenv").config();

const app = express();
const PORTA_SITE = process.env.PORT || process.env.PORTA_SITE || 3000;
const PORTA_ARDUINO = process.env.PORTA_ARDUINO || "COM3";
const BAUD_RATE = Number(process.env.BAUD_RATE) || 9600;
const MODO_CLOUD = process.env.MODO_CLOUD === "true";
const SIMULACAO_AUTOMATICA = process.env.SIMULACAO_AUTOMATICA !== "false";
const CORS_ORIGEM = process.env.CORS_ORIGEM || "*";
const LIMITE_HISTORICO = Number(process.env.LIMITE_HISTORICO) || 60;

let ultimaLeituraReal = 0;
let reconexaoAgendada = false;
let portaSerial = null;

let dadosArduino = criarDadosBase(MODO_CLOUD ? "cloud" : "offline");
let historico = [];

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10kb" }));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CORS_ORIGEM);
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

const requisicoes = {};
const LIMITE_REQUISICOES = 120;
const JANELA_TEMPO = 60000;

app.use((req, res, next) => {
    const ip = req.ip;
    const agora = Date.now();

    requisicoes[ip] = (requisicoes[ip] || []).filter((tempo) => agora - tempo < JANELA_TEMPO);

    if (requisicoes[ip].length >= LIMITE_REQUISICOES) {
        return res.status(429).json({ erro: "Muitas requisicoes. Tente novamente em alguns segundos." });
    }

    requisicoes[ip].push(agora);
    next();
});

function criarDadosBase(conexao) {
    return {
        nivel: "AGUARDANDO",
        bomba: "AGUARDANDO",
        corrente: 0,
        tensaoBateria: 0,
        cargaBateria: 0,
        tensaoSolar: 0,
        alerta: "AGUARDANDO",
        conexao,
        simulado: false,
        ultimaAtualizacao: new Date().toLocaleTimeString("pt-BR")
    };
}

function limitarNumero(valor, minimo, maximo, padrao = 0) {
    const numero = Number(valor);
    if (!Number.isFinite(numero)) {
        return padrao;
    }
    return Math.min(maximo, Math.max(minimo, numero));
}

function normalizarTexto(valor, permitidos, padrao) {
    const texto = String(valor || "").trim().toUpperCase();
    return permitidos.includes(texto) ? texto : padrao;
}

function validarDadosArduino(dados) {
    if (!dados || typeof dados !== "object") {
        return null;
    }

    const tensaoBateria = limitarNumero(dados.tensaoBateria, 0, 30);
    const cargaBateria = limitarNumero(dados.cargaBateria, 0, 100);
    const corrente = limitarNumero(dados.corrente, 0, 30);
    const tensaoSolar = limitarNumero(dados.tensaoSolar, 0, 40);
    const alertaPadrao = tensaoBateria > 0 && tensaoBateria < 11.5 ? "BATERIA BAIXA" : "NORMAL";

    return {
        nivel: normalizarTexto(dados.nivel, ["BAIXO", "MEDIO", "CHEIO", "INDEFINIDO"], "INDEFINIDO"),
        bomba: normalizarTexto(dados.bomba, ["LIGADA", "DESLIGADA", "PAUSADA", "INDEFINIDO"], "INDEFINIDO"),
        corrente,
        tensaoBateria,
        cargaBateria,
        tensaoSolar,
        alerta: String(dados.alerta || alertaPadrao).trim().toUpperCase().substring(0, 80),
        conexao: "online",
        simulado: false,
        ultimaAtualizacao: new Date().toLocaleTimeString("pt-BR")
    };
}

function adicionarHistorico(dados) {
    historico.push({
        horario: dados.ultimaAtualizacao,
        nivel: dados.nivel,
        bomba: dados.bomba,
        corrente: dados.corrente,
        tensaoBateria: dados.tensaoBateria,
        cargaBateria: dados.cargaBateria,
        tensaoSolar: dados.tensaoSolar,
        alerta: dados.alerta,
        simulado: Boolean(dados.simulado)
    });

    if (historico.length > LIMITE_HISTORICO) {
        historico = historico.slice(-LIMITE_HISTORICO);
    }
}

function gerarDadosSimulados() {
    const segundos = Date.now() / 1000;
    const ciclo = Math.sin(segundos / 9);
    const bateria = limitarNumero(76 + ciclo * 18, 8, 100);
    const tensaoBateria = 10.8 + bateria * 0.055;
    const tensaoSolar = limitarNumero(15 + Math.sin(segundos / 6) * 4, 0, 22);
    const corrente = limitarNumero(1.8 + Math.abs(Math.sin(segundos / 4)) * 2.4, 0, 8);
    const nivel = bateria < 25 ? "BAIXO" : ciclo > 0.35 ? "CHEIO" : "MEDIO";
    const bomba = nivel === "BAIXO" && bateria > 25 ? "LIGADA" : "DESLIGADA";
    const alerta = bateria < 20 ? "BATERIA BAIXA" : corrente > 4 ? "CORRENTE ALTA" : "NORMAL";

    return {
        nivel,
        bomba,
        corrente: Number(corrente.toFixed(2)),
        tensaoBateria: Number(tensaoBateria.toFixed(1)),
        cargaBateria: Math.round(bateria),
        tensaoSolar: Number(tensaoSolar.toFixed(1)),
        alerta,
        conexao: MODO_CLOUD ? "cloud" : "simulado",
        simulado: true,
        ultimaAtualizacao: new Date().toLocaleTimeString("pt-BR")
    };
}

function obterDadosAtuais() {
    const semLeituraReal = Date.now() - ultimaLeituraReal > 5000;
    if (SIMULACAO_AUTOMATICA && (MODO_CLOUD || dadosArduino.conexao !== "online" || semLeituraReal)) {
        const simulado = gerarDadosSimulados();
        adicionarHistorico(simulado);
        return simulado;
    }

    return dadosArduino;
}

function conectarArduino() {
    if (MODO_CLOUD) {
        console.log("Modo cloud ativo: servidor online sem conexao serial com Arduino.");
        dadosArduino.conexao = "cloud";
        return;
    }

    try {
        const { SerialPort } = require("serialport");
        const { ReadlineParser } = require("@serialport/parser-readline");

        portaSerial = new SerialPort({
            path: PORTA_ARDUINO,
            baudRate: BAUD_RATE,
            autoOpen: false
        });

        const parser = portaSerial.pipe(new ReadlineParser({ delimiter: "\n" }));

        portaSerial.open((erro) => {
            if (erro) {
                console.error("Erro ao abrir porta serial:", erro.message);
                dadosArduino.conexao = "offline";
                agendarReconexao();
                return;
            }

            console.log("Arduino conectado na porta:", PORTA_ARDUINO);
            dadosArduino.conexao = "online";
            reconexaoAgendada = false;
        });

        parser.on("data", (linha) => {
            try {
                const dadosValidados = validarDadosArduino(JSON.parse(linha.trim()));
                if (!dadosValidados) {
                    throw new Error("Formato invalido");
                }

                dadosArduino = dadosValidados;
                ultimaLeituraReal = Date.now();
                adicionarHistorico(dadosArduino);
            } catch (erro) {
                console.warn("Linha JSON invalida:", linha.substring(0, 80));
            }
        });

        portaSerial.on("error", (erro) => {
            console.error("Erro na porta serial:", erro.message);
            dadosArduino.conexao = "offline";
            agendarReconexao();
        });

        portaSerial.on("close", () => {
            console.warn("Conexao com Arduino encerrada");
            dadosArduino.conexao = "offline";
            agendarReconexao();
        });
    } catch (erro) {
        console.error("Erro ao configurar Arduino:", erro.message);
        dadosArduino.conexao = "offline";
        agendarReconexao();
    }
}

function agendarReconexao() {
    if (reconexaoAgendada || MODO_CLOUD) {
        return;
    }

    reconexaoAgendada = true;
    console.log("Tentando reconectar em 5 segundos...");
    setTimeout(() => {
        reconexaoAgendada = false;
        conectarArduino();
    }, 5000);
}

app.get("/dados", (req, res) => {
    res.json(obterDadosAtuais());
});

app.get("/historico", (req, res) => {
    res.json(historico.slice(-LIMITE_HISTORICO));
});

app.get("/saude", (req, res) => {
    res.json({
        status: "online",
        arduino: dadosArduino.conexao,
        modoCloud: MODO_CLOUD,
        simulacaoAutomatica: SIMULACAO_AUTOMATICA,
        tempo: new Date().toLocaleTimeString("pt-BR")
    });
});

app.get("/diagnostico", (req, res) => {
    res.json({
        statusServidor: "online",
        modoCloud: MODO_CLOUD,
        simulacaoAutomatica: SIMULACAO_AUTOMATICA,
        portaArduino: MODO_CLOUD ? "desativada no modo cloud" : PORTA_ARDUINO,
        baudRate: BAUD_RATE,
        conexaoArduino: dadosArduino.conexao,
        ultimaAtualizacao: dadosArduino.ultimaAtualizacao,
        leiturasNoHistorico: historico.length,
        memoria: {
            rssMB: Number((process.memoryUsage().rss / 1024 / 1024).toFixed(1)),
            heapUsadoMB: Number((process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1))
        },
        uptimeSegundos: Math.round(process.uptime())
    });
});

app.use((req, res) => {
    res.status(404).json({ erro: "Rota nao encontrada" });
});

app.listen(PORTA_SITE, "0.0.0.0", () => {
    const interfaces = os.networkInterfaces();
    let ipLocal = "localhost";

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                ipLocal = iface.address;
                break;
            }
        }
    }

    console.log(`\nServidor rodando em http://${ipLocal}:${PORTA_SITE}`);
    console.log(`Acesse de outro dispositivo: http://${ipLocal}:${PORTA_SITE}`);
    console.log(`Diagnostico: http://${ipLocal}:${PORTA_SITE}/diagnostico`);
    conectarArduino();
});

process.on("SIGINT", () => {
    console.log("\nEncerrando servidor...");
    if (portaSerial) {
        portaSerial.close();
    }
    process.exit(0);
});
