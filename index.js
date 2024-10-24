const process = require('process');
const sqlite3 = require('sqlite3').verbose(); // Verbose for more detailed logs in local development
const bcrypt = require('bcrypt'); // For password hashing and verification
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const FileStore = require('session-file-store')(session);
const { Sequelize, DataTypes, ValidationError } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './finance.db'
})

const { apology, loginRequired, lookup, usd } = require('./helpers');

const app = express();

// Make sure that responses are not cached; that every request gets a fresh response and the 
// client doesn't use any cached versions of previous responses
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');
    next();  // Proceed to the next middleware or route
});

// Enable HTTP request logging
app.use(morgan('dev'));  // 'dev' gives you concise colored output of requests

//console.log(`Secret key: ${process.env.SECRET_KEY}`) // The type of rabbit ears we use is important!
app.use(flash());
app.use(session({
    secret: process.env.SECRET_KEY,
    resave: false,
    saveUninitialized: true,
    store: new FileStore(),  // Use filesystem to store session data
    cookie: { maxAge: null }  // Session expires when the browser is closed
}));

// Middleware function to allow functions to be used globally across EJS templates
app.use((req, res, next) => {
    res.locals.session = req.session; // Make the session available in all EJS templates
    res.locals.messages = req.flash(); // Make flash messages available in all EJS templates
    res.locals.usd = usd; // Make usd function available in all EJS templates. Similar to using a custom jinja filter in Flask
    next();
});

app.set('view engine', 'ejs'); // Set EJS as the defauly view engine
app.set('views', './views'); // Set the templates directory
app.use(expressLayouts);  // Enable express layouts
app.set('layout', 'layout');  // Set the default layout file. This refers to views/layout.ejs
app.use(express.static('public')); // Define directory for static files

// Set up the index route
app.get('/', loginRequired, (req, res) => {
    res.render('index', {title: 'Index'});
});

// Set up the login route
app.get('/login', (req, res) => {
    res.render('login', { title: 'Login Page' });
});

// Listen to the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

