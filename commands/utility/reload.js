const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const { logIt } = require('../../lib/logger');
const { loadCommands, deployCommands } = require('../../lib/commands');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads command files from disk and re-registers slash commands (bot owner only).'),
    async execute(interaction) {
        if (interaction.user.id !== config.owner_id) {
            await interaction.reply({ content: 'Only the bot owner can use this command.', flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const commands = loadCommands();
        interaction.client.commands = commands;

        const data = await deployCommands(config.token, config.clientId, commands);
        logIt(`${interaction.user.tag} reloaded ${commands.size} commands; ${data.length} registered with Discord.`);
        await interaction.editReply(`Reloaded ${commands.size} commands and registered ${data.length} with Discord. Global command changes can take a few minutes to show up.`);
    },
};
