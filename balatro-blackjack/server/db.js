import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { hashPasswordSync, isHashed } from './passwords.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the SQLite database (this will create database.sqlite if it doesn't exist)
const db = new Database(path.join(__dirname, 'database.sqlite'));

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_states (
    username TEXT PRIMARY KEY,
    state JSON NOT NULL,
    FOREIGN KEY(username) REFERENCES users(username)
  );
`);

// Databases created before password hashing stored plaintext in a
// `password` column. Rename it and hash every value still in plaintext.
const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
if (userColumns.includes('password')) {
  db.exec('ALTER TABLE users RENAME COLUMN password TO password_hash');
}

const plaintextUsers = db.prepare('SELECT username, password_hash FROM users').all()
  .filter((user) => !isHashed(user.password_hash));
if (plaintextUsers.length > 0) {
  const update = db.prepare('UPDATE users SET password_hash = ? WHERE username = ?');
  db.transaction(() => {
    for (const user of plaintextUsers) {
      update.run(hashPasswordSync(user.password_hash), user.username);
    }
  })();
  console.log(`Hashed ${plaintextUsers.length} plaintext password(s)`);
}

export default db;
