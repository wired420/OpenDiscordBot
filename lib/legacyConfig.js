// One-time import of the old single-server settings in config.json
// (logChannelId, verify*, everyoneRoleName) into the per-server settings table.
const config = require('../config.json');
const db = require('./db');
const settings = require('./settings');
const { logIt } = require('./logger');

const META_KEY = 'legacyConfigImported';

async function findGuild(client) {
    if (config.logChannelId) {
        try {
            const channel = await client.channels.fetch(config.logChannelId);
            if (channel?.guild) return channel.guild;
        } catch { /* fall through */ }
    }
    if (config.verifyRoleId) {
        return client.guilds.cache.find(g => g.roles.cache.has(config.verifyRoleId)) ?? null;
    }
    return null;
}

async function importLegacyConfig(client) {
    if (db.prepare('SELECT 1 FROM meta WHERE key = ?').get(META_KEY)) return;

    const hasLegacy = ['logChannelId', 'verifyMessageId', 'verifyRoleId'].some(k => /^\d{17,20}$/.test(config[k] ?? ''));
    const guild = hasLegacy ? await findGuild(client) : null;

    if (guild) {
        const values = {
            logChannel: /^\d+$/.test(config.logChannelId ?? '') ? config.logChannelId : null,
            verifyEnabled: Boolean(config.verifyEnable),
            verifyMessage: /^\d+$/.test(config.verifyMessageId ?? '') ? config.verifyMessageId : null,
            verifyRole: /^\d+$/.test(config.verifyRoleId ?? '') ? config.verifyRoleId : null,
            verifyEmoji: config.verifyEmoji || null,
        };
        const roleName = config.everyoneRoleName || 'Event Organizer';
        const everyoneRole = guild.roles.cache.find(r => r.name === roleName);
        if (everyoneRole) values.everyoneRole = everyoneRole.id;

        settings.setMany(guild.id, values);
        logIt(`Imported settings from config.json into server "${guild.name}" (${guild.id}). They can now be changed with /settings.`);
    } else if (hasLegacy) {
        logIt('config.json has old per-server settings, but none of the servers the bot is in match them. Skipping import.', true);
    }

    db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)').run(META_KEY, new Date().toISOString());
}

module.exports = { importLegacyConfig };
