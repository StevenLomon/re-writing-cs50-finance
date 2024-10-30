const { DataTypes } = require('sequelize');
const sequelize = require('../db.js'); // Import the Sequelize instance from db.js
const User = require('./User.js');

// Define the Transaction model (which maps to the 'transactions' table)
const Transaction = sequelize.define('Transaction', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    type: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    symbol: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    price: {
        type: DataTypes.REAL,  // Maps to REAL in SQLite
        allowNull: false
    },
    shares: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW  // Use current timestamp as default
    }
}, {
    timestamps: false  // Disable Sequelize's automatic timestamps
});

// Set up the association
User.hasMany(Transaction, { foreignKey: 'userId' }); // One user can have *many* transactions
Transaction.belongsTo(User, { foreignKey: 'userId' }); // A transaction can only belong to *one* user

// Export the model
module.exports = Transaction;
