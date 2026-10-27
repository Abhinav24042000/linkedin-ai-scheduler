/**
 * Posts Routes
 * Handles post generation, CRUD operations, publishing, and regeneration.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const gemini = require('../services/gemini');
const linkedin = require('../services/linkedin');
const uniqueness = require('../services/uniqueness');
const { decrypt } = require('../utils/crypto');
const { requireAuth } = require('../middleware/auth');

// All post routes require authentication
router.use(requireAuth);

/**
 * POST /api/posts/generate
 * Generate a new LinkedIn post using Gemini AI.
 * Also checks for similarity against existing posts.
 */
router.post('/generate', async (req, res) => {
  try {
    const { topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags } = req.body;

    // Fetch the user's Gemini API key (from settings or .env fallback)
    const settings = db.prepare(
      'SELECT gemini_api_key_encrypted FROM settings WHERE user_id = ?'
    ).get(req.user.id);

    let apiKey = null;
    let keySource = 'none';

    if (settings && settings.gemini_api_key_encrypted) {
      try {
        apiKey = decrypt(settings.gemini_api_key_encrypted);
        keySource = 'database settings';
      } catch (decryptErr) {
        console.warn('[Posts] Failed to decrypt database key:', decryptErr.message);
      }
    }

    if ((!apiKey || apiKey.trim().length === 0) && process.env.GEMINI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY;
      keySource = 'environment variable';
    }

    if (apiKey) {
      apiKey = apiKey.replace(/^GEMINI_API_KEY\s*[:=]\s*/i, '').trim().replace(/^["']|["']$/g, '');
    }

    console.log(`[Posts] Loaded API key from: ${keySource}, prefix: ${apiKey ? apiKey.substring(0, 6) + '...' : 'null'}`);

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Gemini API key is not configured. Please add it in Settings or set GEMINI_API_KEY in your .env file.',
      });
    }

    // Fetch existing posts for uniqueness comparison and context
    const existingPosts = db.prepare(`
      SELECT id, content FROM posts
      WHERE user_id = ? AND status IN ('draft', 'published', 'scheduled')
      ORDER BY created_at DESC
      LIMIT 20
    `).all(req.user.id);

    const existingContents = existingPosts.map(p => p.content);

    // Generate the post with Gemini
    const content = await gemini.generatePost({
      apiKey,
      topics: topics || [],
      customTopics: customTopics || '',
      tone: tone || 'professional',
      length: length || 'medium',
      useHeadings: !!useHeadings,
      useEmojis: !!useEmojis,
      useHashtags: useHashtags !== false, // default true
      existingPosts: existingContents,
    });

    // Check similarity against existing posts
    const similarityResult = uniqueness.checkSimilarity(content, existingPosts);

    // Build similar posts response array
    const similarPosts = [];
    if (similarityResult.mostSimilarPost) {
      similarPosts.push({
        id: similarityResult.mostSimilarPost.id,
        content: similarityResult.mostSimilarPost.content,
        score: similarityResult.mostSimilarPost.score,
      });
    }

    res.json({
      success: true,
      data: {
        content,
        similarPosts,
        similarityWarning: similarityResult.isTooSimilar
          ? 'This post is quite similar to an existing post. Consider editing for more originality.'
          : null,
      },
    });
  } catch (error) {
    console.error('[Posts] Generate error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate post.',
    });
  }
});

/**
 * POST /api/posts
 * Save a new post as a draft.
 */
router.post('/', (req, res) => {
  try {
    const { content, topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Post content is required.',
      });
    }

    // Insert the post
    const result = db.prepare(`
      INSERT INTO posts (user_id, content, topics, custom_topics, tone, length, use_headings, use_emojis, use_hashtags, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).run(
      req.user.id,
      content.trim(),
      topics ? JSON.stringify(topics) : null,
      customTopics || null,
      tone || 'professional',
      length || 'medium',
      useHeadings ? 1 : 0,
      useEmojis ? 1 : 0,
      useHashtags !== false ? 1 : 0,
    );

    const postId = result.lastInsertRowid;

    // Save the initial version in post_versions
    db.prepare(`
      INSERT INTO post_versions (post_id, content, version)
      VALUES (?, ?, 1)
    `).run(postId, content.trim());

    // Fetch and return the created post
    const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);

    res.status(201).json({
      success: true,
      data: formatPost(post),
    });
  } catch (error) {
    console.error('[Posts] Create error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to save post.',
    });
  }
});

/**
 * GET /api/posts
 * List posts with optional status filter and pagination.
 */
router.get('/', (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE p.user_id = ?';
    const params = [req.user.id];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }

    // Get total count
    const countResult = db.prepare(
      `SELECT COUNT(*) as total FROM posts p ${whereClause}`
    ).get(...params);

    // Get paginated posts with schedule info
    const posts = db.prepare(`
      SELECT p.*, s.id as schedule_id, s.scheduled_at, s.timezone, s.status as schedule_status
      FROM posts p
      LEFT JOIN schedules s ON s.post_id = p.id AND s.status IN ('active', 'paused')
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset);

    res.json({
      success: true,
      data: {
        posts: posts.map(formatPostWithSchedule),
        total: countResult.total,
        page: pageNum,
      },
    });
  } catch (error) {
    console.error('[Posts] List error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch posts.',
    });
  }
});

/**
 * GET /api/posts/:id
 * Get a single post with schedule info and version history.
 */
router.get('/:id', (req, res) => {
  try {
    const post = db.prepare(`
      SELECT p.*, s.id as schedule_id, s.scheduled_at, s.timezone, s.is_recurring,
             s.recurrence_pattern, s.requires_approval, s.status as schedule_status,
             s.next_run_at
      FROM posts p
      LEFT JOIN schedules s ON s.post_id = p.id AND s.status IN ('active', 'paused', 'completed')
      WHERE p.id = ? AND p.user_id = ?
    `).get(req.params.id, req.user.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    // Fetch version history
    const versions = db.prepare(`
      SELECT id, version, content, created_at
      FROM post_versions
      WHERE post_id = ?
      ORDER BY version DESC
    `).all(post.id);

    res.json({
      success: true,
      data: {
        ...formatPostWithSchedule(post),
        versions: versions.map(v => ({
          id: v.id,
          version: v.version,
          content: v.content,
          createdAt: v.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('[Posts] Get error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post.',
    });
  }
});

/**
 * PUT /api/posts/:id
 * Update a post's content and/or metadata.
 */
router.put('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    const { content, topics, customTopics, tone, length, useHeadings, useEmojis, useHashtags } = req.body;

    // Update the post
    db.prepare(`
      UPDATE posts
      SET content = COALESCE(?, content),
          topics = COALESCE(?, topics),
          custom_topics = COALESCE(?, custom_topics),
          tone = COALESCE(?, tone),
          length = COALESCE(?, length),
          use_headings = COALESCE(?, use_headings),
          use_emojis = COALESCE(?, use_emojis),
          use_hashtags = COALESCE(?, use_hashtags),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      content || null,
      topics ? JSON.stringify(topics) : null,
      customTopics !== undefined ? customTopics : null,
      tone || null,
      length || null,
      useHeadings !== undefined ? (useHeadings ? 1 : 0) : null,
      useEmojis !== undefined ? (useEmojis ? 1 : 0) : null,
      useHashtags !== undefined ? (useHashtags ? 1 : 0) : null,
      req.params.id,
    );

    // If content was updated, save a new version
    if (content && content !== post.content) {
      const lastVersion = db.prepare(
        'SELECT MAX(version) as maxVersion FROM post_versions WHERE post_id = ?'
      ).get(post.id);

      const nextVersion = (lastVersion?.maxVersion || 0) + 1;

      db.prepare(`
        INSERT INTO post_versions (post_id, content, version)
        VALUES (?, ?, ?)
      `).run(post.id, content, nextVersion);
    }

    // Fetch and return the updated post
    const updatedPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);

    res.json({
      success: true,
      data: formatPost(updatedPost),
    });
  } catch (error) {
    console.error('[Posts] Update error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update post.',
    });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete a post and its associated data.
 */
router.delete('/:id', (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    // Delete the post (cascading will handle versions and schedules)
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);

    res.json({
      success: true,
      data: { message: 'Post deleted successfully.' },
    });
  } catch (error) {
    console.error('[Posts] Delete error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete post.',
    });
  }
});

/**
 * POST /api/posts/:id/publish
 * Publish a post to LinkedIn immediately.
 */
router.post('/:id/publish', async (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    if (post.status === 'published') {
      return res.status(400).json({
        success: false,
        error: 'Post has already been published.',
      });
    }

    // Fetch user's LinkedIn token
    const user = db.prepare(
      'SELECT linkedin_id, access_token_encrypted FROM users WHERE id = ?'
    ).get(req.user.id);

    if (!user || !user.access_token_encrypted) {
      return res.status(400).json({
        success: false,
        error: 'LinkedIn account is not connected. Please connect your account first.',
      });
    }

    const accessToken = decrypt(user.access_token_encrypted);

    // Publish to LinkedIn
    const result = await linkedin.publishPost(accessToken, user.linkedin_id, post.content);

    // Update post status
    db.prepare(`
      UPDATE posts
      SET status = 'published', linkedin_post_id = ?, published_at = CURRENT_TIMESTAMP,
          error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(result.linkedinPostId, post.id);

    const updatedPost = db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id);

    res.json({
      success: true,
      data: formatPost(updatedPost),
    });
  } catch (error) {
    console.error('[Posts] Publish error:', error.message);

    // Save the error to the post
    db.prepare(`
      UPDATE posts
      SET status = 'failed', error_message = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(error.message, req.params.id);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to publish post to LinkedIn.',
    });
  }
});

/**
 * POST /api/posts/:id/regenerate
 * Regenerate a post with the same parameters using Gemini AI.
 */
router.post('/:id/regenerate', async (req, res) => {
  try {
    const post = db.prepare('SELECT * FROM posts WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        error: 'Post not found.',
      });
    }

    // Fetch the user's Gemini API key (from settings or .env fallback)
    const settings = db.prepare(
      'SELECT gemini_api_key_encrypted FROM settings WHERE user_id = ?'
    ).get(req.user.id);

    let apiKey = null;
    if (settings && settings.gemini_api_key_encrypted) {
      apiKey = decrypt(settings.gemini_api_key_encrypted);
    } else if (process.env.GEMINI_API_KEY) {
      apiKey = process.env.GEMINI_API_KEY;
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        error: 'Gemini API key is not configured. Please add it in Settings or set GEMINI_API_KEY in your .env file.',
      });
    }

    // Fetch existing posts for uniqueness context
    const existingPosts = db.prepare(`
      SELECT id, content FROM posts
      WHERE user_id = ? AND status IN ('draft', 'published', 'scheduled')
      ORDER BY created_at DESC
      LIMIT 20
    `).all(req.user.id);

    const existingContents = existingPosts.map(p => p.content);

    // Parse topics from JSON string
    let topics = [];
    try {
      topics = post.topics ? JSON.parse(post.topics) : [];
    } catch {
      topics = [];
    }

    // Regenerate with the same parameters
    const content = await gemini.generatePost({
      apiKey,
      topics,
      customTopics: post.custom_topics || '',
      tone: post.tone || 'professional',
      length: post.length || 'medium',
      useHeadings: !!post.use_headings,
      useEmojis: !!post.use_emojis,
      useHashtags: !!post.use_hashtags,
      existingPosts: existingContents,
    });

    // Update the post content
    db.prepare(`
      UPDATE posts
      SET content = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(content, post.id);

    // Save as a new version
    const lastVersion = db.prepare(
      'SELECT MAX(version) as maxVersion FROM post_versions WHERE post_id = ?'
    ).get(post.id);

    const nextVersion = (lastVersion?.maxVersion || 0) + 1;

    db.prepare(`
      INSERT INTO post_versions (post_id, content, version)
      VALUES (?, ?, ?)
    `).run(post.id, content, nextVersion);

    // Check similarity
    const similarityResult = uniqueness.checkSimilarity(content, existingPosts);

    const similarPosts = [];
    if (similarityResult.mostSimilarPost) {
      similarPosts.push({
        id: similarityResult.mostSimilarPost.id,
        content: similarityResult.mostSimilarPost.content,
        score: similarityResult.mostSimilarPost.score,
      });
    }

    res.json({
      success: true,
      data: {
        content,
        similarPosts,
        similarityWarning: similarityResult.isTooSimilar
          ? 'This post is quite similar to an existing post. Consider editing for more originality.'
          : null,
      },
    });
  } catch (error) {
    console.error('[Posts] Regenerate error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to regenerate post.',
    });
  }
});

/**
 * Format a post record for the API response.
 */
function formatPost(post) {
  let topics = null;
  try {
    topics = post.topics ? JSON.parse(post.topics) : null;
  } catch {
    topics = post.topics;
  }

  return {
    id: post.id,
    userId: post.user_id,
    content: post.content,
    topics,
    customTopics: post.custom_topics,
    tone: post.tone,
    length: post.length,
    useHeadings: !!post.use_headings,
    useEmojis: !!post.use_emojis,
    useHashtags: !!post.use_hashtags,
    status: post.status,
    linkedinPostId: post.linkedin_post_id,
    errorMessage: post.error_message,
    publishedAt: post.published_at,
    similarityScore: post.similarity_score,
    similarPostId: post.similar_post_id,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  };
}

/**
 * Format a post with optional schedule info for the API response.
 */
function formatPostWithSchedule(post) {
  const formatted = formatPost(post);

  if (post.schedule_id) {
    formatted.schedule = {
      id: post.schedule_id,
      scheduledAt: post.scheduled_at,
      timezone: post.timezone,
      isRecurring: !!post.is_recurring,
      recurrencePattern: post.recurrence_pattern ? JSON.parse(post.recurrence_pattern) : null,
      requiresApproval: !!post.requires_approval,
      status: post.schedule_status,
      nextRunAt: post.next_run_at,
    };
  } else {
    formatted.schedule = null;
  }

  return formatted;
}

module.exports = router;
