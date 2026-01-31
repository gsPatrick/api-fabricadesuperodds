const TransactionService = require('./transaction.service');
const UserService = require('../user/user.service');

class TransactionController {
    // Middleware-like check should happen before this, but we can double check here.
    // The Bot will call this.
    async createTransaction(req, res) {
        try {
            const { user_id_telegram, amount, description, type, username } = req.body;

            // 1. Verify Authorization
            const user = await UserService.getUser(user_id_telegram);

            // If user doesn't exist, check if we should create (maybe they were added by username?)
            if (!user) {
                // If the user sends a message, we should try to sync/check if they were pre-authorized by username?
                // But the ID is the source of truth.
                // If the admin authorized by username, we need to associate the ID now!
                if (username) {
                    const existingUserByUsername = await UserService.getUserByUsername(username);
                    if (existingUserByUsername && !existingUserByUsername.id_telegram) {
                        // This case is actually impossible with our current schema (ID is PK). 
                        // So if user not found by ID, they are effectively new or unauthorized.
                    }
                }
                return res.status(403).json({ error: "User not authorized." });
            }

            if (!user.allowed) {
                return res.status(403).json({ error: "User not authorized." });
            }

            // Sync username if changed
            if (username && user.username !== username) {
                await UserService.updateUsername(user_id_telegram, username);
            }

            await UserService.updateLastInteraction(user_id_telegram);

            // 2. Execute
            // Ensure positive/negative sign logic
            // The service receives raw amount. We should format it here?
            // "amount: ... positivo para ganhos, negativo para perdas".
            let finalAmount = parseFloat(amount);
            if (type === 'perda' && finalAmount > 0) finalAmount = -finalAmount;
            if (type === 'ganho' && finalAmount < 0) finalAmount = -finalAmount; // Force positive

            const transaction = await TransactionService.createTransaction(user_id_telegram, finalAmount, description, type);

            res.json(transaction);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getBalance(req, res) {
        try {
            const { user_id_telegram } = req.params; // or query

            const user = await UserService.getUser(user_id_telegram);
            if (!user || !user.allowed) return res.status(403).json({ error: "User not authorized." });
            await UserService.updateLastInteraction(user_id_telegram);

            const balance = await TransactionService.getBalance(user_id_telegram);
            res.json({ balance });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getReport(req, res) {
        try {
            const { user_id_telegram } = req.params;
            const { startDate, endDate } = req.query;

            const user = await UserService.getUser(user_id_telegram);
            if (!user || !user.allowed) return res.status(403).json({ error: "User not authorized." });
            await UserService.updateLastInteraction(user_id_telegram);

            const report = await TransactionService.generateReport(user_id_telegram, startDate, endDate);
            res.json({ report });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TransactionController();
