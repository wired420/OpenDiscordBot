// Registers all slash commands globally. Run with: npm run deploy
const config = require('./config.json');
const { loadCommands, deployCommands } = require('./lib/commands');

(async () => {
    const commands = loadCommands();
    try {
        console.log(`Started refreshing ${commands.size} application (/) commands.`);
        const data = await deployCommands(config.token, config.clientId, commands);
        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
        process.exitCode = 1;
    }
})();
