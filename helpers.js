const axios = require('axios'); // To make HTTP requests, similar to requests.get
const { v4: uuidv4 } = require('uuid');
const { escapeRegExp } = require('./utils');  // You can modularize utilities like escapeRegExp

// Apology function
function escape(s) {
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
  res.status(code).render('apology', { top: code, bottom: escapedMessage });
}

// Login required middleware
function loginRequired(req, res, next) {
  if (!req.session.user_id) {
    return res.redirect('/login');
  }
  next();
}

// Lookup function (Yahoo Finance API)
async function lookup(symbol) {
  symbol = symbol.toUpperCase();
  const end = new Date();
  const start = subDays(end, 7);
  
  const url = `https://query1.finance.yahoo.com/v7/finance/download/${encodeURIComponent(symbol)}` +
              `?period1=${Math.floor(start.getTime() / 1000)}` +
              `&period2=${Math.floor(end.getTime() / 1000)}` +
              `&interval=1d&events=history&includeAdjustedClose=true`;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Your-App-Name' },
      cookies: { session: uuidv4() },
      responseType: 'text'
    });

    const lines = response.data.split('\n');
    const lastLine = lines[lines.length - 2];
    const [date, open, high, low, close, adjClose, volume] = lastLine.split(',');
    const price = parseFloat(adjClose);
    return { price: price.toFixed(2), symbol };

  } catch (error) {
    console.error(error);
    return null;
  }
}

// Format as USD
function usd(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

module.exports = { apology, loginRequired, lookup, usd };
