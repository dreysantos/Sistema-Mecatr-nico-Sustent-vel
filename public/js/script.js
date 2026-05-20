let ultimoErro = null;
let tentativasConexao = 0;
let historicoLocal = [];

const ids = {
    pontoConexao: "pontoConexao",
    textoConexao: "textoConexao",
    nivelAgua: "nivelAgua",
    statusBomba: "statusBomba",
    corrente: "corrente",
    bateria: "bateria",
    solar: "solar",
    alerta: "alerta",
    barraNivel: "barraNivel",
    barraBateria: "barraBateria",
    barraSolar: "barraSolar",
    barraCorrente: "barraCorrente",
    lcdLinha1: "lcdLinha1",
    lcdLinha2: "lcdLinha2",
    lcdLinha3: "lcdLinha3",
    lcdLinha4: "lcdLinha4",
    graficoHistorico: "graficoHistorico"
};

function elemento(id) {
    return document.getElementById(id);
}

function texto(id, valor) {
    const el = elemento(id);
    if (el) {
        el.innerText = valor;
    }
}

function atualizarStatusConexao(online = false, conexaoArduino = "offline", simulado = false) {
    const ponto = elemento(ids.pontoConexao);
    const label = elemento(ids.textoConexao);

    if (!ponto || !label) {
        return;
    }

    if (online && conexaoArduino === "online" && !simulado) {
        ponto.className = "ponto-conexao online";
        label.innerText = `Online - Arduino atualizado às ${new Date().toLocaleTimeString("pt-BR")}`;
        tentativasConexao = 0;
        return;
    }

    if (online && simulado) {
        ponto.className = "ponto-conexao simulado";
        label.innerText = "Modo simulação - dados demonstrativos ativos";
        tentativasConexao = 0;
        return;
    }

    if (online) {
        ponto.className = "ponto-conexao simulado";
        label.innerText = "Site online - aguardando sinal do Arduino";
        tentativasConexao = 0;
        return;
    }

    ponto.className = "ponto-conexao offline";
    label.innerText = "Offline - reconectando...";
}

function limparClasses() {
    [ids.nivelAgua, ids.statusBomba, ids.bateria, ids.alerta, ids.corrente, ids.solar].forEach((id) => {
        const el = elemento(id);
        if (el) {
            el.className = "valor";
        }
    });
}

function definirClasseStatus(id, classe) {
    const el = elemento(id);
    if (el) {
        el.classList.add(classe);
    }
}

function percentualNivel(nivel) {
    if (nivel === "CHEIO") return 100;
    if (nivel === "MEDIO") return 55;
    if (nivel === "BAIXO") return 22;
    return 8;
}

function atualizarBarra(id, percentual, classe = "normal") {
    const barra = elemento(id);
    if (!barra) {
        return;
    }

    const preenchimento = barra.querySelector("span");
    barra.className = `barra-medidor ${classe}`;
    if (preenchimento) {
        preenchimento.style.width = `${Math.max(0, Math.min(100, percentual))}%`;
    }
}

function atualizarLCD(linha1, linha2, linha3, linha4) {
    texto(ids.lcdLinha1, linha1);
    texto(ids.lcdLinha2, linha2);
    texto(ids.lcdLinha3, linha3);
    texto(ids.lcdLinha4, linha4);
}

function desenharGrafico() {
    const canvas = elemento(ids.graficoHistorico);
    if (!canvas || historicoLocal.length < 2) {
        return;
    }

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const padding = 28;
    const pontos = historicoLocal.slice(-30);
    const maxX = Math.max(1, pontos.length - 1);

    ctx.strokeStyle = "#d5e4e5";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + ((altura - padding * 2) / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(largura - padding, y);
        ctx.stroke();
    }

    desenharLinha(ctx, pontos, "cargaBateria", "#16804f", largura, altura, padding, maxX, 100);
    desenharLinha(ctx, pontos, "tensaoSolar", "#2c9fbe", largura, altura, padding, maxX, 25);
}

function desenharLinha(ctx, pontos, campo, cor, largura, altura, padding, maxX, maxY) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.beginPath();

    pontos.forEach((ponto, index) => {
        const x = padding + ((largura - padding * 2) / maxX) * index;
        const y = altura - padding - (Math.min(maxY, Number(ponto[campo]) || 0) / maxY) * (altura - padding * 2);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();
}

function atualizarPainel(dados) {
    atualizarStatusConexao(true, dados.conexao, dados.simulado);
    ultimoErro = null;

    const nivel = dados.nivel || "INDEFINIDO";
    const bomba = dados.bomba || "INDEFINIDO";
    const corrente = Number(dados.corrente) || 0;
    const tensaoBateria = Number(dados.tensaoBateria) || 0;
    const cargaBateria = Number(dados.cargaBateria) || 0;
    const tensaoSolar = Number(dados.tensaoSolar) || 0;
    const alerta = dados.alerta || "INDEFINIDO";

    texto(ids.nivelAgua, nivel);
    texto(ids.statusBomba, bomba);
    texto(ids.corrente, `${corrente.toFixed(2)} A`);
    texto(ids.bateria, `${tensaoBateria.toFixed(1)}V - ${Math.round(cargaBateria)}%`);
    texto(ids.solar, `${tensaoSolar.toFixed(1)} V`);
    texto(ids.alerta, alerta);

    limparClasses();

    definirClasseStatus(ids.alerta, alerta === "NORMAL" ? "status-normal" : "status-alerta");
    definirClasseStatus(ids.nivelAgua, nivel === "CHEIO" ? "status-normal" : nivel === "MEDIO" ? "status-atencao" : "status-alerta");
    definirClasseStatus(ids.statusBomba, bomba === "LIGADA" ? "status-atencao" : "status-normal");
    definirClasseStatus(ids.bateria, tensaoBateria < 11.5 ? "status-alerta" : cargaBateria < 35 ? "status-atencao" : "status-normal");
    definirClasseStatus(ids.corrente, corrente > 4 ? "status-alerta" : "status-normal");
    definirClasseStatus(ids.solar, tensaoSolar < 10 ? "status-atencao" : "status-normal");

    atualizarBarra(ids.barraNivel, percentualNivel(nivel), nivel === "BAIXO" ? "alerta" : nivel === "MEDIO" ? "atencao" : "normal");
    atualizarBarra(ids.barraBateria, cargaBateria, cargaBateria < 25 ? "alerta" : cargaBateria < 45 ? "atencao" : "normal");
    atualizarBarra(ids.barraSolar, (tensaoSolar / 22) * 100, tensaoSolar < 10 ? "atencao" : "normal");
    atualizarBarra(ids.barraCorrente, (corrente / 8) * 100, corrente > 4 ? "alerta" : "normal");

    atualizarLCD(
        "TANQUE DE AGUA",
        `NIVEL: ${nivel}`,
        `BAT:${tensaoBateria.toFixed(1)}V ${Math.round(cargaBateria)}%`,
        `SOLAR:${tensaoSolar.toFixed(1)}V`
    );

    historicoLocal.push({
        cargaBateria,
        tensaoSolar,
        corrente,
        horario: dados.ultimaAtualizacao
    });

    if (historicoLocal.length > 60) {
        historicoLocal = historicoLocal.slice(-60);
    }

    desenharGrafico();
}

async function buscarJSON(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
        const resposta = await fetch(url, {
            method: "GET",
            signal: controller.signal
        });

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        return await resposta.json();
    } finally {
        clearTimeout(timeout);
    }
}

async function buscarDadosArduino() {
    try {
        const dados = await buscarJSON("/dados");

        if (!dados || typeof dados !== "object") {
            throw new Error("Dados inválidos recebidos");
        }

        atualizarPainel(dados);
    } catch (erro) {
        atualizarStatusConexao(false);
        tentativasConexao++;

        const mensagem = `Erro ao buscar dados: ${erro.message}`;
        if (ultimoErro !== mensagem) {
            console.warn(mensagem);
            ultimoErro = mensagem;
        }
    }
}

async function carregarDiagnostico() {
    const container = elemento("diagnosticoDados");
    if (!container) {
        return;
    }

    try {
        const dados = await buscarJSON("/diagnostico");
        container.innerHTML = "";

        const itens = [
            ["Servidor", dados.statusServidor],
            ["Arduino", dados.conexaoArduino],
            ["Modo cloud", dados.modoCloud ? "Ativo" : "Inativo"],
            ["Simulação automática", dados.simulacaoAutomatica ? "Ativa" : "Inativa"],
            ["Porta Arduino", dados.portaArduino],
            ["Baud rate", dados.baudRate],
            ["Última atualização", dados.ultimaAtualizacao],
            ["Histórico", `${dados.leiturasNoHistorico} leituras`],
            ["Uptime", `${dados.uptimeSegundos}s`],
            ["Memória", `${dados.memoria.heapUsadoMB} MB heap`]
        ];

        itens.forEach(([titulo, valor]) => {
            const item = document.createElement("div");
            item.className = "diagnostico-item";
            item.innerHTML = `<strong>${titulo}</strong><p>${valor}</p>`;
            container.appendChild(item);
        });
    } catch (erro) {
        container.innerHTML = `<div class="diagnostico-item"><strong>Erro</strong><p>${erro.message}</p></div>`;
    }
}

if (elemento(ids.nivelAgua) || elemento(ids.lcdLinha1)) {
    buscarDadosArduino();
    const intervalo = setInterval(buscarDadosArduino, 1000);

    setInterval(() => {
        if (tentativasConexao > 30) {
            console.error("Muitas falhas na conexão. Verifique se o servidor está rodando.");
            clearInterval(intervalo);
        }
    }, 5000);
}

if (elemento("diagnosticoDados")) {
    carregarDiagnostico();
    setInterval(carregarDiagnostico, 3000);
}

window.addEventListener("resize", desenharGrafico);
