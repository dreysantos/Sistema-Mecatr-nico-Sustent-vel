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

function escaparHTML(valor) {
    return String(valor ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
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

    const paddingEsquerda = 52;
    const paddingDireita = 58;
    const paddingTopo = 28;
    const paddingBaixo = 34;
    const pontos = historicoLocal.slice(-30);
    const maxX = Math.max(1, pontos.length - 1);
    const area = {
        esquerda: paddingEsquerda,
        direita: largura - paddingDireita,
        topo: paddingTopo,
        baixo: altura - paddingBaixo
    };

    ctx.font = "12px Arial";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#d5e4e5";
    ctx.fillStyle = "#5d706e";
    ctx.lineWidth = 1;

    for (let i = 0; i <= 4; i++) {
        const y = area.topo + ((area.baixo - area.topo) / 4) * i;
        const bateria = 100 - i * 25;
        const solar = 25 - i * 6.25;

        ctx.beginPath();
        ctx.moveTo(area.esquerda, y);
        ctx.lineTo(area.direita, y);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.fillText(`${bateria}%`, area.esquerda - 8, y);

        ctx.textAlign = "left";
        ctx.fillText(`${solar.toFixed(solar % 1 === 0 ? 0 : 1)}V`, area.direita + 8, y);
    }

    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = "#16804f";
    ctx.fillText("Bateria (%)", area.esquerda, 16);
    ctx.fillStyle = "#2c9fbe";
    ctx.textAlign = "right";
    ctx.fillText("Solar (V)", area.direita, 16);

    desenharLinha(ctx, pontos, "cargaBateria", "#16804f", area, maxX, 100, "%");
    desenharLinha(ctx, pontos, "tensaoSolar", "#2c9fbe", area, maxX, 25, "V");
}

function desenharLinha(ctx, pontos, campo, cor, area, maxX, maxY, unidade) {
    ctx.strokeStyle = cor;
    ctx.lineWidth = 3;
    ctx.beginPath();

    pontos.forEach((ponto, index) => {
        const valor = Math.min(maxY, Number(ponto[campo]) || 0);
        const x = area.esquerda + ((area.direita - area.esquerda) / maxX) * index;
        const y = area.baixo - (valor / maxY) * (area.baixo - area.topo);

        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    const ultimo = pontos[pontos.length - 1];
    const valorFinal = Math.min(maxY, Number(ultimo[campo]) || 0);
    const xFinal = area.direita;
    const yFinal = area.baixo - (valorFinal / maxY) * (area.baixo - area.topo);
    const casas = unidade === "%" ? 0 : 1;

    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.arc(xFinal, yFinal, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "12px Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`${valorFinal.toFixed(casas)}${unidade}`, xFinal + 8, yFinal);
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

function formatarDataLeitura(leitura) {
    if (!leitura.dataISO) {
        return leitura.horario || "-";
    }

    const data = new Date(leitura.dataISO);
    if (Number.isNaN(data.getTime())) {
        return leitura.horario || "-";
    }

    return data.toLocaleString("pt-BR");
}

function classeAlerta(alerta) {
    if (alerta === "NORMAL") {
        return "ok";
    }

    return alerta ? "erro" : "aviso";
}

function atualizarStatusLeituras(tipo, mensagem) {
    const status = elemento("statusLeituras");
    if (!status) {
        return;
    }

    const classePonto = tipo === "ok" ? "online" : tipo === "erro" ? "offline" : "simulado";
    status.innerHTML = `<span class="ponto-conexao ${classePonto}"></span><span>${escaparHTML(mensagem)}</span>`;
}

function atualizarResumoLeituras(leituras) {
    const resumo = elemento("resumoLeituras");
    if (!resumo) {
        return;
    }

    const ultima = leituras[leituras.length - 1];
    const reais = leituras.filter((leitura) => !leitura.simulado).length;
    const simuladas = leituras.length - reais;

    resumo.innerHTML = `
        <div class="diagnostico-item">
            <strong>Total carregado</strong>
            <p>${leituras.length} leituras</p>
        </div>
        <div class="diagnostico-item">
            <strong>Último registro</strong>
            <p>${ultima ? escaparHTML(formatarDataLeitura(ultima)) : "Sem dados salvos"}</p>
        </div>
        <div class="diagnostico-item">
            <strong>Origem dos dados</strong>
            <p>${reais} reais / ${simuladas} simuladas</p>
        </div>
    `;
}

function renderizarTabelaLeituras(leituras) {
    const tabela = elemento("tabelaLeituras");
    if (!tabela) {
        return;
    }

    if (leituras.length === 0) {
        tabela.innerHTML = `<tr><td colspan="8">Nenhuma leitura salva ainda. Abra o painel, aguarde alguns segundos e atualize esta página.</td></tr>`;
        return;
    }

    tabela.innerHTML = leituras.slice().reverse().map((leitura) => {
        const alerta = leitura.alerta || "-";
        const origem = leitura.simulado ? "Simulada" : "Arduino";

        return `
            <tr>
                <td>${escaparHTML(formatarDataLeitura(leitura))}</td>
                <td><span class="selo ${leitura.nivel === "CHEIO" ? "ok" : leitura.nivel === "BAIXO" ? "erro" : "aviso"}">${escaparHTML(leitura.nivel || "-")}</span></td>
                <td>${escaparHTML(leitura.bomba || "-")}</td>
                <td>${Number(leitura.tensaoBateria || 0).toFixed(1)}V / ${Math.round(Number(leitura.cargaBateria || 0))}%</td>
                <td>${Number(leitura.tensaoSolar || 0).toFixed(1)}V</td>
                <td>${Number(leitura.corrente || 0).toFixed(2)}A</td>
                <td><span class="selo ${classeAlerta(alerta)}">${escaparHTML(alerta)}</span></td>
                <td><span class="selo ${leitura.simulado ? "aviso" : "ok"}">${origem}</span></td>
            </tr>
        `;
    }).join("");
}

async function carregarLeituras() {
    const tabela = elemento("tabelaLeituras");
    if (!tabela) {
        return;
    }

    const limite = elemento("limiteLeituras")?.value || "50";
    const tokenCampo = elemento("tokenLeituras");
    const tokenUrl = new URLSearchParams(window.location.search).get("token");
    const token = tokenCampo?.value || tokenUrl || "";
    const url = token ? `/leituras?limite=${encodeURIComponent(limite)}&token=${encodeURIComponent(token)}` : `/leituras?limite=${encodeURIComponent(limite)}`;

    if (tokenCampo && tokenUrl && !tokenCampo.value) {
        tokenCampo.value = tokenUrl;
    }

    atualizarStatusLeituras("carregando", "Consultando o banco local...");

    try {
        const leituras = await buscarJSON(url);
        renderizarTabelaLeituras(Array.isArray(leituras) ? leituras : []);
        atualizarResumoLeituras(Array.isArray(leituras) ? leituras : []);
        atualizarStatusLeituras("ok", "Leituras carregadas com sucesso.");
    } catch (erro) {
        tabela.innerHTML = `<tr><td colspan="8">Não foi possível carregar. Se configurou DIAGNOSTICO_TOKEN, informe o token acima.</td></tr>`;
        atualizarResumoLeituras([]);
        atualizarStatusLeituras("erro", `Erro ao consultar o banco: ${erro.message}`);
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
        const token = new URLSearchParams(window.location.search).get("token");
        const url = token ? `/diagnostico?token=${encodeURIComponent(token)}` : "/diagnostico";
        const dados = await buscarJSON(url);
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

if (elemento("tabelaLeituras")) {
    carregarLeituras();
    elemento("atualizarLeituras")?.addEventListener("click", carregarLeituras);
    elemento("limiteLeituras")?.addEventListener("change", carregarLeituras);
}

window.addEventListener("resize", desenharGrafico);
