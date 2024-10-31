const { Sequelize } = require('sequelize');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './finance.db',
    logging: console.log // Enables detailed SQL logging instead of const sqlite3 = require('sqlite3').verbose();
});

module.exports = sequelize;