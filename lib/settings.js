// Per-server settings stored in SQLite. Unset keys fall back to the defaults below.
const config = require('../config.json');
const db = require('./db');

const DEFINITIONS = {
    prefix:        { default: config.prefix || '!', description: 'Prefix for text commands like !help' },
    logChannel:    { default: null,  description: 'Channel the bot logs to' },
    everyoneRole:  { default: null,  description: 'Role allowed to use /everyone (admins can always use it)' },
    verifyEnabled: { default: false, description: 'Give a role when members react to the rules message' },
    verifyMessage: { default: null,  description: 'Id of the rules message' },
    verifyRole:    { default: null,  description: 'Role given after reacting' },
    verifyEmoji:   { default: '✅',  description: 'Emoji members must react with' },
};

const stmts = {
    get:    db.prepare('SELECT value FROM guild_settings WHERE guild_id = ? AND key = ?'),
    all:    db.prepare('SELECT key, value FROM guild_settings WHERE guild_id = ?'),
    set:    db.prepare(`INSERT INTO guild_settings (guild_id, key, value) VALUES (?, ?, ?)
                        ON CONFLICT (guild_id, key) DO UPDATE SET value = excluded.value`),
    remove: db.prepare('DELETE FROM guild_settings WHERE guild_id = ? AND key = ?'),
    clear:  db.prepare('DELETE FROM guild_settings WHERE guild_id = ?'),
};

function checkKey(key) {
    if (!(key in DEFINITIONS)) throw new Error(`Unknown setting: ${key}`);
}

function get(guildId, key) {
    checkKey(key);
    if (!guildId) return DEFINITIONS[key].default;
    const row = stmts.get.get(guildId, key);
    return row ? JSON.parse(row.value) : DEFINITIONS[key].default;
}

// All settings for a guild, defaults filled in.
function getAll(guildId) {
    const result = Object.fromEntries(Object.entries(DEFINITIONS).map(([k, d]) => [k, d.default]));
    for (const { key, value } of stmts.all.all(guildId)) {
        if (key in DEFINITIONS) result[key] = JSON.parse(value);
    }
    return result;
}

// Setting a value to null or undefined resets it to the default.
function set(guildId, key, value) {
    checkKey(key);
    if (value === null || value === undefined) stmts.remove.run(guildId, key);
    else stmts.set.run(guildId, key, JSON.stringify(value));
}

const setMany = db.transaction((guildId, values) => {
    for (const [key, value] of Object.entries(values)) set(guildId, key, value);
});

function clearGuild(guildId) {
    stmts.clear.run(guildId);
}

module.exports = { DEFINITIONS, get, getAll, set, setMany, clearGuild };
