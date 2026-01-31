const express = require('express');
const cors = require('cors');
const { sequelize } = require('./src/models');
const routes = require('./src/routes');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files for Admin Panel

// Routes
app.use('/api', routes);

// Telegram Webhook Endpoint
const BotService = require('./src/features/bot/bot.service');
if (BotService.bot) {
    app.use(BotService.getWebhookCallback());
    console.log('🚀 Bot Webhook registered at /api/bot-webhook');
}

// Database Connection & Server Start
async function startServer() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // Sync models (create tables if not exist)
        await sequelize.sync({ alter: true });
        console.log('Models synchronized.');

        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

startServer();
