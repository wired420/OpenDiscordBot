const { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const config = require('../../config.json');
const settings = require('../../lib/settings');
const { channelLog } = require('../../lib/logger');
const { isOwnerOrAdmin } = require('../../lib/permissions');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('everyone')
        .setDescription('Tags all members. All uses of /everyone are logged.')
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Optional message to include with the ping')
                .setMaxLength(1500)),
    async execute(interaction) {
        const roleId = settings.get(interaction.guildId, 'everyoneRole');
        const allowed = isOwnerOrAdmin(interaction)
            || interaction.memberPermissions?.has(PermissionFlagsBits.MentionEveryone)
            || (roleId && interaction.member.roles.cache.has(roleId));

        if (!allowed) {
            const who = roleId ? `the <@&${roleId}> role` : 'server administrators';
            await interaction.reply({ content: `Sorry, /everyone is limited to ${who}.`, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
            return;
        }

        const text = interaction.options.getString('message');
        await interaction.reply({
            content: text ? `@everyone ${text}` : '@everyone',
            allowedMentions: { parse: ['everyone'] },
        });
        await channelLog(interaction.guild, `[${config.appname}]: ${interaction.user.username} used /everyone in <#${interaction.channelId}>.`);
    },
};
