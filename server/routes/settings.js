/**
 * Settings Routes
 * Manages user settings, primarily the Gemini API key.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { encrypt, decrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

// All settings routes require authentication
router.use(requireAuth);

/**
 * GET /api/settings
 * Returns the current settings for the authenticated user.
 * Shows whether a Gemini API key is configured and a masked version of it.
 */
router.get('/', (req, res) => {
  try {
    const settings = db.prepare(`
      SELECT gemini_api_key_encrypted FROM settings WHERE user_id = ?
    `).get(req.user.id);

    let geminiKeyConfigured = false;
    let geminiKeyMasked = null;

    if (settings && settings.gemini_api_key_encrypted) {
      geminiKeyConfigured = true;
      try {
        const decryptedKey = decrypt(settings.gemini_api_key_encrypted);
        // Mask the key: show first 4 and last 4 characters
        if (decryptedKey.length > 8) {
          geminiKeyMasked = `${decryptedKey.substring(0, 4)}${'*'.repeat(decryptedKey.length - 8)}${decryptedKey.substring(decryptedKey.length - 4)}`;
        } else {
          geminiKeyMasked = '*'.repeat(decryptedKey.length);
        }
      } catch (decryptError) {
        console.error('[Settings] Error decrypting Gemini key:', decryptError.message);
        // Key exists but can't be decrypted — treat as configured but show no mask
        geminiKeyMasked = '****';
      }
    } else if (process.env.GEMINI_API_KEY) {
      geminiKeyConfigured = true;
      const envKey = process.env.GEMINI_API_KEY;
      if (envKey.length > 8) {
        geminiKeyMasked = `${envKey.substring(0, 4)}${'*'.repeat(envKey.length - 8)}${envKey.substring(envKey.length - 4)} (from .env)`;
      } else {
        geminiKeyMasked = '**** (from .env)';
      }
    }

    res.json({
      success: true,
      data: {
        geminiKeyConfigured,
        geminiKeyMasked,
      },
    });
  } catch (error) {
    console.error('[Settings] Error fetching settings:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings.',
    });
  }
});

/**
 * PUT /api/settings/gemini-key
 * Saves or updates the Gemini API key (encrypted).
 */
router.put('/gemini-key', (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'API key is required.',
      });
    }

    const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
    const encryptedKey = encrypt(cleanKey);

    // Upsert: insert or update the settings record
    const existing = db.prepare('SELECT id FROM settings WHERE user_id = ?').get(req.user.id);

    if (existing) {
      db.prepare(`
        UPDATE settings
        SET gemini_api_key_encrypted = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(encryptedKey, req.user.id);
    } else {
      db.prepare(`
        INSERT INTO settings (user_id, gemini_api_key_encrypted)
        VALUES (?, ?)
      `).run(req.user.id, encryptedKey);
    }

    // Return the masked key for confirmation
    let geminiKeyMasked;
    if (apiKey.length > 8) {
      geminiKeyMasked = `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
    } else {
      geminiKeyMasked = '*'.repeat(apiKey.length);
    }

    res.json({
      success: true,
      data: {
        message: 'Gemini API key saved successfully.',
        geminiKeyConfigured: true,
        geminiKeyMasked,
      },
    });
  } catch (error) {
    console.error('[Settings] Error saving Gemini key:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save Gemini API key.',
    });
  }
});

/**
 * DELETE /api/settings/gemini-key
 * Removes the stored Gemini API key.
 */
router.delete('/gemini-key', (req, res) => {
  try {
    db.prepare(`
      UPDATE settings
      SET gemini_api_key_encrypted = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(req.user.id);

    res.json({
      success: true,
      data: {
        message: 'Gemini API key removed successfully.',
        geminiKeyConfigured: false,
        geminiKeyMasked: null,
      },
    });
  } catch (error) {
    console.error('[Settings] Error removing Gemini key:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to remove Gemini API key.',
    });
  }
});

module.exports = router;
