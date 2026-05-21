# Configurar Supabase

Use este passo a passo para deixar as leituras salvas em banco online.

## 1. Criar projeto

1. Acesse https://supabase.com.
2. Crie uma conta ou entre na sua conta.
3. Clique em **New project**.
4. Escolha um nome, por exemplo `projeto-24hrs`.
5. Aguarde o projeto terminar de criar.

## 2. Criar tabela

1. No painel do Supabase, abra **SQL Editor**.
2. Cole o conteúdo do arquivo:

```text
supabase/schema.sql
```

3. Clique em **Run**.

## 3. Copiar variáveis

No Supabase, abra **Project Settings > API**.

Copie:

- **Project URL** para `SUPABASE_URL`.
- **service_role key** para `SUPABASE_SERVICE_ROLE_KEY`.

No `.env` local ou no Render, configure:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_TABELA=leituras
BANCO_ATIVO=true
```

## 4. Render

No Render, abra o serviço do site e entre em **Environment**.

Adicione:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
SUPABASE_TABELA=leituras
BANCO_ATIVO=true
MODO_CLOUD=true
TRUST_PROXY=true
```

Depois clique em **Manual Deploy > Deploy latest commit**.

## 5. Testar

Abra:

```text
/painel.html
```

Aguarde alguns segundos e depois abra:

```text
/leituras.html
```

Se estiver configurado corretamente, as leituras aparecerão na tabela e ficarão salvas no Supabase.

## Segurança

Não coloque `SUPABASE_SERVICE_ROLE_KEY` em arquivos públicos, HTML ou JavaScript. Essa chave deve ficar apenas no `.env` local ou nas variáveis do Render.
