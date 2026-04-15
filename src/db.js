const { Pool } = require("pg");
require("dotenv").config();

const useSsl =
  process.env.POSTGRES_SSL === "true" ||
  process.env.NODE_ENV === "production" ||
  Boolean(process.env.DATABASE_URL?.includes("sslmode=require"));

const baseConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.POSTGRES_HOST || "localhost",
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || "taskuser",
      password: process.env.POSTGRES_PASSWORD || "taskpass",
      database: process.env.POSTGRES_DB || "taskdb",
    };

const pool = new Pool({
  ...baseConfig,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

module.exports = pool;
