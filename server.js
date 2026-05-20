const express = require("express");
const path = require("path");
require("dotenv").config();

const app = express();
const PORTA_SITE = process.env.PORT || process.env.PORTA_SITE || 3000;
const PORTA_ARDUINO = process.env.PORTA_ARDUINO || "COM3";
const BAUD_RATE = Number(process.env.BAUD_RATE) || 9600;
const MODO_CLOUD = process.env.MODO_CLOUD === "true";

let dadosArduino = {
    nivel: "AGUARDANDO",
    bomba: "AGUARDANDO",
    corrente: 0,
    tensaoBateria: 0,
    cargaBateria: 0,
    tensaoSolar: 0,
    alerta: "AGUARDANDO",
    conexao: MODO_CLOUD ? "cloud" : "offline",
    ultimaAtualizacao: new Date().toLocaleTimeString("pt-BR")
};

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json({ limit: "10kb" }));

// CORS - permitir conexões remotas (rede local)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*"); // Rede local
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// Rate Limiting simples
const requisicoes = {};
const LIMITE_REQUISICOES = 120;
const JANELA_TEMPO = 60000; // 1 minuto

app.use((req, res, next) => {
    const ip = req.ip;
    const agora = Date.now();

    if (!requisicoes[ip]) {
        requisicoes[ip] = [];
    }

    // Limpar requisições antigas
    requisicoes[ip] = requisicoes[ip].filter(t => agora - t < JANELA_TEMPO);

    if (requisicoes[ip].length >= LIMITE_REQUISICOES) {
        return res.status(429).json({ erro: "Muitas requisições. Tente novamente em alguns segundos." });
    }

    requisicoes[ip].push(agora);
    next();
});

// Conectar Arduino
let portaSerial = null;

function conectarArduino() {
    if (MODO_CLOUD) {
        console.log("☁️  Modo cloud ativo: servidor online sem conexão serial com Arduino.");
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

        const parser = portaSerial.pipe(
            new ReadlineParser({ delimiter: "\n" })
        );

        portaSerial.open((erro) => {
            if (erro) {
                console.error("❌ Erro ao abrir porta serial:", erro.message);
                dadosArduino.conexao = "offline";
                agendarReconexao();
            } else {
                console.log("✅ Arduino conectado na porta:", PORTA_ARDUINO);
                dadosArduino.conexao = "online";
            }
        });

        parser.on("data", (linha) => {
            try {
                const dados = JSON.parse(linha.trim());

                // Validar dados
                if (dados && typeof dados === "object") {
                    dadosArduino = {
                        ...dados,
                        conexao: "online",
                        ultimaAtualizacao: new Date().toLocaleTimeString("pt-BR")
                    };
                }
            } catch (erro) {
                console.warn("⚠️  Linha JSON inválida:", linha.substring(0, 50));
            }
        });

        portaSerial.on("error", (erro) => {
            console.error("🔴 Erro na porta serial:", erro.message);
            dadosArduino.conexao = "offline";
            agendarReconexao();
        });

        portaSerial.on("close", () => {
            console.warn("⚠️  Conexão com Arduino encerrada");
            dadosArduino.conexao = "offline";
            agendarReconexao();
        });

    } catch (erro) {
        console.error("❌ Erro ao configurar Arduino:", erro.message);
        agendarReconexao();
    }
}

function agendarReconexao() {
    console.log("🔄 Tentando reconectar em 5 segundos...");
    setTimeout(conectarArduino, 5000);
}

// Rotas
app.get("/dados", (req, res) => {
    res.json(dadosArduino);
});

app.get("/saude", (req, res) => {
    res.json({
        status: "online",
        arduino: dadosArduino.conexao,
        modoCloud: MODO_CLOUD,
        tempo: new Date().toLocaleTimeString("pt-BR")
    });
});

// Erro 404
app.use((req, res) => {
    res.status(404).json({ erro: "Rota não encontrada" });
});

// Iniciar servidor - escutar em 0.0.0.0 para aceitar conexões remotas
app.listen(PORTA_SITE, "0.0.0.0", () => {
    // Obter IP local
    const os = require("os");
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

    console.log(`\n🚀 Servidor rodando em http://${ipLocal}:${PORTA_SITE}`);
    console.log(`📱 Acesse de outro dispositivo: http://${ipLocal}:${PORTA_SITE}`);
    if (MODO_CLOUD) {
        console.log("☁️  Modo cloud: site público ativo sem Arduino conectado.\n");
    } else {
        console.log(`📡 Aguardando conexão com Arduino na porta ${PORTA_ARDUINO}...\n`);
    }
    conectarArduino();
});

// Graceful shutdown
process.on("SIGINT", () => {
    console.log("\n⏹️  Encerrando servidor...");
    if (portaSerial) {
        portaSerial.close();
    }
    process.exit(0);
});
