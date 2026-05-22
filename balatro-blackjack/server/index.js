import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Helper endpoints
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

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
  const { username, state } = req.body;
  
  if (!username || !state) {
    return res.status(400).json({ error: 'Username and state required' });
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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
