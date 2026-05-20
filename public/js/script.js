let ultimoErro = null;
let tentativasConexao = 0;

function atualizarStatusConexao(online = false, conexaoArduino = "offline") {
    const ponto = document.getElementById("pontoConexao");
    const texto = document.getElementById("textoConexao");

    if (online && conexaoArduino === "online") {
        ponto.className = "ponto-conexao online";
        texto.innerText = `Online - Arduino atualizado as ${new Date().toLocaleTimeString("pt-BR")}`;
        tentativasConexao = 0;
    } else if (online) {
        ponto.className = "ponto-conexao offline";
        texto.innerText = "Site online - Arduino sem sinal no momento";
        tentativasConexao = 0;
    } else {
        ponto.className = "ponto-conexao offline";
        texto.innerText = "Offline - Reconectando...";
    }
}

async function buscarDadosArduino() {
    try {
        const resposta = await fetch("/dados", {
            timeout: 5000,
            method: "GET"
        });

        if (!resposta.ok) {
            throw new Error(`HTTP ${resposta.status}`);
        }

        const dados = await resposta.json();

        // Validar dados antes de usar
        if (!dados || typeof dados !== "object") {
            throw new Error("Dados invÃ¡lidos recebidos");
        }

        // Atualizar status de conexÃ£o
        atualizarStatusConexao(true, dados.conexao);
        ultimoErro = null;

        // Atualizar valores com fallback
        document.getElementById("nivelAgua").innerText = dados.nivel || "INDEFINIDO";
        document.getElementById("statusBomba").innerText = dados.bomba || "INDEFINIDO";
        document.getElementById("corrente").innerText = (Number(dados.corrente) || 0).toFixed(2) + " A";

        document.getElementById("bateria").innerText =
            (Number(dados.tensaoBateria) || 0).toFixed(1) + "V - " + (dados.cargaBateria || 0) + "%";

        document.getElementById("solar").innerText =
            (Number(dados.tensaoSolar) || 0).toFixed(1) + " V";

        document.getElementById("alerta").innerText = dados.alerta || "INDEFINIDO";

        limparClasses();

        if (dados.alerta === "NORMAL") {
            document.getElementById("alerta").classList.add("status-normal");
        } else {
            document.getElementById("alerta").classList.add("status-alerta");
        }

        if (dados.nivel === "CHEIO") {
            document.getElementById("nivelAgua").classList.add("status-normal");
        } else if (dados.nivel === "BAIXO" || dados.nivel === "MEDIO") {
            document.getElementById("nivelAgua").classList.add("status-atencao");
        } else {
            document.getElementById("nivelAgua").classList.add("status-alerta");
        }

        if (dados.bomba === "LIGADA") {
            document.getElementById("statusBomba").classList.add("status-atencao");
        } else {
            document.getElementById("statusBomba").classList.add("status-normal");
        }

        if (Number(dados.tensaoBateria) < 11.5) {
            document.getElementById("bateria").classList.add("status-alerta");
        } else {
            document.getElementById("bateria").classList.add("status-normal");
        }

        atualizarLCD(
            "TANQUE DE AGUA",
            "NIVEL: " + (dados.nivel || "---"),
            "BAT:" + (Number(dados.tensaoBateria) || 0).toFixed(1) + "V " + (dados.cargaBateria || 0) + "%",
            "SOLAR:" + (Number(dados.tensaoSolar) || 0).toFixed(1) + "V"
        );

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

// Atualizar a cada 1 segundo, com tratamento de erros
let intervalo = setInterval(buscarDadosArduino, 1000);
buscarDadosArduino();

// Parar atualizaÃ§Ã£o se houver muitas falhas consecutivas
setInterval(() => {
    if (tentativasConexao > 30) {
        console.error("Muitas falhas na conexÃ£o. Verifique se o servidor estÃ¡ rodando.");
        clearInterval(intervalo);
    }
}, 5000);

// FunÃ§Ãµes auxiliares
function limparClasses() {
    const elementos = [
        "nivelAgua",
        "statusBomba",
        "bateria",
        "alerta"
    ];

    elementos.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.className = "valor";
        }
    });
}

function atualizarLCD(linha1, linha2, linha3, linha4) {
    document.getElementById("lcdLinha1").innerText = linha1;
    document.getElementById("lcdLinha2").innerText = linha2;
    document.getElementById("lcdLinha3").innerText = linha3;
    document.getElementById("lcdLinha4").innerText = linha4;
}
