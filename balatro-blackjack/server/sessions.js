import { createHash, randomBytes } from 'crypto';
import db from './db.js';

const COOKIE_NAME = 'bustatro_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Only a hash of the token is stored, so a leaked database cannot be used to
// hijack sessions.
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function startSession(res, username) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
  db.prepare('INSERT INTO sessions (token_hash, username, expires_at) VALUES (?, ?, ?)')
    .run(hashToken(token), username, expiresAt);

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api',
    maxAge: SESSION_TTL_MS,
  });
}

export function endSession(req, res) {
  const token = readToken(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  res.clearCookie(COOKIE_NAME, { path: '/api' });
}

export function sessionUser(req) {
  const token = readToken(req);
  if (!token) {
    return null;
  }
  const session = db.prepare('SELECT username, expires_at FROM sessions WHERE token_hash = ?')
    .get(hashToken(token));
  if (!session || session.expires_at <= Date.now()) {
    return null;
  }
  return session.username;
}

export function requireSession(req, res, next) {
  const username = sessionUser(req);
  if (!username) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  req.username = username;
  next();
}

function readToken(req) {
  const header = req.headers.cookie;
  if (!header) {
    return null;
  }
  for (const part of header.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === COOKIE_NAME) {
      return value.join('=');
    }
  }
  return null;
}
