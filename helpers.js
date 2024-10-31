const axios = require('axios'); // To make HTTP requests, similar to requests.get
const { escapeRegExp } = require('./utils');  // You can modularize utilities like escapeRegExp

// Apology function
function escape(s) {
    if (typeof s !== 'string') {
        return s;  // If it's not a string, just return it as is
    }

    const replacements = [
        ["-", "--"], [" ", "-"], ["_", "__"], ["?", "~q"], ["%", "~p"], ["#", "~h"], ["/", "~s"], ['"', "''"]
    ];

    replacements.forEach(([oldChar, newChar]) => {
        s = s.replace(new RegExp(escapeRegExp(oldChar), 'g'), newChar);
    });
    return s;
}

function apology(res, message, code = 400) {
  const escapedMessage = escape(message);
  res.status(code).render('apology', { top: code, bottom: escapedMessage, title: "Error" });
}

// Login required middleware
function loginRequired(req, res, next) {
  if (!req.session.user_id) {
    return res.redirect('/login');
  }
  next();
}

// Lookup function (became unathorized from Yahoo Finance API for some reason so switched to Alpha Vantage)
async function lookup(symbol) {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'request' },
      responseType: 'json'
    });
    
    const data = response.data;

    // Rate limit handling
    if (data.Information && data.Information.toLowerCase().includes("rate limit")) {
      return { error: "Rate limit exceeded. Please try again later." };
    }

    // Extract the latest daily closing price
    const latestPrice = parseFloat(Object.values(data['Time Series (Daily)'])[0]['4. close']);
    return { price: latestPrice.toFixed(2) };

  } catch (error) {
    console.error("Error retrieving data from Alpha Vantage:", error.message);
    return { error: "An error occurred while fetching data." };
  }
}


// Format as USD
function usd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

module.exports = { apology, loginRequired, lookup, usd };
