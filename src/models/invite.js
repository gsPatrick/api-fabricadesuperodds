const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const Invite = sequelize.define('Invite', {
        token: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        days: {
            type: DataTypes.INTEGER,
            defaultValue: 30
        },
        used: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false
        }
    });

    return Invite;
};
