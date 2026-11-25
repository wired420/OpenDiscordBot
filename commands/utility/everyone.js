const { MessageFlags, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const { channelLog } = require('../../lib/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('everyone')
        .setDescription('Tags all members. All uses of /everyone are logged.')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Optional message to include with the ping')
                .setMaxLength(1500)),
    async execute(interaction) {
        const roleName = config.everyoneRoleName || 'Event Organizer';

        if (!interaction.member.roles.cache.some(r => r.name === roleName)) {
            await interaction.reply({ content: `Sorry, you need the **${roleName}** role to use this command.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const text = interaction.options.getString('message');
        await interaction.reply({
            content: text ? `@everyone ${text}` : '@everyone',
            allowedMentions: { parse: ['everyone'] },
        });
        await channelLog(interaction.client, `[${config.appname}]: ${interaction.user.username} used /everyone in <#${interaction.channelId}>.`);
    },
};
