const { Telegraf, Markup } = require('telegraf');
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

    // Professional Main Menu
    getMainMenu() {
        return Markup.keyboard([
            ['💰 Meu Saldo', '📊 Relatório Mensal'],
            ['📝 Como Registrar?']
        ]).resize();
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
            const payload = ctx.startPayload;
            const fromId = ctx.from.id;
            const username = ctx.from.username;

            if (!payload) {
                // If user already exists and is allowed, just show menu
                const { User } = require('../../models');
                const user = await User.findOne({ where: { id_telegram: fromId } });
                if (user && user.allowed) {
                    return ctx.reply('Bem-vindo de volta! Use o menu abaixo para navegar.', this.getMainMenu());
                }
                return ctx.reply('Olá! Este bot é privado. Para acessar, você precisa de um link de convite válido.');
            }

            try {
                const { Invite, User } = require('../../models');
                const invite = await Invite.findByPk(payload);

                if (!invite || invite.used || new Date() > new Date(invite.expires_at)) {
                    return ctx.reply('❌ Link de convite inválido ou expirado.');
                }

                const now = new Date();
                const endDate = new Date();
                endDate.setDate(now.getDate() + invite.days);

                await User.upsert({
                    id_telegram: fromId,
                    username: username,
                    name: invite.name,
                    allowed: true,
                    start_date: now,
                    end_date: endDate
                });

                invite.used = true;
                await invite.save();

                const formattedDate = endDate.toLocaleDateString('pt-BR');
                const welcomeMsg = `🎯 **Acesso Liberado!**\n\nOlá ${invite.name || ''}, seu acesso à **Fábrica de Super Odds** está ativo até ${formattedDate}.\n\nPara começar, basta digitar seus ganhos ou perdas:\nEx: "ganhei 100" ou "perdi 50"`;

                await ctx.replyWithMarkdown(welcomeMsg, this.getMainMenu());

            } catch (error) {
                console.error('Error processing invite:', error);
                await ctx.reply('Erro ao processar convite.');
            }
        });

        // Command: Help / Instructions
        this.bot.hears([/📝 Como Registrar\?/i, /^\/ajuda$/i, /^ajuda$/i], (ctx) => {
            const helpMsg = `📖 **Guia de Comandos**\n\n` +
                `✅ **Registrar Ganho:**\n"ganhei 100", "+50", "recebi 30", "lucro 10"\n\n` +
                `❌ **Registrar Perda:**\n"perdi 50", "-20", "perdi 10", "paguei 80", "despesa 15"\n\n` +
                `💰 **Consultar Saldo:** Clique no botão de saldo ou digite **saldo**\n\n` +
                `📊 **Relatório:** Clique no botão de relatório ou digite **relatorio**`;
            ctx.replyWithMarkdown(helpMsg, this.getMainMenu());
        });

        // Command: Balance
        this.bot.hears([/💰 Meu Saldo/i, /^\/saldo$/i, /^saldo$/i], async (ctx) => {
            const fromId = ctx.from.id;
            try {
                const TransactionService = require('../transaction/transaction.service');
                const balance = await TransactionService.getBalance(fromId);

                const balanceMsg = `🏦 **Extrato Atual**\n\n` +
                    `💰 **Saldo Geral:** R$ ${balance.toFixed(2)}\n\n` +
                    `*Status: ${balance >= 0 ? 'Em dia ✅' : 'Atenção ⚠️'}*`;

                ctx.replyWithMarkdown(balanceMsg, Markup.inlineKeyboard([
                    [Markup.button.callback('📊 Ver Relatório Mensal', 'get_report')]
                ]));
            } catch (error) {
                ctx.reply('Erro ao consultar saldo.');
            }
        });

        // Command: Monthly Report
        this.bot.hears([/📊 Relatório Mensal/i, /^\/relatorio$/i, /^relatorio$/i], async (ctx) => {
            const fromId = ctx.from.id;
            try {
                const TransactionService = require('../transaction/transaction.service');
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                const report = await TransactionService.generateReport(fromId, startOfMonth, now);

                const reportMsg = `📊 **Relatório do Mês (${now.toLocaleString('pt-BR', { month: 'long' })})**\n\n${report}\n\n*Relatório gerado em ${now.toLocaleString('pt-BR')}*`;

                ctx.replyWithMarkdown(reportMsg);
            } catch (error) {
                ctx.reply('Erro ao gerar relatório.');
            }
        });

        // Action: Inline Report Callback
        this.bot.action('get_report', async (ctx) => {
            await ctx.answerCbQuery().catch(() => { });
            const fromId = ctx.from.id;
            const TransactionService = require('../transaction/transaction.service');
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const report = await TransactionService.generateReport(fromId, startOfMonth, now);
            ctx.replyWithMarkdown(`📊 **Relatório Mensal**\n\n${report}`);
        });

        // General Text Handling (Transactions)
        this.bot.on('text', async (ctx) => {
            const text = ctx.message.text.toLowerCase();
            const fromId = ctx.from.id;

            // Regex for transactions
            const match = text.match(/(?:(?:perdi|paguei|perda|despesa|-)\s*(\d+(?:[.,]\d+)?))|(?:(?:ganhei|recebi|faturei|lucro|ganho|\+)\s*(\d+(?:[.,]\d+)?))/i);

            if (match) {
                const amountValue = (match[1] || match[2]).replace(',', '.');
                const amount = parseFloat(amountValue);
                const isExpense = !!match[1];
                const type = isExpense ? 'perda' : 'ganho';
                const finalAmount = isExpense ? -amount : amount;

                try {
                    const { User } = require('../../models');
                    const TransactionService = require('../transaction/transaction.service');

                    const user = await User.findOne({ where: { id_telegram: fromId } });
                    if (!user || !user.allowed) return ctx.reply('⚠️ Acesso não autorizado.');

                    await TransactionService.createTransaction(fromId, finalAmount, text, type);
                    const newBalance = await TransactionService.getBalance(fromId);

                    const dateStr = new Date().toLocaleDateString('pt-BR');
                    const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    const responseMsg = (isExpense ? '📉 **Perda Registrada**' : '📈 **Ganho Registrado**') +
                        `\n\n💰 **Valor:** ${isExpense ? '-' : '+'}R$ ${amount.toFixed(2)}\n` +
                        `📝 **Descrição:** ${text}\n` +
                        `⏰ **Horário:** ${dateStr} às ${timeStr}\n\n` +
                        `🏦 **Saldo Atual:** R$ ${newBalance.toFixed(2)}`;

                    ctx.replyWithMarkdown(responseMsg, Markup.inlineKeyboard([
                        [Markup.button.callback('📊 Ver Relatório', 'get_report')]
                    ]));
                } catch (error) {
                    console.error('Save error:', error.message);
                    ctx.reply('❌ Erro ao salvar transação.');
                }
            } else {
                // Fallback for unrecognized text
                ctx.reply('🤔 Não entendi. Use os botões do teclado ou digite algo como "perdi 50" ou "saldo".', this.getMainMenu());
            }
        });

        // Webhook configuration
        const WEBHOOK_PATH = '/api/bot-webhook';
        const WEBHOOK_URL = `https://geral-fabricadesuperodssapi.r954jc.easypanel.host${WEBHOOK_PATH}`;

        this.bot.telegram.setWebhook(WEBHOOK_URL).then(() => {
            console.log(`✅ Webhook set to: ${WEBHOOK_URL}`);
        }).catch(err => console.error('❌ Failed to set webhook:', err.message));

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
            await this.bot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
            return true;
        } catch (error) {
            console.error(`Failed to send notification to ${userId}:`, error.message);
            return false;
        }
    }
}

module.exports = new BotService();
