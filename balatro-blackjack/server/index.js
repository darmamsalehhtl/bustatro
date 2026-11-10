import express from 'express';
import db from './db.js';
import { rateLimit, securityHeaders } from './security.js';
import { DUMMY_HASH, hashPassword, verifyPassword } from './passwords.js';
import { endSession, requireSession, sessionUser, startSession } from './sessions.js';
import { validateCredentials, validateState } from './validation.js';

const app = express();
const PORT = 3001;

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

app.post('/api/register', authLimiter, async (req, res) => {
  const invalid = validateCredentials(req.body, { isRegistration: true });
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  const { username, password } = req.body;

  try {
    const passwordHash = await hashPassword(password);
    const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
    stmt.run(username, passwordHash);
    startSession(res, username);
    res.json({ success: true, username });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    throw error;
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  if (validateCredentials(req.body)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { username, password } = req.body;

  const user = db.prepare('SELECT password_hash FROM users WHERE username = ?').get(username);
  const matches = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);

  if (user && matches) {
    startSession(res, username);
    res.json({ success: true, username });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/logout', (req, res) => {
  endSession(req, res);
  res.json({ success: true });
});

app.get('/api/session', (req, res) => {
  const username = sessionUser(req);
  if (!username) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  res.json({ username });
});

// Game state belongs to the logged-in user; the username comes from the
// session, never from the request.
app.get('/api/state', requireSession, (req, res) => {
  const row = db.prepare('SELECT state FROM game_states WHERE username = ?').get(req.username);
  res.json({ state: row ? JSON.parse(row.state) : null });
});

app.put('/api/state', requireSession, (req, res) => {
  const { state } = req.body ?? {};
  const invalid = validateState(state);
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }

  db.prepare(`
    INSERT INTO game_states (username, state)
    VALUES (?, ?)
    ON CONFLICT(username) DO UPDATE SET state = excluded.state
  `).run(req.username, JSON.stringify(state));
  res.json({ success: true });
});

// Unknown errors are logged here and never sent to the client. Body-parser
// failures (malformed JSON, oversized body) carry a 4xx status and are safe
// to report as such.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status >= 400 && err.status < 500 ? err.status : 500;
  if (status === 500) {
    console.error(err);
  }
  const messages = { 400: 'Malformed request', 413: 'Request body too large' };
  res.status(status).json({ error: messages[status] ?? (status === 500 ? 'Internal server error' : 'Bad request') });
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
