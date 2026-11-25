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

// Send a message to the configured log channel. Never throws.
async function channelLog(client, message) {
    if (!config.logChannelId) return;
    try {
        const channel = await client.channels.fetch(config.logChannelId);
        await channel.send({ content: message, allowedMentions: { parse: [] } });
    } catch (error) {
        logIt(`Could not write to log channel ${config.logChannelId}: ${error.message}`, true);
    }
}

module.exports = { logIt, debug, channelLog };
