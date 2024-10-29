const axios = require('axios'); // To make HTTP requests, similar to requests.get
const { v4: uuidv4 } = require('uuid');
const { escapeRegExp } = require('./utils');  // You can modularize utilities like escapeRegExp

// Custom subDays function since date-fns sucks and causes issues
function subDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

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
      console.log("API response:", response.data); // Debugging line

      if (!response.data["Time Series (5min)"]) {
        console.log("Invalid or missing data:", response.data);
        return null;
    }

    const latestPrice = parseFloat(Object.values(response.data["Time Series (5min)"])[0]["4. close"]);
    return { price: latestPrice.toFixed(2) };

  } catch (error) {
      console.error("Error retrieving data from Alpha Vantage:", error.message);
      return null;
  }
}

// Format as USD
function usd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

module.exports = { apology, loginRequired, lookup, usd };
