const process = require('process');
const bcrypt = require('bcrypt'); // For password hashing and verification
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const FileStore = require('session-file-store')(session);
const { DataTypes, ValidationError } = require('sequelize');
require('dotenv').config();

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
app.use(express.urlencoded({ extended: true }));  // Middleware function to parse form data

app.set('view engine', 'ejs'); // Set EJS as the defauly view engine
app.set('views', './views'); // Set the templates directory
app.use(expressLayouts);  // Enable express layouts
app.set('layout', 'layout');  // Set the default layout file. This refers to views/layout.ejs
app.use(express.static('public')); // Define directory for static files

// Set up the index route
app.get('/', loginRequired, (req, res) => {
    res.render('index', {title: 'Index'});
});

// Set up the login route GET
app.get('/login', (req, res) => {
    console.log("Login page is being rendered"); // For debugging the faulty redirect from /redirect
    res.render('login', { title: 'Login Page' });
});

// Set up the login route POST
app.post('/login', apology, (req, res) => {
    // Ensure username was submitted
    if (!req.body.username) {
        return apology(res, "Must provide username!");
    }

    // Ensure password was submitted
    else if (!req.body.password) {
        return apology(res, "Must provide password!");
    }
});

// Set up the register route GET
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register Page' });
});

// Set up the register route POST
app.post('/register', (req, res) => {
    // Ensure username was submitted
    if (!req.body.username) {
        return apology(res, "Must provide username!");
    }

    // Ensure password and confirmation was submitted
    else if (!req.body.password || !req.body.confirmation) {
        return apology(res, "Must provide password!");
    }

    // Ensure that passwords match
    else if (req.body.password !== req.body.confirmation) {
        return apology(res, "The provided passwords must match!");
    }

    // Try to insert the user into the database
    // A ValueError exception will be raised if we try to INSERT a duplicate username


    // Redirect user to login page
    res.redirect('/login');
});

// Listen to the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

