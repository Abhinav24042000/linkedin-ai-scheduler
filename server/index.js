/**
 * LinkedIn Post Scheduler - Server Entry Point
 *
 * Sets up Express with middleware, session management, routes, and the scheduler service.
 */

const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const express = require('express');
const cors = require('cors');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const db = require('./db');
const scheduler = require('./services/scheduler');

// ─── Minimal SQLite Session Store ───────────────────────────────────────────────
// A lightweight express-session store backed by the same better-sqlite3 connection.
// This gives us persistent sessions without adding another dependency.

class SQLiteStore extends session.Store {
  constructor(database) {
    super();
    this.db = database;

    // Create sessions table if it doesn't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expired DATETIME NOT NULL
      )
    `);

    // Prepare statements for performance
    this._get = this.db.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired > datetime(\'now\')');
    this._set = this.db.prepare('INSERT OR REPLACE INTO sessions (sid, sess, expired) VALUES (?, ?, datetime(\'now\', \'+\' || ? || \' seconds\'))');
    this._destroy = this.db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._touch = this.db.prepare('UPDATE sessions SET expired = datetime(\'now\', \'+\' || ? || \' seconds\') WHERE sid = ?');
    this._cleanup = this.db.prepare('DELETE FROM sessions WHERE expired <= datetime(\'now\')');

    // Periodic cleanup of expired sessions (every 15 minutes)
    this._cleanupInterval = setInterval(() => {
      try {
        this._cleanup.run();
      } catch (err) {
        console.error('[SessionStore] Cleanup error:', err.message);
      }
    }, 15 * 60 * 1000);

    // Don't let the cleanup interval keep the process alive
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  get(sid, callback) {
    try {
      const row = this._get.get(sid);
      if (row) {
        const sess = JSON.parse(row.sess);
        callback(null, sess);
      } else {
        callback(null, null);
      }
    } catch (err) {
      callback(err);
    }
  }

  set(sid, sess, callback) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) ? Math.floor(sess.cookie.maxAge / 1000) : 86400; // default 24h
      const serialized = JSON.stringify(sess);
      this._set.run(sid, serialized, maxAge);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  destroy(sid, callback) {
    try {
      this._destroy.run(sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  touch(sid, sess, callback) {
    try {
      const maxAge = (sess.cookie && sess.cookie.maxAge) ? Math.floor(sess.cookie.maxAge / 1000) : 86400;
      this._touch.run(maxAge, sid);
      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  close() {
    if (this._cleanupInterval) {
      clearInterval(this._cleanupInterval);
    }
  }
}

// ─── Express App Setup ──────────────────────────────────────────────────────────

const app = express();

// Trust proxy in production (for secure cookies behind reverse proxies)
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// CORS configuration — allow the frontend origin with credentials
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session management with SQLite store
const sessionStore = new SQLiteStore(db);

app.use(session({
  store: sessionStore,
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  name: 'linkedin_scheduler_sid',
  cookie: {
    secure: config.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: config.NODE_ENV === 'production' ? 'none' : 'lax',
  },
}));

// ─── API Routes ─────────────────────────────────────────────────────────────────

app.use('/api/auth', require('./routes/auth'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/schedules', require('./routes/schedule'));
app.use('/api/history', require('./routes/history'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      activeJobs: scheduler.getActiveJobCount(),
      timestamp: new Date().toISOString(),
    },
  });
});

// ─── Static Files (Production) ──────────────────────────────────────────────────

if (config.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientBuildPath));

  // SPA fallback: serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

// ─── Global Error Handler ───────────────────────────────────────────────────────

app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  console.error(err.stack);

  res.status(500).json({
    success: false,
    error: config.NODE_ENV === 'development' ? err.message : 'Internal server error.',
  });
});

// 404 handler for unmatched API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Server Startup ─────────────────────────────────────────────────────────────

const server = app.listen(config.PORT, () => {
  console.log(`\n🚀 LinkedIn Post Scheduler Server`);
  console.log(`   Environment: ${config.NODE_ENV}`);
  console.log(`   Server:      http://localhost:${config.PORT}`);
  console.log(`   Client:      ${config.CLIENT_URL}`);
  console.log(`   Database:    ${path.resolve(config.DB_PATH)}\n`);

  // Initialize the scheduler service
  scheduler.init(db);
});

// ─── Graceful Shutdown ──────────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully...`);

  // Close the HTTP server
  server.close(() => {
    console.log('[Server] HTTP server closed');

    // Close the session store cleanup interval
    sessionStore.close();

    // Close the database connection
    require('./db').close();

    console.log('[Server] Shutdown complete');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});

module.exports = app;
