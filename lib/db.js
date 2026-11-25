// SQLite database (better-sqlite3). One file: data/bot.db next to bot.js.
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'bot.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Schema migrations. Append new entries; never edit old ones.
const migrations = [
    `CREATE TABLE guild_settings (
        guild_id TEXT NOT NULL,
        key      TEXT NOT NULL,
        value    TEXT NOT NULL,          -- JSON-encoded
        PRIMARY KEY (guild_id, key)
    );
    CREATE TABLE meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );`,
];

const version = db.pragma('user_version', { simple: true });
for (let i = version; i < migrations.length; i++) {
    db.transaction(() => {
        db.exec(migrations[i]);
        db.pragma(`user_version = ${i + 1}`);
    })();
}

module.exports = db;
