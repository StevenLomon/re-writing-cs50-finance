const { DataTypes } = require('sequelize');
const sequelize = require('../db.js'); // Import the Sequelize instance from db.js

// Define the User model (which maps to the 'users' table)
const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    username: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    hash: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    cash: {
        type: DataTypes.DECIMAL(10, 2), // Maps to NUMERIC in SQLite
        allowNull: false,
        defaultValue: 10000.00
    }
}, {
    timestamps: false  // Disable Sequelize's automatic timestamps
});

// Export the model
module.exports = User;
