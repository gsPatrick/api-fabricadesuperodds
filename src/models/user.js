const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
    id_telegram: {
        type: DataTypes.BIGINT, // Use BIGINT for Telegram IDs as they can exceed INTEGER range
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    username: {
        type: DataTypes.STRING,
        allowNull: true
    },
    allowed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    start_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    end_date: {
        type: DataTypes.DATE,
        allowNull: true
    },
    last_interaction: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true
});

module.exports = User;
