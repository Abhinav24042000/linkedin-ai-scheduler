/**
 * History Routes
 * Returns published and failed posts for the authenticated user.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// All history routes require authentication
router.use(requireAuth);

/**
 * GET /api/history
 * Returns posts with status 'published' or 'failed', ordered by published_at DESC.
 * Supports pagination via page and limit query parameters.
 */
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    // Get total count of published + failed posts
    const countResult = db.prepare(`
      SELECT COUNT(*) as total
      FROM posts
      WHERE user_id = ? AND status IN ('published', 'failed')
    `).get(req.user.id);

    // Get paginated history posts
    const posts = db.prepare(`
      SELECT id, user_id, content, topics, custom_topics, tone, length,
             use_headings, use_emojis, use_hashtags, status, linkedin_post_id,
             error_message, published_at, created_at, updated_at
      FROM posts
      WHERE user_id = ? AND status IN ('published', 'failed')
      ORDER BY COALESCE(published_at, updated_at) DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, limitNum, offset);

    res.json({
      success: true,
      data: {
        posts: posts.map(post => {
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
            createdAt: post.created_at,
            updatedAt: post.updated_at,
          };
        }),
        total: countResult.total,
        page: pageNum,
      },
    });
  } catch (error) {
    console.error('[History] List error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch post history.',
    });
  }
});

module.exports = router;
