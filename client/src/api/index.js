/**
 * API client module for LinkedIn Post Scheduler.
 * All requests include credentials (session cookies) for authentication.
 */

const API_BASE = '/api';

/**
 * Generic fetch wrapper with error handling.
 * @param {string} url - The API endpoint URL
 * @param {object} options - Fetch options
 * @returns {Promise<object>} Parsed JSON response
 */
async function request(url, options = {}) {
  const config = {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Don't set Content-Type for GET/DELETE without body
  if (!options.body) {
    delete config.headers['Content-Type'];
  }

  const response = await fetch(`${API_BASE}${url}`, config);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Check current authentication status */
export function checkAuthStatus() {
  return request('/auth/status');
}

/** Log out the current user */
export function logout() {
  return request('/auth/logout', { method: 'POST' });
}

/** Disconnect LinkedIn account */
export function disconnectLinkedIn() {
  return request('/auth/linkedin', { method: 'DELETE' });
}

// ─── Settings ────────────────────────────────────────────────────────────────

/** Get application settings */
export function getSettings() {
  return request('/settings');
}

/** Save Gemini API key */
export function saveGeminiKey(apiKey) {
  return request('/settings/gemini-key', {
    method: 'PUT',
    body: JSON.stringify({ apiKey }),
  });
}

/** Delete Gemini API key */
export function deleteGeminiKey() {
  return request('/settings/gemini-key', { method: 'DELETE' });
}

// ─── Posts ────────────────────────────────────────────────────────────────────

/**
 * Generate a new post using AI.
 * @param {object} params - Generation parameters
 * @param {string[]} params.topics - Selected topics
 * @param {string} params.customTopics - Custom topic text
 * @param {string} params.tone - Post tone
 * @param {string} params.length - Post length (short/medium/long)
 * @param {boolean} params.useHeadings - Include headings
 * @param {boolean} params.useEmojis - Include emojis
 * @param {boolean} params.useHashtags - Include hashtags
 */
export function generatePost(params) {
  return request('/posts/generate', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Save a post as draft.
 * @param {object} params - Post data including content, topics, etc.
 */
export function savePost(params) {
  return request('/posts', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Get posts with optional filters.
 * @param {object} params - Query parameters
 * @param {string} [params.status] - Filter by status
 * @param {number} [params.page] - Page number
 * @param {number} [params.limit] - Items per page
 */
export function getPosts(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  const query = searchParams.toString();
  return request(`/posts${query ? `?${query}` : ''}`);
}

/**
 * Get a single post by ID.
 * @param {string|number} id - Post ID
 */
export function getPost(id) {
  return request(`/posts/${id}`);
}

/**
 * Update an existing post.
 * @param {string|number} id - Post ID
 * @param {object} params - Updated post data
 */
export function updatePost(id, params) {
  return request(`/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

/**
 * Delete a post.
 * @param {string|number} id - Post ID
 */
export function deletePost(id) {
  return request(`/posts/${id}`, { method: 'DELETE' });
}

/**
 * Publish a post immediately.
 * @param {string|number} id - Post ID
 */
export function publishPost(id) {
  return request(`/posts/${id}/publish`, { method: 'POST' });
}

/**
 * Regenerate post content.
 * @param {string|number} id - Post ID
 */
export function regeneratePost(id) {
  return request(`/posts/${id}/regenerate`, { method: 'POST' });
}

// ─── Schedules ───────────────────────────────────────────────────────────────

/**
 * Create a new schedule for a post.
 * @param {object} params - Schedule parameters
 * @param {number} params.postId - Post ID to schedule
 * @param {string} params.scheduledAt - ISO date string
 * @param {string} params.timezone - Timezone identifier
 * @param {boolean} params.isRecurring - Whether schedule repeats
 * @param {string} [params.recurrencePattern] - Recurrence pattern
 * @param {boolean} params.requiresApproval - Whether approval is needed
 */
export function createSchedule(params) {
  return request('/schedules', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/** Get all schedules */
export function getSchedules() {
  return request('/schedules');
}

/**
 * Update an existing schedule.
 * @param {string|number} id - Schedule ID
 * @param {object} params - Updated schedule data
 */
export function updateSchedule(id, params) {
  return request(`/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(params),
  });
}

/**
 * Delete a schedule.
 * @param {string|number} id - Schedule ID
 */
export function deleteSchedule(id) {
  return request(`/schedules/${id}`, { method: 'DELETE' });
}

/**
 * Pause a schedule.
 * @param {string|number} id - Schedule ID
 */
export function pauseSchedule(id) {
  return request(`/schedules/${id}/pause`, { method: 'POST' });
}

/**
 * Resume a paused schedule.
 * @param {string|number} id - Schedule ID
 */
export function resumeSchedule(id) {
  return request(`/schedules/${id}/resume`, { method: 'POST' });
}

/**
 * Approve a schedule pending approval.
 * @param {string|number} id - Schedule ID
 */
export function approveSchedule(id) {
  return request(`/schedules/${id}/approve`, { method: 'POST' });
}

/**
 * Create an automated AI auto-posting campaign schedule.
 * @param {object} params
 */
export function createAutoSchedule(params) {
  return request('/schedules/auto', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Trigger an existing schedule to run immediately.
 * @param {string|number} id - Schedule ID
 */
export function runNowSchedule(id) {
  return request(`/schedules/${id}/run-now`, { method: 'POST' });
}

// ─── History ─────────────────────────────────────────────────────────────────

/**
 * Get published post history.
 * @param {object} params - Query parameters
 * @param {number} [params.page] - Page number
 * @param {number} [params.limit] - Items per page
 */
export function getHistory(params = {}) {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page.toString());
  if (params.limit) searchParams.set('limit', params.limit.toString());
  const query = searchParams.toString();
  return request(`/history${query ? `?${query}` : ''}`);
}
