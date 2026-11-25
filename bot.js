// Show up as "opendiscordbot" in ps/top instead of "node".
process.title = 'opendiscordbot';

const config = require('./config.json');
const { Client, Events, GatewayIntentBits, MessageFlags, Partials } = require('discord.js');
const { logIt, debug, channelLog } = require('./lib/logger');
const { loadCommands } = require('./lib/commands');
const settings = require('./lib/settings');
const { importLegacyConfig } = require('./lib/legacyConfig');
const tempbans = require('./lib/tempbans');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction, Partials.User],
});

client.commands = loadCommands();

client.once(Events.ClientReady, async readyClient => {
    logIt(`${readyClient.user.tag} (${config.appname} ${config.version}) is online in ${readyClient.guilds.cache.size} servers with ${client.commands.size} commands. Owner: ${config.owner_id}`);
    try {
        await importLegacyConfig(readyClient);
    } catch (error) {
        logIt(`Importing old config.json settings failed: ${error.stack ?? error}`, true);
    }
    tempbans.start(readyClient);
});

client.on(Events.GuildCreate, guild => logIt(`Joined server "${guild.name}" (${guild.id}).`));
client.on(Events.GuildDelete, guild => {
    settings.clearGuild(guild.id);
    tempbans.clearGuild(guild.id);
    logIt(`Removed from server "${guild.name}" (${guild.id}); its settings were deleted.`);
});

client.on(Events.Error, error => logIt(`Client error: ${error.stack ?? error}`, true));
process.on('unhandledRejection', error => logIt(`Unhandled rejection: ${error?.stack ?? error}`, true));

// Rules verification: reacting to the rules message with the right emoji grants the member role.
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;

    try {
        if (reaction.partial) await reaction.fetch();
    } catch (error) {
        logIt(`Could not fetch reaction: ${error.message}`, true);
        return;
    }

    const guild = reaction.message.guild;
    if (!guild) return;

    const s = settings.getAll(guild.id);
    if (!s.verifyEnabled || !s.verifyRole) return;
    if (reaction.message.id !== s.verifyMessage || reaction.emoji.name !== s.verifyEmoji) return;

    try {
        const member = await guild.members.fetch(user.id);
        if (member.roles.cache.has(s.verifyRole)) return;
        await member.roles.add(s.verifyRole, 'Accepted the rules');
        await channelLog(guild, `[${config.appname}]: ${member.displayName} has accepted the rules! Added to the members role.`);
    } catch (error) {
        logIt(`Could not add verify role to ${user.tag} on ${guild.name}: ${error.message}`, true);
    }
});

// Simple prefix commands (e.g. !help). Recognized commands are answered and the trigger message deleted.
const prefixCommands = {
    help: prefix => `[${config.appname}: Help] My trigger commands are: ${prefix}help, ${prefix}ptt / ${prefix}pushtotalk. Type / to see my slash commands.`,
    ptt: () => '**Push to Talk** -> In your discord window. Click **User Settings**. It looks like a little gear. Go to the **Voice & Video** tab on the left. Scroll down a very short way to **Input Profile**. Under input profile look for **Push to Talk** and make sure the slider is blue and its turned on. Next just below it click **Edit Keybind** and pick a key to use. (**Pro Tip**: *The **PAUSE** button next to scroll lock works well because it is not near any other buttons and is mostly unused in all software.*)',
};
prefixCommands.pushtotalk = prefixCommands.ptt;

client.on(Events.MessageCreate, async message => {
    if (message.author.bot) return;

    const prefix = settings.get(message.guildId, 'prefix');
    if (!message.content.startsWith(prefix)) return;

    const name = message.content.slice(prefix.length).trim().split(/\s+/)[0].toLowerCase();
    const handler = prefixCommands[name];
    if (!handler) return;

    debug(`${message.author.tag} used ${prefix}${name}`);
    try {
        await message.channel.send(handler(prefix));
        if (message.deletable) await message.delete();
    } catch (error) {
        logIt(`Prefix command ${name} failed: ${error.message}`, true);
    }
});

// Slash commands and right-click (context menu) commands
client.on(Events.InteractionCreate, async interaction => {
    if (!(interaction.isChatInputCommand() || interaction.isContextMenuCommand()) || interaction.user.bot) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) {
        logIt(`[${interaction.commandName}] Command doesn't exist`, true);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        logIt(`/${interaction.commandName} failed: ${error.stack ?? error}`, true);
        const reply = { content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral };
        try {
            if (interaction.replied || interaction.deferred) await interaction.followUp(reply);
            else await interaction.reply(reply);
        } catch { /* interaction may have expired */ }
    }
});

client.login(config.token);
