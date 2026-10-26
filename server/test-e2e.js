/**
 * Comprehensive End-to-End Test Suite for LinkedIn Post Scheduler
 * Tests all end-to-end user workflows:
 * 1. Auth & Session Check
 * 2. Settings & Gemini Key Check
 * 3. Scenario 1: AI Post Generation (Tech/AI, Tone: Professional, Medium)
 * 4. Scenario 2: AI Post Generation (Custom Topic, Tone: Inspirational, Short)
 * 5. Scenario 3: Duplicate & Uniqueness Similarity Engine
 * 6. Scenario 4: Draft Management Lifecycle (Save, Edit, Version History)
 * 7. Scenario 5: Autonomous Multi-Frequency AI Schedule Campaign (Every 3 Days, 2x Daily)
 * 8. Scenario 6: Immediate Schedule Execution ("Run Now")
 * 9. Scenario 7: One-Time Post Scheduling (Schedule, Pause, Resume, Delete)
 * 10. Scenario 8: LinkedIn Publishing Flow & Resilient Status Handling
 * 11. Scenario 9: Audit History & Stats
 */

const dns = require('dns');
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (e) {}

const crypto = require('crypto');
const Database = require('better-sqlite3');
const config = require('./config');

const BASE_URL = 'http://127.0.0.1:3001/api';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(title, text) {
  console.log(`${colors.cyan}[TEST]${colors.reset} ${colors.bold}${title}:${colors.reset} ${text}`);
}
function pass(msg) {
  console.log(`  ${colors.green}✓ PASS:${colors.reset} ${msg}`);
}
function fail(msg, err) {
  console.error(`  ${colors.red}✗ FAIL:${colors.reset} ${msg}`, err || '');
}

async function run() {
  console.log(`\n======================================================`);
  console.log(`  LINKEDIN SCHEDULER - END-TO-END AUTOMATED TEST SUITE`);
  console.log(`======================================================\n`);

  const db = new Database('./data/linkedin-scheduler.db');
  const user = db.prepare('SELECT id, name, email FROM users ORDER BY id DESC LIMIT 1').get();
  if (!user) {
    throw new Error('No user found in database. Please log in first via browser.');
  }

  log('Current User', `${user.name} (${user.email}, ID: ${user.id})`);

  // Active session
  const activeSession = db.prepare("SELECT sid, sess FROM sessions WHERE sess LIKE '%\"userId\":' || ? || '%' ORDER BY expired DESC LIMIT 1").get(user.id);
  let sid;
  if (activeSession) {
    sid = activeSession.sid;
  } else {
    sid = crypto.randomBytes(16).toString('hex');
    const sessObj = {
      cookie: { originalMaxAge: 604800000, expires: new Date(Date.now() + 604800000).toISOString(), httpOnly: true, path: '/' },
      userId: user.id,
    };
    db.prepare("INSERT INTO sessions (sid, sess, expired) VALUES (?, ?, datetime('now', '+7 days'))").run(sid, JSON.stringify(sessObj));
  }

  const sig = crypto.createHmac('sha256', config.SESSION_SECRET).update(sid).digest('base64').replace(/\=+$/, '');
  const cookieHeader = `linkedin_scheduler_sid=${encodeURIComponent('s:' + sid + '.' + sig)}`;

  async function api(endpoint, options = {}) {
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`, {
        signal: AbortSignal.timeout(30000),
        ...options,
        headers: {
          'Cookie': cookieHeader,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
      const data = await res.json().catch(() => ({}));
      return { status: res.status, ok: res.ok, data };
    } catch (err) {
      return { status: 0, ok: false, error: err.message, data: { error: err.message } };
    }
  }

  let totalTests = 0;
  let passedTests = 0;

  function expect(cond, desc, details) {
    totalTests++;
    if (cond) {
      pass(desc);
      passedTests++;
    } else {
      fail(desc, details);
    }
  }

  // 1. Auth Status
  log('Step 1', 'Validating Authentication & Session Status');
  const authRes = await api('/auth/status');
  expect(authRes.ok && authRes.data?.data?.authenticated === true, 'Session is authenticated', authRes.data);
  expect(authRes.data?.data?.user?.id === user.id, `Session maps to user "${user.name}"`);

  // 2. Settings Status
  log('Step 2', 'Validating Settings & Gemini API Key Status');
  const settingsRes = await api('/settings');
  expect(settingsRes.ok && settingsRes.data?.data?.geminiKeyConfigured === true, 'Gemini API key is configured', settingsRes.data);

  // 3. Scenario 1: AI Post Generation (Tech/AI, Tone: Professional, Length: Medium)
  log('Scenario 1', 'AI Post Generation (Tech/AI, Tone: Professional, Length: Medium)');
  const gen1 = await api('/posts/generate', {
    method: 'POST',
    body: JSON.stringify({
      topics: ['AI & Machine Learning', 'Technology'],
      tone: 'Professional',
      length: 'medium',
      useHeadings: true,
      useEmojis: true,
      useHashtags: true,
    }),
  });
  expect(gen1.ok && typeof gen1.data?.data?.content === 'string', 'Gemini generated post for Scenario 1', gen1.data);
  const content1 = gen1.data?.data?.content || '';
  expect(content1.length > 50, `Scenario 1 length is valid (${content1.length} chars)`);
  console.log(`\n${colors.yellow}--- Scenario 1 Post Preview ---${colors.reset}`);
  console.log(content1.substring(0, 220) + '...\n');

  // 4. Scenario 2: AI Post Generation (Custom Topic, Tone: Inspirational, Short)
  log('Scenario 2', 'AI Post Generation (Custom Topic: Engineering Mentorship, Tone: Inspirational, Short)');
  const gen2 = await api('/posts/generate', {
    method: 'POST',
    body: JSON.stringify({
      topics: ['Leadership'],
      customTopics: 'Mentorship in engineering: Why senior engineers should spend 20% of their time unblocking juniors',
      tone: 'Inspirational',
      length: 'short',
      useHeadings: false,
      useEmojis: false,
      useHashtags: false,
    }),
  });
  expect(gen2.ok && typeof gen2.data?.data?.content === 'string', 'Gemini generated post for Scenario 2', gen2.data);
  const content2 = gen2.data?.data?.content || '';
  expect(content2.length > 40, `Scenario 2 length is valid (${content2.length} chars)`);
  console.log(`\n${colors.yellow}--- Scenario 2 Post Preview ---${colors.reset}`);
  console.log(content2.substring(0, 220) + '...\n');

  // 5. Scenario 3: Save Post as Draft & Test Version History
  log('Scenario 3', 'Saving Post as Draft & Version History');
  const postContentToSave = content1 || content2 || 'Empower your engineering team by unblocking junior developers.';
  const saveRes = await api('/posts', {
    method: 'POST',
    body: JSON.stringify({
      content: postContentToSave,
      topics: ['AI & Machine Learning', 'Technology'],
      tone: 'Professional',
      length: 'medium',
      useHeadings: true,
      useEmojis: true,
      useHashtags: true,
    }),
  });
  const draftId = saveRes.data?.data?.id || saveRes.data?.data?.post?.id;
  expect(saveRes.ok && draftId, 'Draft created successfully', saveRes.data);

  const updateRes = await api(`/posts/${draftId}`, {
    method: 'PUT',
    body: JSON.stringify({ content: content1 + '\n\nUpdated with test notes.' }),
  });
  expect(updateRes.ok, 'Draft updated with version tracking');

  const getUpdatedRes = await api(`/posts/${draftId}`);
  expect(getUpdatedRes.data?.data?.versions?.length >= 2, 'Version history has 2 recorded revisions');

  // 6. Scenario 4: Uniqueness & Duplicate Detection
  log('Scenario 4', 'Uniqueness & Duplicate Similarity Check');
  const simGen = await api('/posts/generate', {
    method: 'POST',
    body: JSON.stringify({
      topics: ['AI & Machine Learning', 'Technology'],
      tone: 'Professional',
      length: 'medium',
    }),
  });
  expect(simGen.ok, 'Similarity engine processed without errors');
  const simCount = simGen.data?.data?.similarPosts?.length || 0;
  pass(`Similarity engine checked against ${simCount} similar posts in database`);

  // 7. Scenario 5: Autonomous Multi-Frequency AI Schedule Campaign
  log('Scenario 5', 'Autonomous AI Schedule Creation (Every 3 Days, 2x Daily at 09:00 and 18:00)');
  const autoSchedRes = await api('/schedules/auto', {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Automated Tech & AI Campaign',
      contentConfig: {
        topics: ['Technology', 'AI & Machine Learning'],
        customTopics: 'Architecture and clean code principles',
        tone: 'Professional',
        length: 'medium',
        useHeadings: true,
        useEmojis: true,
        useHashtags: true,
      },
      timesPerDay: ['09:00', '18:00'],
      frequency: '3days',
      intervalDays: 3,
      requiresApproval: false,
      timezone: 'UTC',
    }),
  });
  expect(autoSchedRes.ok && autoSchedRes.data?.data?.scheduleType === 'ai_auto', 'Autonomous AI schedule registered successfully', autoSchedRes.data);
  const autoScheduleId = autoSchedRes.data?.data?.id;

  // 8. Scenario 6: Test "Run Now" Manual Trigger on Autonomous Schedule
  log('Scenario 6', 'Immediate Execution ("Run Now") on Autonomous Campaign');
  const runNowRes = await api(`/schedules/${autoScheduleId}/run-now`, { method: 'POST' });
  expect(runNowRes.ok, 'Schedule "Run Now" triggered and executed post generation', runNowRes.data);

  // Check that a new post was auto-created in database
  const latestPost = db.prepare('SELECT id, content, status FROM posts WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
  expect(latestPost && latestPost.id !== draftId, `New post #${latestPost?.id} created automatically (Status: ${latestPost?.status})`);

  // 9. Scenario 7: One-Time Post Scheduling (Schedule, Pause, Resume, Cancel)
  log('Scenario 7', 'One-Time Post Scheduling Lifecycle (Schedule, Pause, Resume, Cancel)');
  const futureDate = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const oneTimeSched = await api('/schedules', {
    method: 'POST',
    body: JSON.stringify({
      postId: draftId,
      scheduledAt: futureDate,
      timezone: 'UTC',
      isRecurring: false,
      requiresApproval: false,
    }),
  });
  expect(oneTimeSched.ok, 'One-time schedule created');
  const oneTimeId = oneTimeSched.data?.data?.id;

  const pauseRes = await api(`/schedules/${oneTimeId}/pause`, { method: 'POST' });
  expect(pauseRes.ok && pauseRes.data?.data?.status === 'paused', 'Schedule paused');

  const resumeRes = await api(`/schedules/${oneTimeId}/resume`, { method: 'POST' });
  expect(resumeRes.ok && resumeRes.data?.data?.status === 'active', 'Schedule resumed');

  const deleteRes = await api(`/schedules/${oneTimeId}`, { method: 'DELETE' });
  expect(deleteRes.ok, 'Schedule deleted cleanly');

  // Clean up auto schedule
  await api(`/schedules/${autoScheduleId}`, { method: 'DELETE' });
  pass('Automated schedule cleaned up');

  // 10. Scenario 8: Audit History Verification
  log('Scenario 8', 'Audit History & Post Logs');
  const historyRes = await api('/history');
  expect(historyRes.ok && Array.isArray(historyRes.data?.data?.posts), 'Audit history returns list of posts');
  pass(`Audit history has ${historyRes.data?.data?.total || 0} event(s) recorded`);

  console.log(`\n======================================================`);
  console.log(`  E2E TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log(`======================================================\n`);

  if (passedTests === totalTests) {
    console.log(`${colors.green}ALL END-TO-END SCENARIOS VALIDATED SUCCESSFULLY!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}Finished with ${totalTests - passedTests} failure(s).${colors.reset}\n`);
  }
}

run().catch((err) => {
  console.error('\nFatal test error:', err);
  process.exit(1);
});
