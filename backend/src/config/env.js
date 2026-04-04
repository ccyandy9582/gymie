const path = require("path");
const dotenv = require("dotenv");

dotenv.config();
dotenv.config({
  path: path.resolve(process.cwd(), "..", ".env"),
});

function buildDatabaseUrlFromParts() {
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || "5432";
  const db = process.env.POSTGRES_DB;
  const hasPassword = password !== undefined && password !== null;

  if (!user || !host || !db || !hasPassword) {
    return null;
  }

  const url = new URL("postgresql://localhost");
  url.username = user;
  if (password !== "") {
    url.password = password;
  }
  url.hostname = host;
  url.port = String(port);
  url.pathname = `/${db}`;
  return url.toString();
}

function requireNumber(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function resolveDatabaseUrl() {
  const explicitDatabaseUrl = process.env.DATABASE_URL;
  if (explicitDatabaseUrl) {
    try {
      // Validate explicit URL first.
      new URL(explicitDatabaseUrl);
      return explicitDatabaseUrl;
    } catch (_error) {
      const fallbackUrl = buildDatabaseUrlFromParts();
      if (fallbackUrl) {
        console.warn("[env] DATABASE_URL is invalid. Falling back to POSTGRES_* variables.");
        return fallbackUrl;
      }
      return explicitDatabaseUrl;
    }
  }

  return buildDatabaseUrlFromParts();
}

function resolveDatabaseSslConfig() {
  const pgSslMode = String(process.env.PGSSLMODE || "").toLowerCase();
  const sslRequestedByMode = ["require", "verify-ca", "verify-full"].includes(pgSslMode);
  const sslEnabled = process.env.DATABASE_SSL !== undefined
    ? parseBoolean(process.env.DATABASE_SSL, false)
    : sslRequestedByMode;

  if (!sslEnabled) {
    return undefined;
  }

  return {
    rejectUnauthorized: parseBoolean(process.env.DATABASE_SSL_REJECT_UNAUTHORIZED, false),
  };
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: requireNumber(process.env.BACKEND_PORT || process.env.PORT, 4101),
  DATABASE_URL: resolveDatabaseUrl(),
  DATABASE_SSL: resolveDatabaseSslConfig(),
  JWT_SECRET: process.env.JWT_SECRET || "development-only-secret-change-me",
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "30d",
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || "",
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514",
  AI_TIMEOUT_MS: requireNumber(process.env.AI_TIMEOUT_MS, 30000),
  AI_MAX_RETRIES: requireNumber(process.env.AI_MAX_RETRIES, 2),
};

if (!env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required (or set POSTGRES_* variables).");
}

module.exports = {
  env,
};
