/**
 * Database Module
 * Sets up SQLite database using better-sqlite3 with WAL mode.
 * Creates all required tables on initialization.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const config = require('./config');

// Ensure the data directory exists
const dbDir = path.dirname(path.resolve(config.DB_PATH));
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new Database(path.resolve(config.DB_PATH));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create all tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    linkedin_id TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    profile_url TEXT,
    avatar_url TEXT,
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gemini_api_key_encrypted TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    topics TEXT,
    custom_topics TEXT,
    tone TEXT DEFAULT 'professional',
    length TEXT DEFAULT 'medium',
    use_headings INTEGER DEFAULT 0,
    use_emojis INTEGER DEFAULT 0,
    use_hashtags INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft',
    linkedin_post_id TEXT,
    error_message TEXT,
    published_at DATETIME,
    similarity_score REAL,
    similar_post_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    schedule_type TEXT DEFAULT 'post',
    content_config TEXT,
    times_per_day TEXT,
    frequency TEXT DEFAULT 'daily',
    frequency_days TEXT,
    interval_days INTEGER DEFAULT 1,
    scheduled_at DATETIME,
    timezone TEXT DEFAULT 'UTC',
    is_recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT,
    requires_approval INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    last_run_at DATETIME,
    next_run_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS post_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    version INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Migrations for existing databases ─────────────────────────────────────────
try {
  const tableInfo = db.prepare('PRAGMA table_info(schedules)').all();
  const colNames = new Set(tableInfo.map(c => c.name));
  const newCols = [
    { name: 'title', type: 'TEXT' },
    { name: 'schedule_type', type: "TEXT DEFAULT 'post'" },
    { name: 'content_config', type: 'TEXT' },
    { name: 'times_per_day', type: 'TEXT' },
    { name: 'frequency', type: "TEXT DEFAULT 'daily'" },
    { name: 'frequency_days', type: 'TEXT' },
    { name: 'interval_days', type: 'INTEGER DEFAULT 1' },
  ];

  for (const col of newCols) {
    if (!colNames.has(col.name)) {
      db.prepare(`ALTER TABLE schedules ADD COLUMN ${col.name} ${col.type}`).run();
    }
  }

  // Check if post_id was NOT NULL in older schema and migrate if needed
  const postIdCol = tableInfo.find(c => c.name === 'post_id');
  if (postIdCol && postIdCol.notnull === 1) {
    db.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE schedules_migration (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT,
        schedule_type TEXT DEFAULT 'post',
        content_config TEXT,
        times_per_day TEXT,
        frequency TEXT DEFAULT 'daily',
        frequency_days TEXT,
        interval_days INTEGER DEFAULT 1,
        scheduled_at DATETIME,
        timezone TEXT DEFAULT 'UTC',
        is_recurring INTEGER DEFAULT 0,
        recurrence_pattern TEXT,
        requires_approval INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        last_run_at DATETIME,
        next_run_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO schedules_migration (id, post_id, user_id, title, schedule_type, content_config, times_per_day, frequency, frequency_days, interval_days, scheduled_at, timezone, is_recurring, recurrence_pattern, requires_approval, status, last_run_at, next_run_at, created_at, updated_at)
      SELECT id, post_id, user_id, title, schedule_type, content_config, times_per_day, frequency, frequency_days, interval_days, scheduled_at, timezone, is_recurring, recurrence_pattern, requires_approval, status, last_run_at, next_run_at, created_at, updated_at FROM schedules;
      DROP TABLE schedules;
      ALTER TABLE schedules_migration RENAME TO schedules;
      PRAGMA foreign_keys = ON;
    `);
  }
} catch (migErr) {
  console.warn('[DB Migration Warning]', migErr.message);
}

console.log('[DB] Database initialized successfully at', path.resolve(config.DB_PATH));

/**
 * Gracefully close the database connection
 */
const originalClose = db.close.bind(db);
function close() {
  try {
    if (db.open) {
      originalClose();
      console.log('[DB] Database connection closed');
    }
  } catch (error) {
    console.error('[DB] Error closing database:', error.message);
  }
}

db.close = close;
module.exports = db;
