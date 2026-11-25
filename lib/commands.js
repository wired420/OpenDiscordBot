const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes } = require('discord.js');
const { logIt } = require('./logger');

const commandsRoot = path.join(__dirname, '..', 'commands');

// Load every command module under commands/<folder>/*.js.
// Clears the require cache first so edited files are picked up on /reload.
function loadCommands() {
    const commands = new Collection();

    for (const folder of fs.readdirSync(commandsRoot)) {
        const folderPath = path.join(commandsRoot, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;

        for (const file of fs.readdirSync(folderPath).filter(f => f.endsWith('.js'))) {
            const filePath = path.join(folderPath, file);
            delete require.cache[require.resolve(filePath)];

            try {
                const command = require(filePath);
                if ('data' in command && 'execute' in command) {
                    commands.set(command.data.name, command);
                } else {
                    logIt(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`, true);
                }
            } catch (error) {
                logIt(`Failed to load command ${filePath}: ${error.stack ?? error}`, true);
            }
        }
    }

    return commands;
}

// Register the given commands globally with Discord (replaces the existing set).
async function deployCommands(token, clientId, commands) {
    const body = [...commands.values()].map(c => c.data.toJSON());
    const rest = new REST().setToken(token);
    return rest.put(Routes.applicationCommands(clientId), { body });
}

module.exports = { loadCommands, deployCommands };
