const process = require('process');
const bcrypt = require('bcrypt'); // For password hashing and verification
const express = require('express');
const morgan = require('morgan');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const expressLayouts = require('express-ejs-layouts');
const { DataTypes, ValidationError } = require('sequelize');
require('dotenv').config();

const { apology, loginRequired, lookup, usd } = require('./helpers');

// Import models to ensure syncing
const Transaction = require('./models/Transaction');
const User = require('./models/User');

const app = express();

// console.log(`Secret key: ${process.env.SECRET_KEY}`) // The type of rabbit ears we use is important!
// Session middleware
app.use(session({
    store: new FileStore(),  // Use file-based session store
    secret: process.env.SECRET_KEY || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false, // Set to true in production with HTTPS
        maxAge: 24 * 60 * 60 * 1000  // 1 day in milliseconds, adjust as needed
    }
}));

// Make sure that responses are not cached; that every request gets a fresh response and the 
// client doesn't use any cached versions of previous responses
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');
    next();  // Proceed to the next middleware or route
});

// Middleware function to allow functions to be used globally across EJS templates
app.use((req, res, next) => {
    res.locals.session = req.session; // Make the session available in all EJS templates
    res.locals.usd = usd; // Make usd function available in all EJS templates. Similar to using a custom jinja filter in Flask
    next();
});

// app.use((req, res, next) => {
//     console.log("Session initialized:", req.session);  // This should log an empty session object initially
//     next();
// });

app.use(express.urlencoded({ extended: true }));  // Middleware function to parse form data

app.set('view engine', 'ejs'); // Set EJS as the defauly view engine
app.set('views', './views'); // Set the templates directory
app.use(expressLayouts);  // Enable express layouts
app.set('layout', 'layout');  // Set the default layout file. This refers to views/layout.ejs
app.use(express.static('public')); // Define directory for static files

// Enable HTTP request logging
app.use(morgan('dev'));  // 'dev' gives you concise colored output of requests

// Set up the index route
app.get('/', loginRequired, async (req, res) => {
    // Show portfolio of stocks
    const user = await User.findOne({
        where: {
            id: req.session.user_id // Grab the id from the session object storing the id of the logged in user
        }
    });
    
    // Check if user exists
    if (!user) {
        return apology(res, "Error when trying to retrieve username from logged in user:");
    }    

    const username = user.dataValues.username;
    const cash = user.dataValues.cash;
    console.log(username, cash); // For debugging purposes

    res.render('index', {title: 'Index'});
});

// Set up the login route GET
app.get('/login', (req, res) => {
    // console.log("Login page is being rendered"); // For debugging the faulty redirect from /redirect

    // Clear the current session
    req.session.destroy(err => {
        if (err) {
            console.log("Error clearing session:", err);
            return apology(res, "An error occurred while clearing the session. Please try again.");
        }
        res.render('login', { title: 'Login Page'});
    });
});

// Set up the login route POST
app.post('/login', async (req, res) => {
    // Ensure username and password are provided
    if (!req.body.username) return apology(res, "Must provide username!");
    if (!req.body.password) return apology(res, "Must provide password!");

    try {
        // Query the database for the entered username
        const rows = await User.findAll({
            where: {
                username: req.body.username
            }
        });

        // Ensure the username exists and password is correct
        if (rows.length !== 1) {
            return apology(res, "Invalid username and/or password!");
        }

        const passwordMatch = await bcrypt.compare(req.body.password, rows[0].dataValues.hash);
        if (!passwordMatch) {
            return apology(res, "Invalid username and/or password!");
        }

        // Store user ID in the session object
        req.session.user_id = rows[0].dataValues.id;

        // Redirect to home page
        return res.redirect('/');
        
    } catch (error) {
        console.log('Error when logging in:', error);
        res.status(500).send('Server error');
    }
});


// Set up the register route GET
app.get('/register', (req, res) => {
    res.render('register', { title: 'Register Page' });
});

// Set up the register route POST
app.post('/register', async (req, res) => {
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

    // If all validation passed; Try to insert the user into the database
    // A ValueError exception will be raised if we try to INSERT a duplicate username
    try {
        // Hash the password asynchronously
        const hashedPassword = await bcrypt.hash(req.body.password, 10); // 10 salt rounds is a recommended default for security

        // Create the new user with the hashed password
        const newUser = await User.create({
            username: req.body.username,
            hash: hashedPassword
        });

        // res.json(newUser); // Send the newly created user as a response

        // Redirect user to login page
        res.redirect('/login');

        
    } catch (error) {
        console.log('Error when creating user:', error);

        if (error.name === 'SequelizeUniqueConstraintError') {
            return apology(res, "Username already exists!");
        }

        res.status(500).send('Server error');
    }
});

app.get('/buy', loginRequired, (req, res) => {
    res.render('buy', { title: 'Buy Options' });
});

app.post('/buy', loginRequired, async (req, res) => {
    const symbol = req.body.symbol;
    if (!symbol) return apology(res, "Must provide symbol!");

    const shares_input = req.body.shares;

    // Ensure shares were submitted and valid
    if (!shares_input || isNaN(Number(shares_input)) || parseInt(shares_input) < 1) {
        return apology(res, "Must provide a valid amount of shares as an integer!");
    } 

    const shares = parseInt(shares_input);

    try {
        // Ensure valid symbol and that price is available for the symbol
        const lookup_info = await lookup(symbol);

        if (!lookup_info) {
            return apology(res, `Price not available for ${symbol}!`);
        }

        const price = lookup_info.price;
        
        const total_cost = price * shares;

        // Get cash amount from the current logged in user
        const user = await User.findOne({
            where: {
                id: req.session.user_id
            }
        });

        if (!user) return apology(res, "Error when trying to fetch the current user!");
        const cash = user.dataValues.cash;
        const username = user.dataValues.username; // Will also be used for the transaction to be inserted in the database

        // Check if user has enough cash
        if (total_cost > cash) return apology(res, "Insufficient funds to complete purchase!");

        // With all checks done, try to insert the transaction into the database
        const newTransaction = await Transaction.create({
            username: username,
            type: 'buy',
            symbol: symbol,
            price: price,
            shares: shares
        });

        // Try to update the cash amount for current user
        const cash_new = cash - total_cost;
        if (!cash_new) return apology(res, "Could not calculate new cash amount for user, try again later!")

        const [rowsUpdated] = await User.update(
            { cash: cash_new },
            { where: { id: req.session.user_id } }
        );

        if (rowsUpdated === 0) {
            console.log("No user found with the specified ID.");
        }

        // If this point is reached, print a success message to the terminal at least
        console.log(`Succesfully bought ${shares} shares from ${symbol} for a total cost of ${total_cost}!`)
        
        return res.redirect('/');
    } catch (error) {
        console.error("Error when looking up symbol:", error);
        return apology(res, "Error when looking up symbol.");
    }
});

app.get('/add_cash', loginRequired, (req, res) => {
    res.render('add_cash', { title: 'Add additional cash' });
});

app.post('/add_cash', loginRequired, async (req, res) => {
    // Ensure cash amount was submitted
    const cash = req.body.cash;
    if (!cash) return apology(res, "Could not retrieve cash amount from form!");

    function validCash(cash) {
        
    }
});


// Listen to the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

