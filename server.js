const express = require("express");
const path = require("path");
const os = require("os");
const fs = require("fs");
const https = require("https");
require("dotenv").config();

const app = express();
const PORTA_SITE = process.env.PORT || process.env.PORTA_SITE || 3000;
const PORTA_ARDUINO = process.env.PORTA_ARDUINO || "COM3";
const BAUD_RATE = Number(process.env.BAUD_RATE) || 9600;
const MODO_CLOUD = process.env.MODO_CLOUD === "true";
const SIMULACAO_AUTOMATICA = process.env.SIMULACAO_AUTOMATICA !== "false";
const CORS_ORIGEM = process.env.CORS_ORIGEM || "";
const LIMITE_HISTORICO = Number(process.env.LIMITE_HISTORICO) || 60;
const LIMITE_REQUISICOES = Number(process.env.LIMITE_REQUISICOES) || 120;
const JANELA_TEMPO = Number(process.env.JANELA_TEMPO_MS) || 60000;
const DIAGNOSTICO_TOKEN = process.env.DIAGNOSTICO_TOKEN || "";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const CORS_PERMITIDOS = CORS_ORIGEM.split(",").map((origem) => origem.trim()).filter(Boolean);
const BANCO_ATIVO = process.env.BANCO_ATIVO !== "false";
const BANCO_ARQUIVO = process.env.BANCO_ARQUIVO || path.join(__dirname, "data", "leituras.jsonl");
const SALVAR_SIMULADOS = process.env.SALVAR_SIMULADOS !== "false";
const INTERVALO_GRAVACAO_MS = Number(process.env.INTERVALO_GRAVACAO_MS) || 5000;
const URL_PUBLICA = (process.env.URL_PUBLICA || "").replace(/\/$/, "");
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_TABELA = process.env.SUPABASE_TABELA || "leituras";
const SUPABASE_ATIVO = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);

let ultimaLeituraReal = 0;
let ultimaGravacaoBanco = 0;
let reconexaoAgendada = false;
let portaSerial = null;
let filaBanco = Promise.resolve();

let dadosArduino = criarDadosBase(MODO_CLOUD ? "cloud" : "offline");
let historico = [];

app.disable("x-powered-by");

if (TRUST_PROXY) {
    app.set("trust proxy", 1);
}

app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Content-Security-Policy", [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data:",
        "connect-src 'self'",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'"
    ].join("; "));

    if (req.secure || req.headers["x-forwarded-proto"] === "https") {
        res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    next();
});

app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return res.status(405).json({ erro: "Metodo nao permitido" });
    }

    next();
});

app.use((req, res, next) => {
    const origem = req.headers.origin;
    const origemPermitida = !origem || CORS_PERMITIDOS.length === 0 || CORS_PERMITIDOS.includes(origem);

    if (!origemPermitida) {
        return res.status(403).json({ erro: "Origem nao permitida" });
    }

    if (origem && CORS_PERMITIDOS.includes(origem)) {
        res.header("Access-Control-Allow-Origin", origem);
        res.header("Vary", "Origin");
    }

    res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    next();
});

const requisicoes = {};

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

setInterval(() => {
    const agora = Date.now();
    Object.keys(requisicoes).forEach((ip) => {
        requisicoes[ip] = requisicoes[ip].filter((tempo) => agora - tempo < JANELA_TEMPO);
        if (requisicoes[ip].length === 0) {
            delete requisicoes[ip];
        }
    });
}, JANELA_TEMPO).unref();

app.use(express.json({ limit: "10kb", strict: true }));
app.use(express.static(path.join(__dirname, "public"), {
    dotfiles: "ignore",
    etag: true,
    fallthrough: true,
    index: "index.html",
    maxAge: MODO_CLOUD ? "1h" : 0,
    setHeaders: (res, arquivo) => {
        if (arquivo.endsWith(".html")) {
            res.setHeader("Cache-Control", "no-store");
        }
    }
}));

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

function obterIpLocal() {
    const interfaces = os.networkInterfaces();

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === "IPv4" && !iface.internal) {
                return iface.address;
            }
        }
    }

    return "localhost";
}

function hostEhLocal(host) {
    const nome = String(host || "").split(":")[0];
    return nome === "localhost" ||
        nome === "127.0.0.1" ||
        nome.startsWith("10.") ||
        nome.startsWith("192.168.") ||
        nome.startsWith("172.16.") ||
        nome.startsWith("172.17.") ||
        nome.startsWith("172.18.") ||
        nome.startsWith("172.19.") ||
        nome.startsWith("172.2") ||
        nome.startsWith("172.30.") ||
        nome.startsWith("172.31.");
}

function obterUrlPublica(req) {
    if (URL_PUBLICA) {
        return URL_PUBLICA;
    }

    const host = req.headers["x-forwarded-host"] || req.headers.host;
    if (!host || hostEhLocal(host)) {
        return "";
    }

    const protocolo = req.headers["x-forwarded-proto"] || (req.secure ? "https" : "http");
    return `${protocolo}://${host}`;
}

function criarRegistroLeitura(dados) {
    return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        dataISO: new Date().toISOString(),
        horario: dados.ultimaAtualizacao,
        nivel: dados.nivel,
        bomba: dados.bomba,
        corrente: dados.corrente,
        tensaoBateria: dados.tensaoBateria,
        cargaBateria: dados.cargaBateria,
        tensaoSolar: dados.tensaoSolar,
        alerta: dados.alerta,
        conexao: dados.conexao,
        simulado: Boolean(dados.simulado)
    };
}

function inicializarBanco() {
    if (!BANCO_ATIVO || SUPABASE_ATIVO) {
        return;
    }

    fs.mkdirSync(path.dirname(BANCO_ARQUIVO), { recursive: true });

    if (!fs.existsSync(BANCO_ARQUIVO)) {
        fs.writeFileSync(BANCO_ARQUIVO, "", "utf8");
    }

    historico = lerLeiturasSalvas(LIMITE_HISTORICO);
}

function registroParaSupabase(registro) {
    return {
        data_iso: registro.dataISO,
        horario: registro.horario,
        nivel: registro.nivel,
        bomba: registro.bomba,
        corrente: registro.corrente,
        tensao_bateria: registro.tensaoBateria,
        carga_bateria: registro.cargaBateria,
        tensao_solar: registro.tensaoSolar,
        alerta: registro.alerta,
        conexao: registro.conexao,
        simulado: registro.simulado
    };
}

function supabaseParaRegistro(registro) {
    return {
        id: String(registro.id || ""),
        dataISO: registro.data_iso || registro.created_at || "",
        horario: registro.horario || "",
        nivel: registro.nivel || "",
        bomba: registro.bomba || "",
        corrente: Number(registro.corrente) || 0,
        tensaoBateria: Number(registro.tensao_bateria) || 0,
        cargaBateria: Number(registro.carga_bateria) || 0,
        tensaoSolar: Number(registro.tensao_solar) || 0,
        alerta: registro.alerta || "",
        conexao: registro.conexao || "",
        simulado: Boolean(registro.simulado)
    };
}

function supabaseRequest(metodo, caminho, corpo = null, cabecalhosExtras = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${SUPABASE_URL}/rest/v1/${caminho}`);
        const payload = corpo ? JSON.stringify(corpo) : null;

        const req = https.request({
            method: metodo,
            hostname: url.hostname,
            path: `${url.pathname}${url.search}`,
            headers: {
                apikey: SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
                ...cabecalhosExtras
            }
        }, (res) => {
            let dados = "";

            res.on("data", (chunk) => {
                dados += chunk;
            });

            res.on("end", () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    return reject(new Error(`Supabase HTTP ${res.statusCode}: ${dados.substring(0, 200)}`));
                }

                if (!dados) {
                    return resolve({ dados: null, headers: res.headers });
                }

                try {
                    resolve({ dados: JSON.parse(dados), headers: res.headers });
                } catch (erro) {
                    reject(new Error("Resposta invalida do Supabase"));
                }
            });
        });

        req.on("error", reject);

        if (payload) {
            req.write(payload);
        }

        req.end();
    });
}

async function salvarLeituraSupabase(registro) {
    if (!SUPABASE_ATIVO) {
        return false;
    }

    await supabaseRequest("POST", SUPABASE_TABELA, registroParaSupabase(registro), {
        Prefer: "return=minimal"
    });
    return true;
}

async function lerLeiturasSupabase(limite = LIMITE_HISTORICO) {
    if (!SUPABASE_ATIVO) {
        return [];
    }

    const query = new URLSearchParams({
        select: "*",
        order: "data_iso.desc",
        limit: String(limite)
    });

    const resposta = await supabaseRequest("GET", `${SUPABASE_TABELA}?${query.toString()}`);
    return (resposta.dados || []).map(supabaseParaRegistro).reverse();
}

async function contarLeiturasSupabase() {
    if (!SUPABASE_ATIVO) {
        return 0;
    }

    const resposta = await supabaseRequest("GET", `${SUPABASE_TABELA}?select=id&limit=1`, null, {
        Prefer: "count=exact"
    });
    const contentRange = resposta.headers["content-range"] || "";
    const total = Number(contentRange.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
}

function lerLeiturasSalvas(limite = LIMITE_HISTORICO) {
    if (!BANCO_ATIVO || !fs.existsSync(BANCO_ARQUIVO)) {
        return [];
    }

    const linhas = fs.readFileSync(BANCO_ARQUIVO, "utf8").trim().split(/\r?\n/).filter(Boolean);
    return linhas.slice(-limite).map((linha) => {
        try {
            return JSON.parse(linha);
        } catch (erro) {
            return null;
        }
    }).filter(Boolean);
}

async function lerLeiturasBanco(limite = LIMITE_HISTORICO) {
    if (SUPABASE_ATIVO) {
        try {
            return await lerLeiturasSupabase(limite);
        } catch (erro) {
            console.error("Erro ao ler Supabase, usando fallback local:", erro.message);
            return lerLeiturasSalvas(limite);
        }
    }

    return lerLeiturasSalvas(limite);
}

function obterInicioPeriodo(periodo, inicio) {
    if (inicio) {
        const data = new Date(inicio);
        return Number.isNaN(data.getTime()) ? null : data;
    }

    const agora = new Date();
    if (periodo === "hoje") {
        return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    }
    if (periodo === "24h") {
        return new Date(Date.now() - 24 * 60 * 60 * 1000);
    }
    if (periodo === "7d") {
        return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }
    return null;
}

function filtrarLeituras(leituras, query) {
    const inicio = obterInicioPeriodo(query.periodo, query.inicio);
    const fim = query.fim ? new Date(query.fim) : null;

    return leituras.filter((leitura) => {
        const data = new Date(leitura.dataISO || leitura.created_at || 0);
        if (Number.isNaN(data.getTime())) {
            return true;
        }
        if (inicio && data < inicio) {
            return false;
        }
        if (fim && !Number.isNaN(fim.getTime()) && data > fim) {
            return false;
        }
        return true;
    });
}

function calcularRelatorio(leituras) {
    const total = leituras.length;
    const soma = (campo) => leituras.reduce((acc, item) => acc + (Number(item[campo]) || 0), 0);
    const max = (campo) => total ? Math.max(...leituras.map((item) => Number(item[campo]) || 0)) : 0;
    const min = (campo) => total ? Math.min(...leituras.map((item) => Number(item[campo]) || 0)) : 0;
    const alertas = leituras.filter((item) => item.alerta && item.alerta !== "NORMAL").length;
    const bombaLigada = leituras.filter((item) => item.bomba === "LIGADA").length;
    const ultima = leituras[leituras.length - 1] || null;

    return {
        total,
        mediaBateria: total ? Number((soma("cargaBateria") / total).toFixed(1)) : 0,
        mediaSolar: total ? Number((soma("tensaoSolar") / total).toFixed(1)) : 0,
        maiorCorrente: Number(max("corrente").toFixed(2)),
        menorBateria: Number(min("cargaBateria").toFixed(1)),
        menorSolar: Number(min("tensaoSolar").toFixed(1)),
        alertas,
        bombaLigada,
        ultima
    };
}

function selecionarAlertas(leituras) {
    return leituras.filter((leitura) => {
        return leitura.alerta && leitura.alerta !== "NORMAL" ||
            leitura.bomba === "LIGADA" ||
            Number(leitura.cargaBateria) < 25 ||
            Number(leitura.corrente) > 4 ||
            Number(leitura.tensaoSolar) < 10;
    });
}

function valorCSV(valor) {
    const texto = String(valor ?? "");
    return `"${texto.replaceAll('"', '""')}"`;
}

function gerarCSV(leituras) {
    const colunas = ["dataISO", "horario", "nivel", "bomba", "corrente", "tensaoBateria", "cargaBateria", "tensaoSolar", "alerta", "conexao", "simulado"];
    const linhas = leituras.map((leitura) => colunas.map((coluna) => valorCSV(leitura[coluna])).join(","));
    return [colunas.join(","), ...linhas].join("\n");
}

function contarLeiturasSalvas() {
    if (!BANCO_ATIVO || !fs.existsSync(BANCO_ARQUIVO)) {
        return 0;
    }

    const conteudo = fs.readFileSync(BANCO_ARQUIVO, "utf8").trim();
    return conteudo ? conteudo.split(/\r?\n/).length : 0;
}

function salvarLeituraBanco(registro) {
    if (!BANCO_ATIVO || (!SALVAR_SIMULADOS && registro.simulado)) {
        return;
    }

    const agora = Date.now();
    if (registro.simulado && agora - ultimaGravacaoBanco < INTERVALO_GRAVACAO_MS) {
        return;
    }

    ultimaGravacaoBanco = agora;
    filaBanco = filaBanco
        .then(async () => {
            if (SUPABASE_ATIVO) {
                await salvarLeituraSupabase(registro);
                return;
            }

            await fs.promises.appendFile(BANCO_ARQUIVO, `${JSON.stringify(registro)}\n`, "utf8");
        })
        .catch((erro) => {
            console.error("Erro ao salvar leitura no banco:", erro.message);

            if (SUPABASE_ATIVO) {
                fs.mkdirSync(path.dirname(BANCO_ARQUIVO), { recursive: true });
                return fs.promises.appendFile(BANCO_ARQUIVO, `${JSON.stringify(registro)}\n`, "utf8")
                    .catch((erroLocal) => console.error("Erro no fallback local:", erroLocal.message));
            }
        });
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
    const registro = criarRegistroLeitura(dados);
    historico.push(registro);

    if (historico.length > LIMITE_HISTORICO) {
        historico = historico.slice(-LIMITE_HISTORICO);
    }

    salvarLeituraBanco(registro);
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
                if (linha.length > 1000) {
                    throw new Error("Linha muito longa");
                }

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
    res.setHeader("Cache-Control", "no-store");
    res.json(obterDadosAtuais());
});

app.get("/historico", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(historico.slice(-LIMITE_HISTORICO));
});

app.get("/leituras", async (req, res) => {
    if (!diagnosticoAutorizado(req)) {
        return res.status(401).json({ erro: "Leituras protegidas" });
    }

    const limite = limitarNumero(req.query.limite, 1, 1000, LIMITE_HISTORICO);
    res.setHeader("Cache-Control", "no-store");

    try {
        const leituras = await lerLeiturasBanco(limite);
        res.json(filtrarLeituras(leituras, req.query));
    } catch (erro) {
        console.error("Erro ao consultar leituras:", erro.message);
        res.status(500).json({ erro: "Nao foi possivel consultar as leituras." });
    }
});

app.get("/relatorio", async (req, res) => {
    if (!diagnosticoAutorizado(req)) {
        return res.status(401).json({ erro: "Relatorio protegido" });
    }

    try {
        const leituras = filtrarLeituras(await lerLeiturasBanco(1000), req.query);
        res.setHeader("Cache-Control", "no-store");
        res.json(calcularRelatorio(leituras));
    } catch (erro) {
        console.error("Erro ao gerar relatorio:", erro.message);
        res.status(500).json({ erro: "Nao foi possivel gerar o relatorio." });
    }
});

app.get("/alertas", async (req, res) => {
    if (!diagnosticoAutorizado(req)) {
        return res.status(401).json({ erro: "Alertas protegidos" });
    }

    try {
        const leituras = filtrarLeituras(await lerLeiturasBanco(1000), req.query);
        res.setHeader("Cache-Control", "no-store");
        res.json(selecionarAlertas(leituras).slice(-200));
    } catch (erro) {
        console.error("Erro ao consultar alertas:", erro.message);
        res.status(500).json({ erro: "Nao foi possivel consultar alertas." });
    }
});

app.get("/exportar.csv", async (req, res) => {
    if (!diagnosticoAutorizado(req)) {
        return res.status(401).type("text/plain").send("Exportacao protegida");
    }

    try {
        const leituras = filtrarLeituras(await lerLeiturasBanco(1000), req.query);
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", "attachment; filename=\"leituras.csv\"");
        res.send(gerarCSV(leituras));
    } catch (erro) {
        console.error("Erro ao exportar CSV:", erro.message);
        res.status(500).type("text/plain").send("Nao foi possivel exportar CSV.");
    }
});

app.get("/saude", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({
        status: "online",
        arduino: dadosArduino.conexao,
        modoCloud: MODO_CLOUD,
        simulacaoAutomatica: SIMULACAO_AUTOMATICA,
        bancoAtivo: BANCO_ATIVO,
        bancoTipo: SUPABASE_ATIVO ? "supabase" : "local",
        salvarSimulados: SALVAR_SIMULADOS,
        tempo: new Date().toLocaleTimeString("pt-BR")
    });
});

app.get("/rede", (req, res) => {
    const ipLocal = obterIpLocal();
    const baseLocal = `http://localhost:${PORTA_SITE}`;
    const baseRede = `http://${ipLocal}:${PORTA_SITE}`;
    const urlPublica = obterUrlPublica(req);

    res.setHeader("Cache-Control", "no-store");
    res.json({
        ipLocal,
        porta: PORTA_SITE,
        mesmoDispositivo: baseLocal,
        celular: baseRede,
        leiturasCelular: `${baseRede}/leituras.html`,
        painelCelular: `${baseRede}/painel.html`,
        urlPublica,
        leiturasPublicas: urlPublica ? `${urlPublica}/leituras.html` : "",
        painelPublico: urlPublica ? `${urlPublica}/painel.html` : ""
    });
});

function diagnosticoAutorizado(req) {
    if (!DIAGNOSTICO_TOKEN) {
        return true;
    }

    return req.headers["x-diagnostico-token"] === DIAGNOSTICO_TOKEN || req.query.token === DIAGNOSTICO_TOKEN;
}

app.get("/diagnostico", async (req, res) => {
    if (!diagnosticoAutorizado(req)) {
        return res.status(401).json({ erro: "Diagnostico protegido" });
    }

    let leiturasSalvas = 0;
    try {
        leiturasSalvas = SUPABASE_ATIVO ? await contarLeiturasSupabase() : contarLeiturasSalvas();
    } catch (erro) {
        console.error("Erro ao contar leituras:", erro.message);
        leiturasSalvas = contarLeiturasSalvas();
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
        statusServidor: "online",
        modoCloud: MODO_CLOUD,
        simulacaoAutomatica: SIMULACAO_AUTOMATICA,
        portaArduino: MODO_CLOUD ? "desativada no modo cloud" : PORTA_ARDUINO,
        baudRate: BAUD_RATE,
        conexaoArduino: dadosArduino.conexao,
        ultimaAtualizacao: dadosArduino.ultimaAtualizacao,
        leiturasNoHistorico: historico.length,
        banco: {
            ativo: BANCO_ATIVO,
            tipo: SUPABASE_ATIVO ? "supabase" : "local",
            tabela: SUPABASE_ATIVO ? SUPABASE_TABELA : "",
            arquivo: BANCO_ATIVO && !SUPABASE_ATIVO ? BANCO_ARQUIVO : "desativado",
            salvarSimulados: SALVAR_SIMULADOS,
            intervaloGravacaoMs: INTERVALO_GRAVACAO_MS,
            leiturasSalvas
        },
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
    const ipLocal = obterIpLocal();

    inicializarBanco();
    console.log(`\nServidor rodando em http://${ipLocal}:${PORTA_SITE}`);
    console.log(`Acesse de outro dispositivo: http://${ipLocal}:${PORTA_SITE}`);
    console.log(`Leituras no celular: http://${ipLocal}:${PORTA_SITE}/leituras.html`);
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
