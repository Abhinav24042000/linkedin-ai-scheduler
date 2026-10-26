/**
 * Authentication Middleware
 * Ensures the user is authenticated via session before accessing protected routes.
 */

const db = require('../db');

/**
 * Middleware that checks for an authenticated session.
 * If valid, attaches the user object to req.user.
 * If not, returns a 401 JSON response.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in.',
    });
  }

  try {
    const user = db.prepare(`
      SELECT id, linkedin_id, name, email, profile_url, avatar_url, token_expires_at
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    if (!user) {
      // User was deleted but session still exists — destroy session
      req.session.destroy(() => {});
      return res.status(401).json({
        success: false,
        error: 'User not found. Please log in again.',
      });
    }

    // Attach user info to the request
    req.user = {
      id: user.id,
      linkedinId: user.linkedin_id,
      name: user.name,
      email: user.email,
      profileUrl: user.profile_url,
      avatarUrl: user.avatar_url,
      tokenExpiresAt: user.token_expires_at,
    };

    next();
  } catch (error) {
    console.error('[Auth Middleware] Error fetching user:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during authentication.',
    });
  }
}

module.exports = { requireAuth };
