const process = require('process');
const sqlite3 = require('sqlite3').verbose(); // Verbose for more detailed logs in local development
const bcrypt = require('bcrypt'); // For password hashing and verification
const express = require('express');
const flash = require('connect-flash');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const { Sequelize, DataTypes, ValidationError } = require('sequelize');
require('dotenv').config();

const sequelize = Sequelize({
    dialect: 'sqlite',
    storage: './finance.db'
})

const { apology, loginRequired, lookup, usd } = require('./helpers');

const app = express();

// Make the usd function available globally in all EJS templates by adding it to res.locals
// Similar to using a custom jinja filter in Flask
app.use((req, res, next) => {
    res.locals.usd = usd;
});

// Make sure that responses are not cached; that every request gets a fresh response and the 
// client doesn't use any cached versions of previous responses
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');
    next();  // Proceed to the next middleware or route
  });

console.log(`Secret key: ${process.env.SECRET_KEY}`) // The type of rabbit ears we use is important!

app.use(flash());
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    store: new FileStore(),  // Use filesystem to store session data
    cookie: { maxAge: null }  // Session expires when the browser is closed
  }));

