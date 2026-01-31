const { Telegraf } = require('telegraf');
require('dotenv').config();

class BotService {
    constructor() {
        if (process.env.BOT_TOKEN) {
            this.bot = new Telegraf(process.env.BOT_TOKEN);
            this.init();
        } else {
            console.warn('BOT_TOKEN not found in .env. Notifications will not be sent.');
            this.bot = null;
        }
    }

    init() {
        // Handle /start <token>
        this.bot.start(async (ctx) => {
            const payload = ctx.startPayload; // The parameter after /start
            const fromId = ctx.from.id;
            const username = ctx.from.username;

            if (!payload) {
                return ctx.reply('Olá! Este bot é privado. Para acessar, você precisa de um link de convite válido.');
            }

            try {
                // Circular dependency workaround or require inside method
                const { Invite, User } = require('../../models');

                const invite = await Invite.findByPk(payload);

                if (!invite) {
                    return ctx.reply('❌ Link de convite inválido.');
                }

                if (invite.used) {
                    return ctx.reply('⚠️ Este link de convite já foi utilizado.');
                }

                if (new Date() > new Date(invite.expires_at)) {
                    return ctx.reply('❌ Este link de convite expirou.');
                }

                // Activate User
                const now = new Date();
                const endDate = new Date();
                endDate.setDate(now.getDate() + invite.days);

                // Create or Update User
                // Use upsert-like logic
                // Create or Update User
                // Use upsert-like logic
                let user = await User.findOne({ where: { id_telegram: fromId } });
                if (!user) {
                    user = await User.create({
                        id_telegram: fromId,
                        username: username,
                        name: invite.name, // Use name from invite
                        allowed: true,
                        start_date: now,
                        end_date: endDate
                    });
                } else {
                    user.allowed = true;
                    user.start_date = now;
                    user.end_date = endDate;
                    if (username) user.username = username;
                    if (invite.name) user.name = invite.name; // Update name if provided
                    await user.save();
                }

                // Mark invite as used
                invite.used = true;
                await invite.save();

                const formattedDate = endDate.toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                });

                const welcomeMsg = invite.name
                    ? `👋 **Olá, ${invite.name}!**\n\n🎯 Seu acesso à **Fábrica de Super Odds** foi liberado com sucesso!\n\n⏳ **Período:** ${invite.days} dias\n📅 **Vigência até:** ${formattedDate}\n\n🚀 Aproveite as melhores oportunidades do mercado!`
                    : `👋 **Seja bem-vindo!**\n\n🎯 Seu acesso à **Fábrica de Super Odds** foi liberado com sucesso!\n\n⏳ **Período:** ${invite.days} dias\n📅 **Vigência até:** ${formattedDate}\n\n🚀 Aproveite as melhores oportunidades do mercado!`;

                await ctx.replyWithMarkdown(welcomeMsg);

            } catch (error) {
                console.error('Error processing invite:', error);
                await ctx.reply('Ocorreu um erro ao processar seu convite. Tente novamente mais tarde.');
            }
        });

        // Launch bot (polling) with a delay to avoid collision during redeployments
        console.log('Bot preparing to launch in 5 seconds...');
        setTimeout(async () => {
            try {
                // Safety: Delete any existing webhook before starting polling (fixes common conflict)
                await this.bot.telegram.deleteWebhook();

                await this.bot.launch({
                    allowedUpdates: [],
                    dropPendingUpdates: true
                });
                console.log('✅ Bot is polling for updates (Drop Pending Updates: ON)');
            } catch (err) {
                if (err.response && err.response.error_code === 409) {
                    console.error('❌ ERRO 409: Conflito de Instância. Já existe outro processo usando este Token.');
                    console.error('Verifique se o bot está rodando localmente ou em outro serviço (Heroku, Render, etc).');
                } else {
                    console.error('❌ Bot launch failed:', err);
                }
            }
        }, 5000); // 5 second safety delay

        // Graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
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
