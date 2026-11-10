import express from 'express';
import db from './db.js';
import { securityHeaders } from './security.js';
import { isValidUsername, validateCredentials, validateState } from './validation.js';

const app = express();
const PORT = 3001;

app.disable('x-powered-by');
app.use(securityHeaders);
app.use(express.json({ limit: '100kb' }));

// Helper endpoints
app.post('/api/register', (req, res) => {
  const invalid = validateCredentials(req.body, { isRegistration: true });
  if (invalid) {
    return res.status(400).json({ error: invalid });
  }
  const { username, password } = req.body;

  try {
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    stmt.run(username, password);
    res.json({ success: true, message: 'User registered' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', (req, res) => {
  if (validateCredentials(req.body)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const { username, password } = req.body;

  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
  const user = stmt.get(username, password);
  
  if (user) {
    res.json({ success: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Save game state
app.post('/api/state', (req, res) => {
  const { username, state } = req.body ?? {};

  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }
  const invalidState = validateState(state);
  if (invalidState) {
    return res.status(400).json({ error: invalidState });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO game_states (username, state) 
      VALUES (?, ?) 
      ON CONFLICT(username) DO UPDATE SET state = excluded.state
    `);
    stmt.run(username, JSON.stringify(state));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save state' });
  }
});

// Load game state
app.get('/api/state/:username', (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ error: 'Invalid username' });
  }

  try {
    const stmt = db.prepare('SELECT state FROM game_states WHERE username = ?');
    const row = stmt.get(username);
    
    if (row) {
      res.json({ success: true, state: JSON.parse(row.state) });
    } else {
      res.json({ success: false, state: null });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to load state' });
  }
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
