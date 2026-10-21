const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const { Pool, types } = require("pg");

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;
