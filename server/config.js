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
  SESSION_SECRET: process.env.SESSION_SECRET || '50b8f0c24890e9e085978e0799c057f3a5b47414d4fff16605a33c1d848dba4d769f85cbcc0c67226e4389d2afbdcb787aabb04f9f017041e9f55bf2cbd6833d',
  ENCRYPTION_KEY: (process.env.ENCRYPTION_KEY && /^[0-9a-fA-F]{64}$/.test(process.env.ENCRYPTION_KEY.trim()))
    ? process.env.ENCRYPTION_KEY.trim()
    : '72fcf74506f8c961f6454b9e37ab660f1101275b1a9dcc03a3537401fee8a301',
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI: process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:3001/api/auth/linkedin/callback',
  DB_PATH: process.env.DB_PATH || path.resolve(__dirname, 'data/linkedin-scheduler.db'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};

// Ensure ENCRYPTION_KEY format is valid (must be 64 hex characters = 32 bytes)
if (!/^[0-9a-fA-F]{64}$/.test(config.ENCRYPTION_KEY)) {
  config.ENCRYPTION_KEY = '72fcf74506f8c961f6454b9e37ab660f1101275b1a9dcc03a3537401fee8a301';
}

// Warn about missing LinkedIn credentials (not fatal — app can still start for development)
if (!config.LINKEDIN_CLIENT_ID || !config.LINKEDIN_CLIENT_SECRET) {
  console.warn('[Config Warning] LINKEDIN_CLIENT_ID and/or LINKEDIN_CLIENT_SECRET are not set. LinkedIn OAuth will not work.');
}

module.exports = config;
