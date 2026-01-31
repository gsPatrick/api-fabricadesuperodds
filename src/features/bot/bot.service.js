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
        // Logging Middleware
        this.bot.use(async (ctx, next) => {
            const start = Date.now();
            console.log(`--- Mensagem Recebida ---`);
            console.log(`De: ${ctx.from?.first_name} (@${ctx.from?.username}) [${ctx.from?.id}]`);
            console.log(`Texto: ${ctx.message?.text || '(Sem texto)'}`);

            try {
                await next();
            } catch (err) {
                console.error(`❌ Erro no processamento:`, err.message);
                ctx.reply('Desculpe, ocorreu um erro interno.');
            }

            const ms = Date.now() - start;
            console.log(`Processado em ${ms}ms`);
            console.log(`-------------------------`);
        });

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

        // Hear for transaction patterns (e.g., "gastei 50", "+100", "ganhei 30")
        this.bot.on('text', async (ctx) => {
            const text = ctx.message.text.toLowerCase();
            const fromId = ctx.from.id;
            console.log(`[Transaction] Analisando: "${text}" de ${fromId}`);

            const match = text.match(/(?:(?:gastei|perdi|paguei|-)\s*(\d+(?:[.,]\d+)?))|(?:(?:ganhei|recebi|faturei|\+)\s*(\d+(?:[.,]\d+)?))/i);

            if (match) {
                const amountValue = (match[1] || match[2]).replace(',', '.');
                const amount = parseFloat(amountValue);
                const isExpense = !!match[1];
                const type = isExpense ? 'perda' : 'ganho';
                const finalAmount = isExpense ? -amount : amount;

                console.log(`[Transaction] Detectado: ${amount} (${type})`);

                try {
                    const { User } = require('../../models');
                    const TransactionService = require('../transaction/transaction.service');

                    const user = await User.findOne({ where: { id_telegram: fromId } });

                    if (!user || !user.allowed) {
                        console.log(`[Transaction] Usuário ${fromId} não autorizado.`);
                        return ctx.reply('⚠️ Você não tem permissão para registrar transações. Solicite acesso ao administrador.');
                    }

                    console.log(`[Transaction] Salvando no banco...`);
                    await TransactionService.createTransaction(fromId, finalAmount, text, type);

                    const newBalance = await TransactionService.getBalance(fromId);
                    console.log(`[Transaction] Sucesso! Novo saldo: ${newBalance}`);

                    ctx.reply(`✅ Registrado: R$ ${amount.toFixed(2)} (${isExpense ? 'Gasto' : 'Ganho'})\n💰 Novo Saldo: R$ ${newBalance.toFixed(2)}`);
                } catch (error) {
                    console.error(`[Transaction] Erro ao salvar:`, error.message);
                    ctx.reply('❌ Erro ao salvar transação.');
                }
            } else {
                console.log(`[Transaction] Nenhum padrão encontrado.`);
            }
        });

        // Webhook configuration (Easypanel optimized)
        const WEBHOOK_PATH = '/api/bot-webhook';
        const WEBHOOK_URL = `https://geral-fabricadesuperodssapi.r954jc.easypanel.host${WEBHOOK_PATH}`;

        this.bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
            console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
        }).catch(err => {
            console.error('❌ Failed to set webhook:', err.message);
        });

        // Graceful stop
        process.once('SIGINT', () => this.bot.stop('SIGINT'));
        process.once('SIGTERM', () => this.bot.stop('SIGTERM'));
    }

    getWebhookCallback() {
        return this.bot.webhookCallback('/api/bot-webhook');
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
