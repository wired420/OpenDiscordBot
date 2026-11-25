const { InteractionContextType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } = require('discord.js');
const { isOwnerOrAdmin } = require('../../lib/permissions');
const { logIt } = require('../../lib/logger');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setnick')
        .setDescription("Sets the bot's nickname on this server (bot owner or server administrators).")
        .setContexts(InteractionContextType.Guild)
        .addStringOption(option =>
            option.setName('nickname')
                .setDescription('New nickname. Leave empty to reset to the default name.')
                .setMaxLength(32)),
    async execute(interaction) {
        if (!isOwnerOrAdmin(interaction)) {
            await interaction.reply({ content: 'Only the bot owner or server administrators can use this command.', flags: MessageFlags.Ephemeral });
            return;
        }

        const me = interaction.guild.members.me ?? await interaction.guild.members.fetchMe();
        if (!me.permissions.has(PermissionFlagsBits.ChangeNickname)) {
            await interaction.reply({ content: 'I need the **Change Nickname** permission on this server to do that.', flags: MessageFlags.Ephemeral });
            return;
        }

        const nickname = interaction.options.getString('nickname')?.trim() || null;
        await me.setNickname(nickname, `Requested by ${interaction.user.tag}`);
        logIt(`${interaction.user.tag} set nickname on ${interaction.guild.name} to ${nickname ?? '(reset)'}`);

        await interaction.reply({
            content: nickname ? `My nickname on this server is now **${nickname}**.` : 'My nickname on this server has been reset.',
            flags: MessageFlags.Ephemeral,
        });
    },
};
