const process = require('process');
const sqlite3 = require('sqlite3').verbose(); // Verbose for more detailed logs in local development
const bcrypt = require('bcrypt'); // For password hashing and verification
const express = require('express');
const flash = require('connect-flash');
const session = require('express-session');
const { Sequelize, DataTypes, ValidationError } = require('sequelize');
require('dotenv').config();

const sequelize = Sequelize({
    dialect: 'sqlite',
    storage: './finance.db'
})
const app = express();

console.log(`Secret key: ${process.env.SECRET_KEY}`) // The type of rabbit ears we use is important!

app.use(flash());
app.use(session({secret: process.env.SECRET_KEY, resave: false, saveUninitialized: true }))

function loginRequired(req, res, next) {
    if (!req.session.user_id) {
      return res.redirect('/login');
    }
    next();
  }

