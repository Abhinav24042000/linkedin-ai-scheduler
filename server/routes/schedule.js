/**
 * Schedule Routes
 * Manages scheduling, automated recurring AI campaigns, pausing, resuming, and approving posts.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const scheduler = require('../services/scheduler');
const linkedin = require('../services/linkedin');
const { decrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

// All schedule routes require authentication
router.use(requireAuth);

/**
 * POST /api/schedules/auto
 * Create an autonomous AI auto-posting schedule campaign.
 * Configures:
 * - title: Custom name (e.g. "Daily Morning Tech Tips")
 * - contentConfig: { topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags }
 * - timesPerDay: ['09:00', '18:00']
 * - frequency: 'daily' | '3days' | 'weekly' | '2weeks' | 'monthly' | 'custom'
 * - frequencyDays: ['Monday', 'Wednesday', 'Friday']
 * - intervalDays: 3
 * - requiresApproval: true/false
 * - timezone: 'UTC'
 */
router.post('/auto', (req, res) => {
  try {
    const {
      title,
      contentConfig,
      timesPerDay,
      frequency,
      frequencyDays,
      intervalDays,
      requiresApproval,
      timezone,
    } = req.body;

    const times = Array.isArray(timesPerDay) && timesPerDay.length > 0 ? timesPerDay : ['09:00'];
    const freq = frequency || 'daily';

    // Build temporary schedule object to calculate initial next_run_at
    const tempSched = {
      is_recurring: 1,
      times_per_day: JSON.stringify(times),
      frequency: freq,
      frequency_days: JSON.stringify(frequencyDays || []),
      interval_days: intervalDays || 1,
      timezone: timezone || 'UTC',
      created_at: new Date().toISOString(),
    };

    const nextRun = scheduler.calculateNextRun(tempSched) || new Date(Date.now() + 3600000);

    const result = db.prepare(`
      INSERT INTO schedules (
        user_id, title, schedule_type, content_config, times_per_day,
        frequency, frequency_days, interval_days, is_recurring,
        requires_approval, timezone, status, next_run_at
      )
      VALUES (?, ?, 'ai_auto', ?, ?, ?, ?, ?, 1, ?, ?, 'active', ?)
    `).run(
      req.user.id,
      title || 'Auto Schedule',
      JSON.stringify(contentConfig || { topics: ['Technology'], tone: 'Professional', length: 'medium' }),
      JSON.stringify(times),
      freq,
      JSON.stringify(frequencyDays || []),
      intervalDays || 1,
      requiresApproval ? 1 : 0,
      timezone || 'UTC',
      nextRun.toISOString(),
    );

    const scheduleId = result.lastInsertRowid;
    const created = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);

    // Register with in-memory scheduler
    scheduler.schedulePost(created);

    res.status(201).json({
      success: true,
      data: formatSchedule(created),
    });
  } catch (error) {
    console.error('[Schedules] Create Auto error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create auto schedule: ' + error.message,
    });
  }
});

/**
 * POST /api/schedules/:id/run-now
 * Immediately triggers a schedule to run on demand.
 */
router.post('/:id/run-now', async (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    // Trigger execution
    await scheduler.runNow(schedule.id);

    res.json({
      success: true,
      data: { message: 'Schedule triggered successfully.' },
    });
  } catch (error) {
    console.error('[Schedules] Run Now error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger schedule: ' + error.message,
    });
  }
});

/**
 * POST /api/schedules
 * Create a new schedule for a specific post.
 */
router.post('/', (req, res) => {
  try {
    const { postId, scheduledAt, timezone, isRecurring, recurrencePattern, requiresApproval } = req.body;

    if (!postId) {
      return res.status(400).json({
        success: false,
        error: 'Post ID is required.',
      });
    }

    if (!scheduledAt) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time is required.',
      });
    }

    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(postId, req.user.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    const scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scheduled time format.',
      });
    }

    if (!isRecurring && scheduledDate <= new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Scheduled time must be in the future.',
      });
    }

    const recurrencePatternStr = recurrencePattern ? JSON.stringify(recurrencePattern) : null;
    const nextRunAt = scheduledDate.toISOString();

    const result = db.prepare(`
      INSERT INTO schedules (post_id, user_id, scheduled_at, timezone, is_recurring, recurrence_pattern, requires_approval, status, next_run_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(
      postId,
      req.user.id,
      scheduledDate.toISOString(),
      timezone || 'UTC',
      isRecurring ? 1 : 0,
      recurrencePatternStr,
      requiresApproval ? 1 : 0,
      nextRunAt,
    );

    const scheduleId = result.lastInsertRowid;

    db.prepare(`
      UPDATE posts SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(postId);

    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId);
    scheduler.schedulePost(schedule);

    res.status(201).json({
      success: true,
      data: formatSchedule(schedule),
    });
  } catch (error) {
    console.error('[Schedules] Create error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create schedule.',
    });
  }
});

/**
 * GET /api/schedules
 * List all schedules (both post schedules and auto campaigns).
 */
router.get('/', (req, res) => {
  try {
    const schedules = db.prepare(`
      SELECT s.*, p.content, p.status as post_status, p.topics
      FROM schedules s
      LEFT JOIN posts p ON s.post_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
    `).all(req.user.id);

    res.json({
      success: true,
      data: {
        schedules: schedules.map(s => ({
          ...formatSchedule(s),
          post: s.post_id ? {
            id: s.post_id,
            content: s.content,
            status: s.post_status,
            topics: s.topics,
          } : null,
        })),
      },
    });
  } catch (error) {
    console.error('[Schedules] List error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedules.',
    });
  }
});

/**
 * PUT /api/schedules/:id
 * Update a schedule.
 */
router.put('/:id', (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    const {
      title,
      scheduledAt,
      timezone,
      isRecurring,
      recurrencePattern,
      requiresApproval,
      contentConfig,
      timesPerDay,
      frequency,
      frequencyDays,
      intervalDays,
    } = req.body;

    scheduler.cancelJob(schedule.id);

    db.prepare(`
      UPDATE schedules
      SET title = COALESCE(?, title),
          scheduled_at = COALESCE(?, scheduled_at),
          timezone = COALESCE(?, timezone),
          is_recurring = COALESCE(?, is_recurring),
          recurrence_pattern = COALESCE(?, recurrence_pattern),
          requires_approval = COALESCE(?, requires_approval),
          content_config = COALESCE(?, content_config),
          times_per_day = COALESCE(?, times_per_day),
          frequency = COALESCE(?, frequency),
          frequency_days = COALESCE(?, frequency_days),
          interval_days = COALESCE(?, interval_days),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      title || null,
      scheduledAt || null,
      timezone || null,
      isRecurring !== undefined ? (isRecurring ? 1 : 0) : null,
      recurrencePattern !== undefined ? (recurrencePattern ? JSON.stringify(recurrencePattern) : null) : null,
      requiresApproval !== undefined ? (requiresApproval ? 1 : 0) : null,
      contentConfig !== undefined ? JSON.stringify(contentConfig) : null,
      timesPerDay !== undefined ? JSON.stringify(timesPerDay) : null,
      frequency || null,
      frequencyDays !== undefined ? JSON.stringify(frequencyDays) : null,
      intervalDays || null,
      schedule.id,
    );

    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);
    if (updated.status === 'active') {
      scheduler.schedulePost(updated);
    }

    res.json({
      success: true,
      data: formatSchedule(updated),
    });
  } catch (error) {
    console.error('[Schedules] Update error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to update schedule.' });
  }
});

/**
 * DELETE /api/schedules/:id
 * Delete a schedule.
 */
router.delete('/:id', (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found.' });
    }

    scheduler.cancelJob(schedule.id);

    db.prepare('DELETE FROM schedules WHERE id = ?').run(schedule.id);

    if (schedule.post_id) {
      const activeCount = db.prepare("SELECT COUNT(*) as count FROM schedules WHERE post_id = ? AND status = 'active'").get(schedule.post_id);
      if (activeCount.count === 0) {
        db.prepare("UPDATE posts SET status = 'draft', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'scheduled'").run(schedule.post_id);
      }
    }

    res.json({ success: true, data: { message: 'Schedule deleted successfully.' } });
  } catch (error) {
    console.error('[Schedules] Delete error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete schedule.' });
  }
});

/**
 * POST /api/schedules/:id/pause
 */
router.post('/:id/pause', (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found.' });

    scheduler.pauseJob(schedule.id);
    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);

    res.json({ success: true, data: formatSchedule(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to pause schedule.' });
  }
});

/**
 * POST /api/schedules/:id/resume
 */
router.post('/:id/resume', (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule) return res.status(404).json({ success: false, error: 'Schedule not found.' });

    scheduler.resumeJob(schedule.id);
    const updated = db.prepare('SELECT * FROM schedules WHERE id = ?').get(schedule.id);

    res.json({ success: true, data: formatSchedule(updated) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to resume schedule.' });
  }
});

/**
 * POST /api/schedules/:id/approve
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const schedule = db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (!schedule || !schedule.post_id) return res.status(404).json({ success: false, error: 'Schedule or post not found.' });

    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(schedule.post_id, req.user.id);
    if (!post) return res.status(404).json({ success: false, error: 'Post not found.' });

    const user = db.prepare('SELECT id, linkedin_id, access_token_encrypted FROM users WHERE id = ?').get(req.user.id);
    if (!user || !user.access_token_encrypted) return res.status(400).json({ success: false, error: 'LinkedIn account is not connected.' });

    const accessToken = decrypt(user.access_token_encrypted);
    const result = await linkedin.publishPost(accessToken, user.linkedin_id, post.content);

    db.prepare(`
      UPDATE posts SET status = 'published', linkedin_post_id = ?, published_at = CURRENT_TIMESTAMP, error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(result.linkedinPostId, post.id);

    res.json({ success: true, data: { message: 'Post approved and published successfully.' } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Failed to approve post.' });
  }
});

/**
 * Format a schedule record for the API response.
 */
function formatSchedule(schedule) {
  let recurrencePattern = null;
  try {
    recurrencePattern = schedule.recurrence_pattern ? JSON.parse(schedule.recurrence_pattern) : null;
  } catch {
    recurrencePattern = schedule.recurrence_pattern;
  }

  let contentConfig = null;
  try {
    contentConfig = schedule.content_config ? JSON.parse(schedule.content_config) : null;
  } catch {
    contentConfig = schedule.content_config;
  }

  let timesPerDay = [];
  try {
    timesPerDay = schedule.times_per_day ? JSON.parse(schedule.times_per_day) : [];
  } catch {
    timesPerDay = [];
  }

  let frequencyDays = [];
  try {
    frequencyDays = schedule.frequency_days ? JSON.parse(schedule.frequency_days) : [];
  } catch {
    frequencyDays = [];
  }

  return {
    id: schedule.id,
    postId: schedule.post_id,
    userId: schedule.user_id,
    title: schedule.title,
    scheduleType: schedule.schedule_type || 'post',
    contentConfig,
    timesPerDay,
    frequency: schedule.frequency || 'daily',
    frequencyDays,
    intervalDays: schedule.interval_days || 1,
    scheduledAt: schedule.scheduled_at,
    timezone: schedule.timezone,
    isRecurring: !!schedule.is_recurring,
    recurrencePattern,
    requiresApproval: !!schedule.requires_approval,
    status: schedule.status,
    lastRunAt: schedule.last_run_at,
    nextRunAt: schedule.next_run_at,
    createdAt: schedule.created_at,
    updatedAt: schedule.updated_at,
  };
}

module.exports = router;
