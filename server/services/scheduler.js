/**
 * Scheduler Service
 * Manages scheduled, recurring, and automated AI content posts using node-schedule.
 *
 * Supports:
 * - One-time post scheduling at specific date/time
 * - Multi-frequency recurring schedules:
 *   - Multiple times per day (e.g. 09:00, 14:00, 18:00)
 *   - Everyday / Daily
 *   - Every 3 days
 *   - Weekly (select specific days)
 *   - Every 2 weeks (Bi-weekly)
 *   - Monthly
 *   - Custom day intervals
 * - Autonomous AI Auto-Generation:
 *   - Generates fresh, unique posts using specified topics, tone & preferences
 *   - Automatically publishes to LinkedIn OR saves for review (approval mode)
 * - Independent schedules running simultaneously
 */

const schedule = require('node-schedule');
const linkedin = require('./linkedin');
const gemini = require('./gemini');
const { decrypt } = require('../utils/crypto');

// Map to hold active in-memory jobs: scheduleId → { job, type }
const activeJobs = new Map();

let _db = null;

/**
 * Initialize scheduler on startup.
 * @param {import('better-sqlite3').Database} db
 */
function init(db) {
  _db = db;

  try {
    const activeSchedules = db.prepare(`
      SELECT * FROM schedules WHERE status = 'active'
    `).all();

    console.log(`[Scheduler] Found ${activeSchedules.length} active schedule(s) to restore`);

    for (const sched of activeSchedules) {
      try {
        schedulePost(sched);
        console.log(`[Scheduler] Restored schedule #${sched.id} (${sched.title || sched.schedule_type || 'post'})`);
      } catch (error) {
        console.error(`[Scheduler] Failed to restore schedule #${sched.id}:`, error.message);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error initializing scheduler:', error.message);
  }
}

/**
 * Create or re-arm a scheduled job.
 * @param {Object} scheduleData
 */
function schedulePost(scheduleData) {
  const { id, status } = scheduleData;

  // Cancel any existing running job for this schedule
  if (activeJobs.has(id)) {
    cancelJob(id);
  }

  if (status !== 'active') {
    return;
  }

  // Calculate next execution time
  const nextRun = calculateNextRun(scheduleData);
  if (!nextRun) {
    console.warn(`[Scheduler] Could not determine next run time for schedule #${id}`);
    return;
  }

  // Update next_run_at in database
  if (_db) {
    try {
      _db.prepare(`
        UPDATE schedules SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(nextRun.toISOString(), id);
    } catch (e) {
      console.warn(`[Scheduler] Error updating next_run_at:`, e.message);
    }
  }

  const job = schedule.scheduleJob(nextRun, async () => {
    console.log(`[Scheduler] Job triggered for schedule #${id} at ${new Date().toISOString()}`);
    await executeJob(id);
  });

  if (!job) {
    console.error(`[Scheduler] Failed to schedule job #${id} at ${nextRun.toISOString()}`);
    return;
  }

  activeJobs.set(id, { job, type: scheduleData.is_recurring ? 'recurring' : 'one-time', nextRun });
  console.log(`[Scheduler] Armed schedule #${id} ("${scheduleData.title || 'Post'}") for ${nextRun.toISOString()}`);
}

/**
 * Cancel a running job in memory.
 * @param {number} scheduleId
 */
function cancelJob(scheduleId) {
  const entry = activeJobs.get(scheduleId);
  if (!entry) return;

  try {
    if (entry.job && typeof entry.job.cancel === 'function') {
      entry.job.cancel();
    }
    activeJobs.delete(scheduleId);
    console.log(`[Scheduler] Cancelled in-memory job for schedule #${scheduleId}`);
  } catch (error) {
    console.error(`[Scheduler] Error cancelling job #${scheduleId}:`, error.message);
    activeJobs.delete(scheduleId);
  }
}

/**
 * Pause a schedule.
 * @param {number} scheduleId
 */
function pauseJob(scheduleId) {
  cancelJob(scheduleId);

  if (_db) {
    _db.prepare(`
      UPDATE schedules SET status = 'paused', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(scheduleId);
  }

  console.log(`[Scheduler] Paused schedule #${scheduleId}`);
}

/**
 * Resume a paused schedule.
 * @param {number} scheduleId
 */
function resumeJob(scheduleId) {
  if (!_db) throw new Error('Scheduler not initialized');

  const scheduleData = _db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
  if (!scheduleData) throw new Error(`Schedule #${scheduleId} not found`);

  _db.prepare(`
    UPDATE schedules SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(scheduleId);

  schedulePost({ ...scheduleData, status: 'active' });
  console.log(`[Scheduler] Resumed schedule #${scheduleId}`);
}

/**
 * Execute a scheduled job.
 * Handles both existing post publishing and AI Auto-Generate campaigns.
 * @param {number} scheduleId
 */
async function executeJob(scheduleId) {
  if (!_db) {
    console.error('[Scheduler] Database not initialized');
    return;
  }

  try {
    const scheduleData = _db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    if (!scheduleData) {
      console.error(`[Scheduler] Schedule #${scheduleId} not found`);
      return;
    }

    const user = _db.prepare('SELECT id, linkedin_id, access_token_encrypted FROM users WHERE id = ?').get(scheduleData.user_id);
    if (!user) {
      console.error(`[Scheduler] User #${scheduleData.user_id} not found`);
      return;
    }

    let postId = scheduleData.post_id;

    // ─── CASE A: AI Auto-Generation Schedule ──────────────────────────────
    if (scheduleData.schedule_type === 'ai_auto' || !postId) {
      console.log(`[Scheduler] Executing AI Auto-Generate for schedule #${scheduleId} ("${scheduleData.title || 'Auto Schedule'}")`);

      let contentConfig = {};
      try {
        contentConfig = typeof scheduleData.content_config === 'string'
          ? JSON.parse(scheduleData.content_config)
          : (scheduleData.content_config || {});
      } catch (e) {
        contentConfig = {};
      }

      // Get user's Gemini key
      const settings = _db.prepare('SELECT gemini_api_key_encrypted FROM settings WHERE user_id = ?').get(user.id);
      let apiKey = null;
      if (settings && settings.gemini_api_key_encrypted) {
        apiKey = decrypt(settings.gemini_api_key_encrypted);
      } else if (process.env.GEMINI_API_KEY) {
        apiKey = process.env.GEMINI_API_KEY;
      }

      if (!apiKey) {
        console.error(`[Scheduler] Gemini API key missing for user #${user.id}`);
        return;
      }

      // Fetch recent posts for uniqueness
      const existingPosts = _db.prepare(`
        SELECT content FROM posts WHERE user_id = ? ORDER BY created_at DESC LIMIT 15
      `).all(user.id).map(p => p.content);

      // Generate post with Gemini
      const generatedContent = await gemini.generatePost({
        apiKey,
        topics: contentConfig.topics || ['Technology'],
        customTopics: contentConfig.customTopics || '',
        tone: contentConfig.tone || 'Professional',
        length: contentConfig.length || 'medium',
        useHeadings: !!contentConfig.useHeadings,
        useEmojis: contentConfig.useEmojis !== false,
        useHashtags: contentConfig.useHashtags !== false,
        existingPosts,
      });

      // Insert new post
      const initialStatus = scheduleData.requires_approval ? 'pending_approval' : 'publishing';
      const insertResult = _db.prepare(`
        INSERT INTO posts (user_id, content, topics, custom_topics, tone, length, use_headings, use_emojis, use_hashtags, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        user.id,
        generatedContent,
        JSON.stringify(contentConfig.topics || []),
        contentConfig.customTopics || '',
        contentConfig.tone || 'Professional',
        contentConfig.length || 'medium',
        contentConfig.useHeadings ? 1 : 0,
        contentConfig.useEmojis !== false ? 1 : 0,
        contentConfig.useHashtags !== false ? 1 : 0,
        initialStatus,
      );

      postId = insertResult.lastInsertRowid;
      console.log(`[Scheduler] Created auto-generated post #${postId} (Status: ${initialStatus})`);

      // If approval is not required and user has LinkedIn connected, publish immediately
      if (!scheduleData.requires_approval && user.access_token_encrypted) {
        try {
          const accessToken = decrypt(user.access_token_encrypted);
          const pubResult = await linkedin.publishPost(accessToken, user.linkedin_id, generatedContent);

          _db.prepare(`
            UPDATE posts
            SET status = 'published', linkedin_post_id = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(pubResult.linkedinPostId, postId);

          console.log(`[Scheduler] Successfully auto-published post #${postId} to LinkedIn (Post ID: ${pubResult.linkedinPostId})`);
        } catch (pubErr) {
          console.error(`[Scheduler] Failed to publish post #${postId}:`, pubErr.message);
          _db.prepare(`
            UPDATE posts SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(pubErr.message, postId);
        }
      }
    } else {
      // ─── CASE B: Single / Existing Post Schedule ─────────────────────────
      const post = _db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
      if (!post) {
        console.error(`[Scheduler] Post #${postId} not found for schedule #${scheduleId}`);
        return;
      }

      if (scheduleData.requires_approval) {
        _db.prepare(`
          UPDATE posts SET status = 'pending_approval', updated_at = CURRENT_TIMESTAMP WHERE id = ?
        `).run(postId);
        console.log(`[Scheduler] Post #${postId} marked for approval`);
      } else if (user.access_token_encrypted) {
        try {
          const accessToken = decrypt(user.access_token_encrypted);
          const pubResult = await linkedin.publishPost(accessToken, user.linkedin_id, post.content);

          _db.prepare(`
            UPDATE posts
            SET status = 'published', linkedin_post_id = ?, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(pubResult.linkedinPostId, postId);

          console.log(`[Scheduler] Successfully published post #${postId} to LinkedIn`);
        } catch (pubErr) {
          console.error(`[Scheduler] Failed to publish post #${postId}:`, pubErr.message);
          _db.prepare(`
            UPDATE posts SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(pubErr.message, postId);
        }
      }
    }

    // Update schedule last_run_at
    _db.prepare(`
      UPDATE schedules SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(scheduleId);

    // ─── Re-arm or Complete ────────────────────────────────────────────────
    if (scheduleData.is_recurring) {
      // Re-read updated schedule from DB and calculate next run
      const freshSched = _db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
      schedulePost(freshSched);
    } else {
      _db.prepare(`
        UPDATE schedules SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(scheduleId);
      activeJobs.delete(scheduleId);
    }
  } catch (error) {
    console.error(`[Scheduler] Error executing job for schedule #${scheduleId}:`, error.message);
  }
}

/**
 * Trigger a schedule immediately on demand ("Run Now").
 * @param {number} scheduleId
 */
async function runNow(scheduleId) {
  console.log(`[Scheduler] Manual "Run Now" requested for schedule #${scheduleId}`);
  await executeJob(scheduleId);
}

/**
 * Determine if a specific calendar date matches the recurrence cadence.
 */
function isMatchingDay(date, scheduleData) {
  const freq = scheduleData.frequency || 'daily';
  if (freq === 'daily') return true;

  const baseDate = scheduleData.created_at ? new Date(scheduleData.created_at) : new Date(scheduleData.scheduled_at || Date.now());
  const dStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const bStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()).getTime();
  const diffDays = Math.max(0, Math.round((dStart - bStart) / (24 * 3600 * 1000)));

  if (freq === '3days') {
    return diffDays % 3 === 0;
  }

  if (freq === '2weeks') {
    return diffDays % 14 === 0;
  }

  if (freq === 'monthly') {
    const targetDay = scheduleData.scheduled_at ? new Date(scheduleData.scheduled_at).getDate() : 1;
    return date.getDate() === targetDay;
  }

  if (freq === 'weekly') {
    let days = [];
    try {
      days = typeof scheduleData.frequency_days === 'string'
        ? JSON.parse(scheduleData.frequency_days)
        : (scheduleData.frequency_days || []);
    } catch (e) {
      days = [];
    }
    if (!days || days.length === 0) days = ['Monday'];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days.includes(dayNames[date.getDay()]);
  }

  if (freq === 'custom') {
    const interval = scheduleData.interval_days || 1;
    return diffDays % interval === 0;
  }

  return true;
}

/**
 * Calculate the next run datetime.
 * Evaluates multiple times of day (times_per_day) and cadence (daily, 3days, weekly, 2weeks, monthly).
 * @param {Object} scheduleData
 * @param {Date} [fromDate]
 * @returns {Date|null}
 */
function calculateNextRun(scheduleData, fromDate = new Date()) {
  try {
    // If not recurring, return the one-time scheduled date
    if (!scheduleData.is_recurring) {
      if (!scheduleData.scheduled_at) return null;
      const d = new Date(scheduleData.scheduled_at);
      return d > fromDate ? d : null;
    }

    // Parse times per day
    let times = [];
    try {
      times = typeof scheduleData.times_per_day === 'string'
        ? JSON.parse(scheduleData.times_per_day)
        : (scheduleData.times_per_day || []);
    } catch (e) {
      times = [];
    }

    if (!Array.isArray(times) || times.length === 0) {
      if (scheduleData.scheduled_at) {
        const d = new Date(scheduleData.scheduled_at);
        times = [`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`];
      } else {
        times = ['09:00'];
      }
    }

    // Sort times
    times.sort();

    const now = new Date(fromDate);

    // 1. Check if any time TODAY is still in the future and today matches the cadence
    if (isMatchingDay(now, scheduleData)) {
      for (const t of times) {
        const [h, m] = t.split(':').map(Number);
        const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
        if (candidate.getTime() > now.getTime()) {
          return candidate;
        }
      }
    }

    // 2. Search ahead day-by-day (up to 90 days)
    for (let dayOffset = 1; dayOffset <= 90; dayOffset++) {
      const checkDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, 0, 0, 0, 0);
      if (isMatchingDay(checkDate, scheduleData)) {
        const [h, m] = times[0].split(':').map(Number);
        checkDate.setHours(h, m, 0, 0);
        return checkDate;
      }
    }

    // Fallback: tomorrow at times[0]
    const fallback = new Date(now);
    fallback.setDate(fallback.getDate() + 1);
    const [h, m] = times[0].split(':').map(Number);
    fallback.setHours(h, m, 0, 0);
    return fallback;
  } catch (error) {
    console.error('[Scheduler] Error calculating next run:', error.message);
    return null;
  }
}

function getActiveJobCount() {
  return activeJobs.size;
}

module.exports = {
  init,
  schedulePost,
  cancelJob,
  pauseJob,
  resumeJob,
  executeJob,
  runNow,
  calculateNextRun,
  getActiveJobCount,
};
