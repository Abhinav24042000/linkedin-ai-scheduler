/**
 * LinkedIn Service
 * Handles all LinkedIn API interactions: OAuth, profile fetching, and post publishing.
 *
 * IMPORTANT: The w_member_social scope is required for publishing posts. This scope
 * requires your LinkedIn app to be approved through LinkedIn's developer program.
 * During development, you can test with a Company Page using the w_organization_social scope,
 * or apply for the Marketing Developer Platform product in your LinkedIn app settings.
 */

const crypto = require('crypto');
const config = require('../config');

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_UGC_URL = 'https://api.linkedin.com/v2/ugcPosts';

// Scopes needed for full functionality
// openid + profile + email = user identity via OpenID Connect
// w_member_social = posting on behalf of user (requires app approval)
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'];

/**
 * Generate the LinkedIn OAuth authorization URL.
 * Includes a state parameter for CSRF protection.
 * @returns {{ url: string, state: string }}
 */
function getAuthUrl() {
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.LINKEDIN_CLIENT_ID,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    state: state,
    scope: SCOPES.join(' '),
  });

  return {
    url: `${LINKEDIN_AUTH_URL}?${params.toString()}`,
    state,
  };
}

/**
 * Exchange an authorization code for access and refresh tokens.
 * @param {string} code - The authorization code from LinkedIn callback
 * @returns {Promise<{ accessToken: string, expiresIn: number, refreshToken?: string }>}
 */
async function exchangeCodeForToken(code) {
  try {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.LINKEDIN_REDIRECT_URI,
      client_id: config.LINKEDIN_CLIENT_ID,
      client_secret: config.LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error_description || data.error || 'Unknown error';
      throw new Error(`LinkedIn token exchange failed: ${errorMsg}`);
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token || null,
    };
  } catch (error) {
    if (error.message.includes('LinkedIn token exchange')) {
      throw error;
    }
    throw new Error(`Failed to exchange code for token: ${error.message}`);
  }
}

/**
 * Fetch the authenticated user's profile using OpenID Connect userinfo endpoint.
 * @param {string} accessToken - Valid LinkedIn access token
 * @returns {Promise<{ linkedinId: string, name: string, email: string, profileUrl: string, avatarUrl: string }>}
 */
async function getUserProfile(accessToken) {
  try {
    const response = await fetch(LINKEDIN_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('LinkedIn access token is expired or invalid. Please re-authenticate.');
      }
      throw new Error(`Failed to fetch LinkedIn profile: ${data.message || response.statusText}`);
    }

    return {
      linkedinId: data.sub,
      name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
      email: data.email || null,
      profileUrl: `https://www.linkedin.com/in/${data.sub}`,
      avatarUrl: data.picture || null,
    };
  } catch (error) {
    if (error.message.includes('LinkedIn')) {
      throw error;
    }
    throw new Error(`Failed to fetch user profile: ${error.message}`);
  }
}

/**
 * Publish a post to LinkedIn using the UGC Posts API.
 *
 * NOTE: This requires the w_member_social scope which needs LinkedIn app approval.
 * Without approval, you'll get a 403 Forbidden error.
 *
 * @param {string} accessToken - Valid LinkedIn access token
 * @param {string} linkedinUserId - The user's LinkedIn ID (URN format: "urn:li:person:xxx" or just the ID)
 * @returns {Promise<{ linkedinPostId: string }>}
 */
async function publishPost(accessToken, linkedinUserId, content) {
  // Ensure the author URN is properly formatted
  const authorUrn = linkedinUserId.startsWith('urn:li:person:')
    ? linkedinUserId
    : `urn:li:person:${linkedinUserId}`;

  const payload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  try {
    const response = await fetch(LINKEDIN_UGC_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Provide clear error messages for common failure cases
      if (response.status === 403) {
        throw new Error(
          'LinkedIn API returned 403 Forbidden. This usually means your LinkedIn app ' +
          'does not have the w_member_social permission approved. Apply for the ' +
          '"Share on LinkedIn" and/or "Sign In with LinkedIn using OpenID Connect" ' +
          'products in your LinkedIn Developer App settings.'
        );
      }

      if (response.status === 401) {
        throw new Error(
          'LinkedIn access token is expired or invalid. Please disconnect and ' +
          're-authenticate your LinkedIn account.'
        );
      }

      if (response.status === 422) {
        throw new Error(
          `LinkedIn rejected the post content: ${data.message || 'The post may contain invalid characters or exceed length limits.'}`
        );
      }

      throw new Error(
        `LinkedIn API error (${response.status}): ${data.message || data.error || response.statusText}`
      );
    }

    return {
      linkedinPostId: data.id || null,
    };
  } catch (error) {
    if (error.message.includes('LinkedIn')) {
      throw error;
    }
    throw new Error(`Failed to publish post to LinkedIn: ${error.message}`);
  }
}

/**
 * Refresh an access token using a refresh token.
 * Note: LinkedIn refresh tokens are only available for apps with specific permissions.
 * @param {string} refreshToken - The refresh token
 * @returns {Promise<{ accessToken: string, expiresIn: number, refreshToken?: string }>}
 */
async function refreshAccessToken(refreshToken) {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: config.LINKEDIN_CLIENT_ID,
      client_secret: config.LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.error_description || data.error || 'Unknown error';
      throw new Error(`LinkedIn token refresh failed: ${errorMsg}`);
    }

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token || refreshToken,
    };
  } catch (error) {
    if (error.message.includes('LinkedIn token refresh')) {
      throw error;
    }
    throw new Error(`Failed to refresh access token: ${error.message}`);
  }
}

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  getUserProfile,
  publishPost,
  refreshAccessToken,
};
