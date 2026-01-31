const { User, Transaction, sequelize } = require('../../models');
const { Op } = require('sequelize');

class AnalyticsService {
    async getDashboardStats() {
        const totalUsers = await User.count();
        const activeUsers = await User.count({ where: { allowed: true } });
        const blockedUsers = await User.count({ where: { allowed: false } });

        // Users who interacted but are blocked (Pending?)
        // Assuming "Last Interaction" exists means they tried.
        const pendingUsers = await User.count({
            where: {
                allowed: false,
                last_interaction: { [Op.not]: null }
            }
        });

        // Financials
        // Sum of all transactions (positive/negative)
        const totalVolumeResult = await Transaction.findOne({
            attributes: [[sequelize.fn('sum', sequelize.col('amount')), 'total']],
            raw: true
        });

        return {
            users: {
                total: totalUsers,
                active: activeUsers,
                blocked: blockedUsers,
                pending: pendingUsers
            },
            financials: {
                totalVolume: totalVolumeResult?.total || 0
            }
        };
    }
}

module.exports = new AnalyticsService();
