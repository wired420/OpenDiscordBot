// Temporary bans: stored in SQLite and lifted by a timer, so they survive restarts.
const db = require('./db');
const { logIt, channelLog } = require('./logger');

const CHECK_INTERVAL_MS = 60_000;

const stmts = {
    add:    db.prepare(`INSERT INTO temp_bans (guild_id, user_id, unban_at, reason) VALUES (?, ?, ?, ?)
                        ON CONFLICT (guild_id, user_id) DO UPDATE SET unban_at = excluded.unban_at, reason = excluded.reason`),
    due:    db.prepare('SELECT guild_id, user_id FROM temp_bans WHERE unban_at <= ?'),
    remove: db.prepare('DELETE FROM temp_bans WHERE guild_id = ? AND user_id = ?'),
    clear:  db.prepare('DELETE FROM temp_bans WHERE guild_id = ?'),
};

function add(guildId, userId, unbanAt, reason) {
    stmts.add.run(guildId, userId, unbanAt, reason ?? null);
}

// A permanent ban must not be lifted by an older temp ban entry.
function remove(guildId, userId) {
    stmts.remove.run(guildId, userId);
}

function clearGuild(guildId) {
    stmts.clear.run(guildId);
}

async function liftBan(guild, userId) {
    try {
        await guild.bans.remove(userId, 'Temporary ban expired');
        remove(guild.id, userId);
        logIt(`Lifted temporary ban for ${userId} on ${guild.name}.`);
        await channelLog(guild, `[Wipe Spam]: Temporary ban for <@${userId}> (${userId}) has expired. They can rejoin with an invite.`);
    } catch (error) {
        if (error.code === 10026) { // Unknown Ban: someone already unbanned them
            remove(guild.id, userId);
        } else {
            logIt(`Could not lift temporary ban for ${userId} on ${guild.name} (will retry): ${error.message}`, true);
        }
    }
}

// Servers are processed in parallel; bans within one server go one at a time
// (they share a rate limit bucket).
async function processDue(client) {
    const byGuild = new Map();
    for (const { guild_id: guildId, user_id: userId } of stmts.due.all(Date.now())) {
        if (!byGuild.has(guildId)) byGuild.set(guildId, []);
        byGuild.get(guildId).push(userId);
    }

    await Promise.all([...byGuild].map(async ([guildId, userIds]) => {
        const guild = client.guilds.cache.get(guildId);
        for (const userId of userIds) {
            if (guild) await liftBan(guild, userId);
            else remove(guildId, userId); // bot is no longer in that server
        }
    }));
}

// Runs a pass now, then again CHECK_INTERVAL_MS after each pass finishes,
// so a slow pass (e.g. rate limited) never overlaps the next one.
function start(client) {
    const run = async () => {
        try {
            await processDue(client);
        } catch (error) {
            logIt(`Temp ban check failed: ${error.stack ?? error}`, true);
        }
        setTimeout(run, CHECK_INTERVAL_MS);
    };
    run();
}

module.exports = { add, remove, clearGuild, start, processDue };
