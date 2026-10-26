/**
 * Authentication Routes
 * Handles LinkedIn OAuth flow, session management, and account disconnection.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const linkedin = require('../services/linkedin');
const { encrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

/**
 * GET /api/auth/linkedin
 * Redirects the user to LinkedIn's OAuth authorization page.
 */
router.get('/linkedin', (req, res) => {
  try {
    const { url, state } = linkedin.getAuthUrl();

    // Store the state in session for CSRF protection
    req.session.oauthState = state;

    // Return JSON only if explicitly requested
    if (req.query.format === 'json' || (req.headers.accept && req.headers.accept.includes('application/json') && !req.headers.accept.includes('text/html'))) {
      return res.json({
        success: true,
        data: { url },
      });
    }

    // Redirect browser directly to LinkedIn authorization page
    res.redirect(url);
  } catch (error) {
    console.error('[Auth] Error generating auth URL:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate LinkedIn authentication.',
    });
  }
});

/**
 * GET /api/auth/linkedin/callback
 * Handles the OAuth callback from LinkedIn.
 * Exchanges the authorization code for tokens, fetches the user profile,
 * and creates or updates the user in the database.
 */
router.get('/linkedin/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError, error_description } = req.query;

    // Handle OAuth errors from LinkedIn
    if (oauthError) {
      console.error('[Auth] LinkedIn OAuth error:', oauthError, error_description);
      return res.redirect(`${require('../config').CLIENT_URL}/auth/error?message=${encodeURIComponent(error_description || oauthError)}`);
    }

    // Validate required parameters
    if (!code) {
      return res.redirect(`${require('../config').CLIENT_URL}/auth/error?message=${encodeURIComponent('Missing authorization code')}`);
    }

    // Verify CSRF state parameter
    if (!state || state !== req.session.oauthState) {
      console.error('[Auth] CSRF state mismatch');
      return res.redirect(`${require('../config').CLIENT_URL}/auth/error?message=${encodeURIComponent('Invalid state parameter. Please try again.')}`);
    }

    // Clean up the OAuth state from session
    delete req.session.oauthState;

    // Exchange the code for tokens
    const tokenData = await linkedin.exchangeCodeForToken(code);

    // Fetch the user profile
    const profile = await linkedin.getUserProfile(tokenData.accessToken);

    // Calculate token expiration timestamp
    const tokenExpiresAt = Math.floor(Date.now() / 1000) + tokenData.expiresIn;

    // Encrypt tokens before storing
    const accessTokenEncrypted = encrypt(tokenData.accessToken);
    const refreshTokenEncrypted = tokenData.refreshToken ? encrypt(tokenData.refreshToken) : null;

    // Create or update the user in the database
    const existingUser = db.prepare('SELECT id FROM users WHERE linkedin_id = ?').get(profile.linkedinId);

    let userId;

    if (existingUser) {
      // Update existing user
      db.prepare(`
        UPDATE users
        SET name = ?, email = ?, profile_url = ?, avatar_url = ?,
            access_token_encrypted = ?, refresh_token_encrypted = ?,
            token_expires_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        profile.name,
        profile.email,
        profile.profileUrl,
        profile.avatarUrl,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
        existingUser.id,
      );
      userId = existingUser.id;
    } else {
      // Create new user
      const result = db.prepare(`
        INSERT INTO users (linkedin_id, name, email, profile_url, avatar_url,
                          access_token_encrypted, refresh_token_encrypted, token_expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        profile.linkedinId,
        profile.name,
        profile.email,
        profile.profileUrl,
        profile.avatarUrl,
        accessTokenEncrypted,
        refreshTokenEncrypted,
        tokenExpiresAt,
      );
      userId = result.lastInsertRowid;
    }

    // Set the user ID in the session
    req.session.userId = userId;

    // Redirect to the client app
    const config = require('../config');
    res.redirect(`${config.CLIENT_URL}/?auth=success`);
  } catch (error) {
    console.error('[Auth] Callback error:', error.message);
    const config = require('../config');
    res.redirect(`${config.CLIENT_URL}/?auth_error=${encodeURIComponent('Authentication failed. Please try again.')}`);
  }
});

/**
 * GET /api/auth/status
 * Returns the current authentication status and user info.
 */
router.get('/status', (req, res) => {
  try {
    if (!req.session || !req.session.userId) {
      return res.json({
        success: true,
        data: {
          authenticated: false,
          user: null,
        },
      });
    }

    const user = db.prepare(`
      SELECT id, name, email, avatar_url, profile_url
      FROM users WHERE id = ?
    `).get(req.session.userId);

    if (!user) {
      return res.json({
        success: true,
        data: {
          authenticated: false,
          user: null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatar_url,
          profileUrl: user.profile_url,
        },
      },
    });
  } catch (error) {
    console.error('[Auth] Status check error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to check authentication status.',
    });
  }
});

/**
 * POST /api/auth/logout
 * Destroys the user's session.
 */
router.post('/logout', (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error('[Auth] Session destroy error:', err.message);
        return res.status(500).json({
          success: false,
          error: 'Failed to log out.',
        });
      }

      res.clearCookie('connect.sid');
      res.json({
        success: true,
        data: { message: 'Logged out successfully.' },
      });
    });
  } catch (error) {
    console.error('[Auth] Logout error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to log out.',
    });
  }
});

/**
 * DELETE /api/auth/linkedin
 * Disconnects the LinkedIn account by removing tokens but keeping the user record.
 */
router.delete('/linkedin', requireAuth, (req, res) => {
  try {
    db.prepare(`
      UPDATE users
      SET access_token_encrypted = NULL, refresh_token_encrypted = NULL,
          token_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id);

    res.json({
      success: true,
      data: { message: 'LinkedIn account disconnected successfully.' },
    });
  } catch (error) {
    console.error('[Auth] Disconnect error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect LinkedIn account.',
    });
  }
});

module.exports = router;
