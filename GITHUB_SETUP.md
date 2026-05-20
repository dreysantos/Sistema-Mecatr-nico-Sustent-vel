# 📤 Publicar no GitHub e Acessar de Outro Dispositivo

## 🚀 Passo 1: Criar Repositório no GitHub

1. Acesse [GitHub.com](https://github.com)
2. Faça login ou crie uma conta
3. Clique em **"+"** (canto superior direito) → **"New repository"**
4. Preencha:
   - **Repository name**: `sistema-mecatronico-automatizado`
   - **Description**: Painel de monitoramento para Arduino com energia solar
   - **Public/Private**: Escolha (Public = qualquer um vê, Private = só você)
   - Clique em **"Create repository"**

## 🔧 Passo 2: Configurar Git Localmente

### No Windows (PowerShell como Administrador):

```powershell
# Navegar até a pasta do projeto
cd "C:\Users\andre\OneDrive\Desktop\Nova pasta (2)"

# Inicializar repositório Git
git init

# Configurar seu nome e email (use seus dados do GitHub)
git config user.name "Seu Nome"
git config user.email "seu.email@example.com"

# Adicionar todos os arquivos
git add .

# Fazer commit inicial
git commit -m "feat: sistema mecatrônico com monitoramento em tempo real"

# Renomear branch para 'main'
git branch -M main

# Adicionar origem remota (substitua SEU_USUARIO)
git remote add origin https://github.com/SEU_USUARIO/sistema-mecatronico-automatizado.git

# Fazer push para GitHub
git push -u origin main
```

### ✅ Pronto! Seu projeto está no GitHub!

## 📱 Acessar de Outro Dispositivo

### Opção 1: Rede Local (Recomendado para Casa/Escritório)

**No seu PC (servidor):**

1. Abra PowerShell e rode:
   ```powershell
   npm start
   ```

2. Procure a linha no console que diz:
   ```
   📱 Acesse de outro dispositivo: http://192.168.X.X:3000
   ```

3. Copie esse IP

**No outro dispositivo (ex: celular, tablet):**

1. Conecte **na mesma rede WiFi** do PC
2. Abra o navegador e acesse:
   ```
   http://192.168.X.X:3000
   ```

**Exemplo:**
```
PC rodando servidor: http://192.168.1.50:3000
Celular acessa: http://192.168.1.50:3000
```

### Opção 2: Acesso Remoto (Internet)

Se quer acessar de fora da rede local, configure:

#### A. Port Forwarding no Roteador

1. Acesse painel do seu roteador (geralmente 192.168.1.1)
2. Procure por "Port Forwarding"
3. Configure:
   - **Porta externa**: 3000
   - **IP local**: 192.168.X.X (do seu PC)
   - **Porta interna**: 3000

4. Acesse de fora: `http://seu_ip_publico:3000`

#### B. Usar Serviço Cloud (Mais Seguro)

Alternativas como **ngrok** (fácil):

```powershell
# Instalar ngrok (uma vez)
choco install ngrok

# Quando servidor tiver rodando
ngrok http 3000
```

Você receberá um URL como `https://abc123.ngrok.io` para compartilhar

## 🔒 Segurança - Importante!

**⚠️ AVISO**: Se expor na internet, considere adicionar autenticação:

```javascript
// Adicionar ao server.js para proteger
const SENHA_ACESSO = "senha123";

app.get("/dados", (req, res) => {
    const senha = req.headers["x-senha"];
    if (senha !== SENHA_ACESSO) {
        return res.status(401).json({ erro: "Não autorizado" });
    }
    res.json(dadosArduino);
});
```

E no navegador, adicionar header:

```javascript
fetch("/dados", {
    headers: { "X-Senha": "senha123" }
}).then(r => r.json());
```

## 📥 Clonar em Outro PC

Outro PC quer usar o projeto?

```powershell
git clone https://github.com/SEU_USUARIO/sistema-mecatronico-automatizado.git
cd sistema-mecatronico-automatizado
npm install
npm start
```

## 🔄 Atualizar Código no GitHub

Após fazer mudanças locais:

```powershell
git add .
git commit -m "atualizar descrição"
git push
```

## 📊 Verificar Status

```powershell
git status          # Ver arquivos modificados
git log --oneline   # Ver histórico de commits
```

## 🎯 Resumo Rápido

| Ação | Comando |
|------|---------|
| Iniciar servidor | `npm start` |
| Acessar localmente | `http://localhost:3000` |
| Acessar da rede | `http://192.168.X.X:3000` |
| Atualizar GitHub | `git push` |
| Baixar em outro PC | `git clone https://...` |

---

✅ **Agora seu servidor funciona remotamente!** 🎉
