const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing. Add it to your hosting Environment Variables or .env file.");
}

const useSSL = String(process.env.PGSSL || "true").toLowerCase() !== "false";

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function ensureDatabase() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cases (
      id BIGSERIAL PRIMARY KEY,
      file_number TEXT NOT NULL DEFAULT '',
      client_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS powers (
      id BIGSERIAL PRIMARY KEY,
      file_number TEXT NOT NULL DEFAULT '',
      client_name TEXT NOT NULL DEFAULT '',
      power_number TEXT NOT NULL DEFAULT '',
      documentation_authority TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_cases_file_number ON cases(file_number);
    CREATE INDEX IF NOT EXISTS idx_cases_client_name ON cases(client_name);
    CREATE INDEX IF NOT EXISTS idx_powers_file_number ON powers(file_number);
    CREATE INDEX IF NOT EXISTS idx_powers_client_name ON powers(client_name);
    CREATE INDEX IF NOT EXISTS idx_powers_power_number ON powers(power_number);
  `);
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, ensureDatabase, close };
