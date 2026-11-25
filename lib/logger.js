const config = require('../config.json');

function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: true });
}

// Log to the console. Pass isError = true to log to stderr.
function logIt(message, isError = false) {
    const line = `[${config.appname}] ${timestamp()}> ${isError ? 'ERROR: ' : ''}${message}`;
    if (isError) console.error(line);
    else console.log(line);
}

// Log only when debugMode is on in config.json.
function debug(message) {
    if (config.debugMode) logIt(`[debug] ${message}`);
}

// Send a message to a server's configured log channel (the logChannel setting). Never throws.
async function channelLog(guild, message) {
    // Required lazily so logger.js can be loaded before the database exists.
    const settings = require('./settings');
    const channelId = guild && settings.get(guild.id, 'logChannel');
    if (!channelId) return;
    try {
        const channel = await guild.channels.fetch(channelId);
        await channel.send({ content: message, allowedMentions: { parse: [] } });
    } catch (error) {
        logIt(`Could not write to log channel ${channelId} on ${guild.name}: ${error.message}`, true);
    }
}

module.exports = { logIt, debug, channelLog };
