/**
 * Encryption Utilities
 * Provides AES-256-GCM encryption and decryption using the ENCRYPTION_KEY from config.
 * Format: iv:authTag:ciphertext (all hex-encoded)
 */

const crypto = require('crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag

// Derive the key buffer from the hex-encoded config key
const KEY = Buffer.from(config.ENCRYPTION_KEY, 'hex');

/**
 * Encrypt plaintext using AES-256-GCM.
 * @param {string} text - The plaintext to encrypt
 * @returns {string} Encrypted string in format "iv:authTag:ciphertext" (hex-encoded)
 */
function encrypt(text) {
  if (!text) {
    throw new Error('Cannot encrypt empty or null value');
  }

  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt an encrypted string produced by encrypt().
 * @param {string} encryptedText - The encrypted string in "iv:authTag:ciphertext" format
 * @returns {string} The decrypted plaintext
 */
function decrypt(encryptedText) {
  if (!encryptedText) {
    throw new Error('Cannot decrypt empty or null value');
  }

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format. Expected "iv:authTag:ciphertext"');
    }

    const [ivHex, authTagHex, ciphertext] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    if (error.message.includes('Invalid encrypted text format')) {
      throw error;
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = { encrypt, decrypt };
