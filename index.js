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
const sequelize = require('./db.js');

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
    const userId = req.session.user_id;
    const user = await User.findOne({ where: { id: userId } });
    if (!user) return apology(res, "Error when trying to fetch the current user!") 

    const username = user.dataValues.username;
    const cash = user.dataValues.cash;

    try {
        // Aggregate transactions for current user
        const aggregatesTotal = await sequelize.query(`
            SELECT buy.symbol, (buy.total_shares - IFNULL(sell.total_shares, 0)) AS total_shares
            FROM
                (SELECT symbol, SUM(shares) AS total_shares FROM transactions WHERE type='buy' AND username = :username GROUP BY symbol) AS buy
            LEFT JOIN
                (SELECT symbol, SUM(shares) AS total_shares FROM transactions WHERE type='sell' AND username = :username GROUP BY symbol) AS sell
            ON buy.symbol = sell.symbol;
        `, {
            replacements: { username: username },
            type: sequelize.QueryTypes.SELECT
        });

        // Process each aggregate to calculate current prices and total values
        const rendered_transactions = await Promise.all(aggregatesTotal.map(async (aggregate) => {
            const symbol = aggregate.symbol;
            const shares = aggregate.total_shares;
            const lookupInfo = await lookup(symbol);

            if (lookupInfo) {
                const currentPrice = lookupInfo.price;
                const totalValue = shares * currentPrice;
                return {
                    symbol,
                    shares,
                    current_price: currentPrice,
                    total_value: totalValue
                };
            }
            return null; // If lookup fails, exclude the transaction
        }));

        // Filter out any null transactions from lookup failures
        const validTransactions = rendered_transactions.filter(txn => txn !== null);

        // Calculate grand total: cash + total value of all stocks
        const grand_total = validTransactions.reduce((total, txn) => total + txn.total_value, cash);

        // Render the index view with transactions, cash, and grand total
        res.render('index', {
            title: 'Index',
            transactions: validTransactions,
            cash,
            grand_total
        });

    } catch (error) {
        console.error("Error while calculating transaction data:", error);
        return apology(res, "Could not load portfolio.");
    }
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

        // Render the loading page for login
        res.render('loading', { title: "Logging In", action: "in", redirectTo: "/" });
        
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

    try { //1st try / catch: Symbol lookup
        const lookup_info = await lookup(symbol);

        if (!lookup_info) return apology(res, `Price not available for ${symbol}!`);

        const price = lookup_info.price; 
        const total_cost = price * shares;

        try { // 2nd try / catch: Database operations
            const user = await User.findOne({ where: { id: req.session.user_id } });
            if (!user) return apology(res, "Error when trying to fetch the current user!");

            const cash = user.dataValues.cash;
            const username = user.dataValues.username;
            const type = 'buy';

            // Check if user has enough cash
            if (total_cost > cash) return apology(res, "Insufficient funds to complete purchase!");

            // Insert the transaction and update cash
            await Transaction.create({ username, type, symbol, price, shares });
            const cash_new = cash - total_cost;

            const [rowsUpdated] = await User.update({ cash: cash_new }, { where: { id: req.session.user_id } });
            if (rowsUpdated === 0) return apology(res, "Error updating cash balance.");

            // If this point is reached, print a success message to the terminal at least
            console.log(`Succesfully bought ${shares} shares from ${symbol} for a total cost of $${total_cost}!`);
            return res.redirect('/');
        }
        catch (dbError) {
            console.error("Error during database operation:", dbError);
            return apology(res, "Database error during transaction.");
        }
        
    } catch (lookupError) {
        console.error("Error when looking up symbol:", lookupError);
        return apology(res, "Error retrieving symbol information.");
    }
});

app.get('/add_cash', loginRequired, (req, res) => {
    res.render('add_cash', { title: 'Add additional cash' });
});

app.post('/add_cash', loginRequired, async (req, res) => {
    // Only allow numbers, commas, and decimal points
    function validCash(cash_input) {
        return [...cash_input].every(c => !isNaN(Number(c)) || [",", "."].includes(c));
    }

    // Ensure cash amount was submitted
    const cash_input = req.body.cash;

    if (!cash_input || !validCash(cash_input) || Number(cash_input) <= 0) {
        return apology(res, "Must provide a valid amount of cash!")
    }
    const cash = Number(cash_input);

    try {
        const user = await User.findOne({ where: { id: req.session.user_id } });
        if (!user) return apology(res, "Error when trying to fetch the current user!")

        const cash_old = user.dataValues.cash;
        const cash_new = cash_old + cash;

        // Update user cash in the database
        const [rowsUpdated] = await User.update({ cash: cash_new }, { where: { id: req.session.user_id } })
        if (rowsUpdated === 0) return apology(res, "Error updating cash balance.");

        console.log(`Succesfully added $${cash} to wallet!`)
        return res.redirect('/')

    } catch(dbError) {
        console.error("Error during database operation:", dbError);
        return apology(res, "Database error during transaction.");
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Logout error:", err);
            return apology(res, "An error occurred while logging out.");
        }
        // Render the loading page for logout
        res.render('loading', { title: "Logging Out", action: "out", redirectTo: "/login" });
    });
});

// Listen to the server
app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});

