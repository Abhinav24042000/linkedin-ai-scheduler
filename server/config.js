/**
 * Application Configuration
 * Loads environment variables with sensible defaults and validates required values.
 */

const path = require('path');
const dotenv = require('dotenv');

// Load .env from root or server directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const config = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/auth/linkedin/callback',
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, 'data/linkedin-scheduler.db'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

// Validate required environment variables
const requiredVars = [
  { key: 'SESSION_SECRET', value: config.SESSION_SECRET, message: 'SESSION_SECRET is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"' },
  { key: 'ENCRYPTION_KEY', value: config.ENCRYPTION_KEY, message: 'ENCRYPTION_KEY is required. Must be a 32-byte hex string (64 hex chars). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"' },
];

for (const { key, value, message } of requiredVars) {
  if (!value) {
    throw new Error(`[Config Error] ${message}`);
  }
}

// Validate ENCRYPTION_KEY format (must be 64 hex characters = 32 bytes)
if (!/^[0-9a-fA-F]{64}$/.test(config.ENCRYPTION_KEY)) {
  throw new Error('[Config Error] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

// Warn about missing LinkedIn credentials (not fatal — app can still start for development)
if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) {
  console.warn('[Config Warning] LINKEDIN_CLIENT_ID and/or LINKEDIN_CLIENT_SECRET are not set. LinkedIn OAuth will not work.');
}

module.exports = config;
