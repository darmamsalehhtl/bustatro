import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize the SQLite database (this will create database.sqlite if it doesn't exist)
const db = new Database(path.join(__dirname, 'database.sqlite'));

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS game_states (
    username TEXT PRIMARY KEY,
    state JSON NOT NULL,
    FOREIGN KEY(username) REFERENCES users(username)
  );
`);

export default db;
