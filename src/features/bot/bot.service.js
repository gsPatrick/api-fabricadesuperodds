const { Telegraf } = require('telegraf');
require('dotenv').config();

class BotService {
    constructor() {
        if (process.env.BOT_TOKEN) {
            this.bot = new Telegraf(process.env.BOT_TOKEN);
        } else {
            console.warn('BOT_TOKEN not found in .env. Notifications will not be sent.');
            this.bot = null;
        }
    }

    async sendNotification(userId, message) {
        if (!this.bot) return false;
        try {
            await this.bot.telegram.sendMessage(userId, message);
            return true;
        } catch (error) {
            console.error(`Failed to send notification to ${userId}:`, error.message);
            // Common error: "Forbidden: bot was blocked by the user" or "chat not found"
            return false;
        }
    }
}

module.exports = new BotService();
