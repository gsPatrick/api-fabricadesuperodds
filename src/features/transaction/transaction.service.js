const { Transaction, User, sequelize } = require('../../models');
const { Op } = require('sequelize');

class TransactionService {
    async createTransaction(user_id_telegram, amount, description, type) {
        // Validation handled by controller or here? Basic check:
        if (!['ganho', 'perda'].includes(type)) throw new Error("Invalid transaction type");

        return await Transaction.create({
            user_id_telegram,
            amount,
            description,
            type,
            date: new Date()
        });
    }

    async getTransactionsByUser(user_id_telegram, startDate, endDate) {
        const where = {
            user_id_telegram,
        };

        if (startDate && endDate) {
            where.date = {
                [Op.between]: [startDate, endDate]
            };
        }

        return await Transaction.findAll({ where, order: [['date', 'ASC']] });
    }

    async getBalance(user_id_telegram, startDate, endDate) {
        const transactions = await this.getTransactionsByUser(user_id_telegram, startDate, endDate);

        let balance = 0;
        transactions.forEach(t => {
            // Assuming amount is positive in DB, but type defines sign.
            // Or amount is signed? Prompt said: "O valor deve ser extraído da mensagem e salvo... (positivo para ganhos, negativo para perdas)" in one place?
            // "amount: (DECIMAL, NOT NULL) O valor da transação (positivo para ganhos, negativo para perdas)." -> THIS IS THE RULE.
            // So we just sum them up? 
            // Wait, "Ganhei R$ [valor]" and "Perdi R$ [valor]".
            // If user says "Perdi 100", should I store -100 or 100 with type 'perda'?
            // The prompt says "amount... (positivo para ganhos, negativo para perdas)".
            // So I should ensure 'perda' transactions have negative amount.
            balance += parseFloat(t.amount);
        });

        return balance;
    }

    async generateReport(user_id_telegram, startDate, endDate) {
        const transactions = await this.getTransactionsByUser(user_id_telegram, startDate, endDate);
        const totalBalance = await this.getBalance(user_id_telegram, startDate, endDate);

        let report = `📅 **Resumo do Período**\n`;
        report += `─────────────────────\n\n`;

        if (transactions.length === 0) {
            report += `*Nenhuma movimentação encontrada.*`;
        } else {
            transactions.forEach(t => {
                const date = new Date(t.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                const emoji = t.amount < 0 ? '📉' : '📈';
                const sign = t.amount < 0 ? '-' : '+';
                const amount = Math.abs(t.amount).toFixed(2);

                // Clean description (remove the "perdi" keyword if present, or just use as is)
                let desc = t.description || '';
                if (desc.length > 20) desc = desc.substring(0, 17) + '...';

                report += `${emoji} **${date}** | ${sign}R$ ${amount}\n`;
                report += `└ _${desc}_\n\n`;
            });
        }

        report += `─────────────────────\n`;
        report += `💰 **SALDO TOTAL: R$ ${totalBalance.toFixed(2)}**`;

        return report;
    }

    async getHistoryJSON(user_id_telegram) {
        const transactions = await Transaction.findAll({
            where: { user_id_telegram },
            order: [['date', 'DESC']],
            limit: 50
        });
        const balance = await this.getBalance(user_id_telegram);
        return { transactions, balance };
    }
}

module.exports = new TransactionService();
