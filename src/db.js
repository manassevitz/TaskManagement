const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "taskuser",
  password: process.env.POSTGRES_PASSWORD || "taskpass",
  database: process.env.POSTGRES_DB || "taskdb",
});

module.exports = pool;
