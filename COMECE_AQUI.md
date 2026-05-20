# 🚀 GUIA RÁPIDO - Sistema Mecatrônico

## ✅ Instalação Inicial (Uma Vez)

```bash
npm install
```

## 🎯 Rodar o Servidor

### Windows
- **Opção 1**: Clicar 2x em `iniciar.bat`
- **Opção 2**: PowerShell
  ```powershell
  npm start
  ```

### Linux/macOS
```bash
./iniciar.sh
```

## 📱 Acessar o Painel

### Mesmo PC (Localhost)
```
http://localhost:3000
```

### Outro Dispositivo na Rede
Procure no console a linha:
```
📱 Acesse de outro dispositivo: http://192.168.X.X:3000
```
Use esse IP no celular/tablet/outro PC (mesma rede WiFi)

## 🔧 Configurar Arduino

Edite o arquivo `.env`:

```env
PORTA_ARDUINO=COM3
PORTA_SITE=3000
```

**Encontrar porta do Arduino:**
- Arduino IDE → Ferramentas → Porta
- Ou: `arduino-cli board list`

## 📤 Publicar no GitHub

1. Criar repositório em [github.com](https://github.com)
2. Abrir PowerShell na pasta do projeto
3. Executar comandos em [GITHUB_SETUP.md](GITHUB_SETUP.md)

## ❓ Problemas?

| Problema | Solução |
|----------|---------|
| "comando npm não encontrado" | Instale Node.js em nodejs.org |
| Arduino não conecta | Verifique porta em `.env` |
| Celular não vê servidor | Mesma WiFi? Firewall bloqueando? |
| Porta 3000 em uso | Mude em `.env`: `PORTA_SITE=3001` |

## 📚 Documentação Completa

- 📖 [README.md](README.md) - Projeto
- 🔗 [GITHUB_SETUP.md](GITHUB_SETUP.md) - GitHub e Acesso Remoto
- 📝 [public/index.html](public/index.html) - Interface

---

**Tudo pronto para monitorar seu sistema! ⚡**
