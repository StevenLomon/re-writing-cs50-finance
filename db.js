const sqlite3 = require('sqlite3').verbose(); // Verbose for more detailed logs in local development
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './finance.db'
});

module.exports = sequelize;