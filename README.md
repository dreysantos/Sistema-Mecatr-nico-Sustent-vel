# Sistema Mecatrônico Automatizado 🚀

Painel de monitoramento em tempo real para sistema mecatrônico de controle inteligente de água, energia solar e alimentação de bateria. Desenvolvido com Arduino, Node.js e interface web responsiva.

## 📋 Características

- ✅ **Monitoramento em Tempo Real** - Atualização de dados a cada 1 segundo
- ✅ **Interface Responsiva** - Funciona em desktop, tablet e celular
- ✅ **Modo Escuro** - Suporte automático a preferências do sistema
- ✅ **Indicador de Conexão** - Status visual de conexão com Arduino
- ✅ **Tratamento de Erros** - Validação de dados e reconexão automática
- ✅ **Segurança** - Rate limiting e CORS configurado
- ✅ **Múltiplas Visualizações** - Painel de cards e simulação de LCD 16x2

## 🔧 Componentes Utilizados

- **Arduino Uno** - Microcontrolador principal
- **ACS712** - Sensor de corrente elétrica
- **Sensores de Nível** - Detecção do nível de água
- **Sensores de Tensão** - Medição de bateria e placa solar
- **Relé 5V** - Acionamento da bomba
- **Bomba 12V** - Abastecimento de água
- **Placa Solar** - Geração de energia
- **Bateria 12V** - Armazenamento de energia
- **Conversor Buck** - Redução de tensão 12V → 5V
- **LCD I2C 16x2** - Display no protótipo

## 📦 Requisitos

- Node.js >= 14.0.0
- npm ou yarn
- Arduino com firmware configurado (enviando dados em JSON via USB)
- Sistema operacional: Windows, macOS ou Linux

## 🚀 Instalação

### 1. Clonar/Copiar os arquivos

```bash
cd "Nova pasta (2)"
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar a porta do Arduino

Edite o arquivo `.env`:

```env
PORTA_ARDUINO=COM3
PORTA_SITE=3000
BAUD_RATE=9600
```

**Para encontrar a porta do Arduino:**

- **Arduino IDE**: Ferramentas → Porta
- **Linha de comando**:
  ```bash
  arduino-cli board list
  ```

### 4. Iniciar o servidor

```bash
npm start
```

Acesse em: **http://localhost:3000**

## 📝 Formato de Dados do Arduino

O Arduino deve enviar dados em formato JSON, uma linha por vez, terminada com `\n`:

```json
{
  "nivel": "CHEIO",
  "bomba": "DESLIGADA",
  "corrente": 1.23,
  "tensaoBateria": 12.5,
  "cargaBateria": 85,
  "tensaoSolar": 18.2,
  "alerta": "NORMAL"
}
```

### Campos obrigatórios:

| Campo | Tipo | Valores Esperados |
|-------|------|-------------------|
| `nivel` | String | "CHEIO", "MEDIO", "BAIXO" |
| `bomba` | String | "LIGADA", "DESLIGADA" |
| `corrente` | Number | 0.0 a 10.0+ (amperes) |
| `tensaoBateria` | Number | 9.0 a 13.0 (volts) |
| `cargaBateria` | Number | 0 a 100 (%) |
| `tensaoSolar` | Number | 0 a 25.0 (volts) |
| `alerta` | String | "NORMAL", "BATERIA_BAIXA", "CORRENTE_ALTA" |

### Exemplo de sketch Arduino:

```cpp
void setup() {
  Serial.begin(9600);
}

void loop() {
  float nivel = ...;  // Ler sensor
  float bomba = ...;
  float corrente = ...;
  
  String json = "{";
  json += "\"nivel\":\"" + String(nivel) + "\",";
  json += "\"bomba\":\"" + String(bomba) + "\",";
  json += "\"corrente\":" + String(corrente) + ",";
  json += "\"tensaoBateria\":" + String(tensaoBateria) + ",";
  json += "\"cargaBateria\":" + String(cargaBateria) + ",";
  json += "\"tensaoSolar\":" + String(tensaoSolar) + ",";
  json += "\"alerta\":\"" + String(alerta) + "\"";
  json += "}";
  
  Serial.println(json);
  delay(1000);
}
```

## 🌐 API REST

### GET `/dados`

Retorna os dados atualizados do Arduino:

```bash
curl http://localhost:3000/dados
```

**Resposta:**
```json
{
  "nivel": "CHEIO",
  "bomba": "DESLIGADA",
  "corrente": 1.23,
  "tensaoBateria": 12.5,
  "cargaBateria": 85,
  "tensaoSolar": 18.2,
  "alerta": "NORMAL",
  "conexao": "online",
  "ultimaAtualizacao": "14:30:25"
}
```

### GET `/saude`

Verifica o status do servidor e Arduino:

```bash
curl http://localhost:3000/saude
```

## 🎨 Interface

### Seções da Página

1. **Painel de Monitoramento** - Cards com informações principais
   - Nível da Água
   - Status da Bomba
   - Corrente Atual
   - Bateria
   - Placa Solar
   - Alerta

2. **Leitura LCD** - Simulação visual do display LCD 16x2

3. **Como o Sistema Funciona** - Documentação do fluxo

4. **Componentes** - Lista dos parts utilizados

5. **Sobre** - Informações do projeto

### Estados Visuais

| Estado | Cor | Significado |
|--------|-----|-------------|
| 🟢 Normal/Cheio | Verde | Funcionamento adequado |
| 🟡 Médio/Atenção | Laranja | Verificação recomendada |
| 🔴 Baixo/Alerta | Vermelho | Ação imediata necessária |

## 🔒 Segurança

- ✅ **Rate Limiting**: 30 requisições por minuto por IP
- ✅ **CORS**: Configurado para localhost
- ✅ **Validação de Dados**: Todas as entradas são validadas
- ✅ **Limite de Payload**: Máximo 10KB por requisição
- ✅ **Reconexão Automática**: Se Arduino desconectar

## 📊 Troubleshooting

### Arduino não conecta

1. Verifique a porta em Arduino IDE
2. Teste com: `npm start` com porta diferente
3. Verifique taxa baud: padrão é 9600
4. Reinicie Arduino IDE e o servidor

### Dados não atualizam

1. Abra o console do navegador (F12)
2. Verifique se há mensagens de erro
3. Confirme que Arduino está enviando JSON válido

### Conexão cai frequentemente

1. Verifique cabo USB
2. Atualize drivers Arduino no Windows
3. Consulte logs do servidor para erros

## 📋 Estrutura de Arquivos

```
Nova pasta (2)/
├── server.js              # Servidor Node.js/Express
├── package.json           # Dependências do projeto
├── .env                   # Configurações (porta, porta serial)
├── .gitignore             # Arquivos ignorados pelo Git
├── README.md              # Este arquivo
└── public/
    ├── index.html         # Interface principal
    ├── script.js          # Lógica fronted
    └── style.css          # Estilos (light + dark mode)
```

## 🚀 Deployment

Para rodar em servidor:

1. Configure variáveis de ambiente
2. Configure porta do Arduino (pode ser diferente em servidor)
3. Use `pm2` ou outro process manager para manter rodando

## 📄 Licença

MIT

## 👥 Autores

CETEP-RM | Camaçari - BA | 2026

## 💡 Dicas

- Mantenha o Arduino conectado por USB durante operação
- Monitore a bateria regularmente
- Se houver erros recorrentes, verifique conexões soltas
- O servidor auto-reconecta se Arduino desconectar

---

**Desenvolvido com ❤️ para automação sustentável**
