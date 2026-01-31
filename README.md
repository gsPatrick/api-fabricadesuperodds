# Telegram Bot Financial Backend

Este projeto é o backend para um servidor de bot do Telegram que gerencia registros financeiros. Ele oferece uma API para registrar ganhos/perdas e um painel administrativo para gerenciar permissões de usuários.

## Tecnologias Usadas
- Node.js & Express
- Sequelize & PostgreSQL
- HTML/CSS/JS (Painel Admin)

## Estrutura do Projeto
O código fonte reside na pasta `api/`.

## Configuração

1. **Pré-requisitos:**
   - Node.js instalado.
   - PostgreSQL instalado e rodando.

2. **Instalação:**
   Navegue até a pasta `api` e instale as dependências:
   ```bash
   cd api
   npm install
   ```

3. **Banco de Dados:**
   - Crie um banco de dados no Postgres chamado `financial_bot_db` (ou o nome que preferir).
   - Configure o arquivo `.env` na raiz da pasta `api` (um exemplo foi criado, verifique as credenciais):
     ```
     DB_NAME=financial_bot_db
     DB_USER=postgres
     DB_PASSWORD=sua_senha
     DB_HOST=localhost
     ADMIN_SECRET=sua_senha_secreta_admin
     ```

## Executando o Servidor

Para iniciar o servidor:
```bash
npm start
```
ou em modo desenvolvimento:
```bash
npm run dev
```

O servidor rodará por padrão na porta 3000. As tabelas do banco de dados serão criadas automaticamente pelo Sequelize na primeira execução.

## Painel de Administração

Acesse o painel em seu navegador:
`http://localhost:3000/admin/index.html`

Insira a `ADMIN_SECRET` definida no `.env` para autenticar.

Funcionalidades:
- **Listar Usuários:** Veja quem interagiu ou foi pré-aprovado.
- **Permitir Acesso:** Adicione um ID de Telegram ou @Username para liberar acesso antecipado.
- **Revogar/Remover:** Gerencie o acesso.

## API Endpoints (Para o Bot)

O Bot (implementado separadamente com Telegraf) deve consumir estes endpoints:

- **POST /api/bot/transactions**
  - Body: `{ "user_id_telegram": 123, "amount": 100, "type": "ganho", "description": "Salário" }`
  - Body: `{ "user_id_telegram": 123, "amount": 50, "type": "perda", "description": "Jantar" }`
  
- **GET /api/bot/transactions/balance/:user_id_telegram**
  - Retorna o saldo total.

- **GET /api/bot/transactions/report/:user_id_telegram?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD**
  - Retorna um relatório formatado em texto.
