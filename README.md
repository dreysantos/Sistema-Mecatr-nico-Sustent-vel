# Sistema Mecatrônico Automatizado

Painel de monitoramento em tempo real para um sistema mecatrônico de controle inteligente de água, energia solar e bateria. O projeto usa Arduino, Node.js e uma interface web responsiva.

## Recursos

- Monitoramento em tempo real com atualização a cada segundo.
- Painel visual com barras de nível, bateria, corrente e placa solar.
- Histórico recente em gráfico no navegador.
- Modo simulação automático quando o Arduino não está conectado ou quando o projeto roda em nuvem.
- Página de diagnóstico do servidor e da conexão serial.
- Validação dos dados recebidos do Arduino.
- Interface responsiva com suporte a modo claro e escuro.

## Requisitos

- Node.js 14 ou superior.
- npm.
- Arduino enviando JSON por USB serial, quando usado em modo local.

## Como iniciar

```bash
npm install
npm start
```

Acesse:

```text
http://localhost:3000
```

## Configuração

Crie ou edite o arquivo `.env`:

```env
PORTA_SITE=3000
PORTA_ARDUINO=COM3
BAUD_RATE=9600
MODO_CLOUD=false
SIMULACAO_AUTOMATICA=true
CORS_ORIGEM=*
LIMITE_HISTORICO=60
```

Para publicação em nuvem, use:

```env
MODO_CLOUD=true
SIMULACAO_AUTOMATICA=true
```

## Formato enviado pelo Arduino

O Arduino deve enviar uma linha JSON por leitura:

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

Valores esperados:

| Campo | Valores |
| --- | --- |
| `nivel` | `CHEIO`, `MEDIO`, `BAIXO`, `INDEFINIDO` |
| `bomba` | `LIGADA`, `DESLIGADA`, `PAUSADA`, `INDEFINIDO` |
| `corrente` | número entre 0 e 30 |
| `tensaoBateria` | número entre 0 e 30 |
| `cargaBateria` | número entre 0 e 100 |
| `tensaoSolar` | número entre 0 e 40 |
| `alerta` | texto curto, como `NORMAL`, `BATERIA BAIXA` ou `CORRENTE ALTA` |

## Rotas

- `GET /dados`: leitura atual. Em cloud/offline pode retornar dados simulados.
- `GET /historico`: últimas leituras armazenadas.
- `GET /saude`: status simples do servidor.
- `GET /diagnostico`: status detalhado do servidor, Arduino, memória e histórico.

## Páginas

- `/index.html`: visão inicial.
- `/painel.html`: painel em tempo real.
- `/lcd.html`: representação do LCD.
- `/funcionamento.html`: explicação do fluxo.
- `/componentes.html`: lista de componentes.
- `/simulacao.html`: estados simulados e conexões.
- `/diagnostico.html`: diagnóstico visual do servidor.
- `/sobre.html`: informações do projeto.

## Publicação

O projeto já está preparado para serviços como Render. O arquivo `render.yaml` usa `npm start`, e o modo cloud pode ser ativado com a variável `MODO_CLOUD=true`.
