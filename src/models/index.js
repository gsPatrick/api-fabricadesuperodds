const sequelize = require('../config/database');
const User = require('./user');
const Transaction = require('./transaction');
const Invite = require('./invite')(sequelize);

// Define associations
User.hasMany(Transaction, { foreignKey: 'user_id_telegram', sourceKey: 'id_telegram' });
Transaction.belongsTo(User, { foreignKey: 'user_id_telegram', targetKey: 'id_telegram' });

module.exports = {
    sequelize,
    User,
    Transaction,
    Invite
};
