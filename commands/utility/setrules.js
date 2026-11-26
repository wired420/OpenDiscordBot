// Right-click a message > Apps > "Set as rules message"
const { ApplicationCommandType, ContextMenuCommandBuilder, InteractionContextType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const settings = require('../../lib/settings');
const { isOwnerOrAdmin } = require('../../lib/permissions');
const { logIt, channelLog } = require('../../lib/logger');

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Set as rules message')
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild),
    async execute(interaction) {
        const reply = content => interaction.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

        if (!isOwnerOrAdmin(interaction)) {
            await reply('Only the bot owner or server administrators can set the rules message.');
            return;
        }

        // Adding the reaction can be slow under rate limits; defer so the 3-second reply window can't expire.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const message = interaction.targetMessage;
        const guild = interaction.guild;
        const s = settings.getAll(guild.id);

        settings.setMany(guild.id, { verifyMessage: message.id, verifyEnabled: Boolean(s.verifyRole) });

        const lines = [`This is now the rules message: ${message.url}`];

        try {
            await message.react(s.verifyEmoji);
            lines.push(`I added the ${s.verifyEmoji} reaction. Members who click it get the verify role.`);
        } catch (error) {
            const perms = message.channel.permissionsFor(guild.members.me);
            const missing = ['AddReactions', 'ReadMessageHistory'].filter(p => !perms?.has(PermissionFlagsBits[p]));
            lines.push(missing.length
                ? `⚠️ I couldn't add the ${s.verifyEmoji} reaction because I'm missing ${missing.join(' and ')} in that channel. Add it yourself or give me the permission.`
                : `⚠️ I couldn't add the ${s.verifyEmoji} reaction (${error.message}). Add it yourself so members have something to click.`);
        }

        if (s.verifyRole) {
            lines.push(`Rules verification is **on** and gives <@&${s.verifyRole}>.`);
        } else {
            lines.push('⚠️ No role is set yet, so verification is **off**. Pick one with `/settings verify enabled:True role:`.');
        }

        logIt(`${interaction.user.tag} set the rules message on ${guild.name} to ${message.id}`);
        await Promise.all([
            interaction.editReply({ content: lines.join('\n'), allowedMentions: { parse: [] } }),
            channelLog(guild, `[Settings]: ${interaction.user.username} set the rules message: ${message.url}`),
        ]);
    },
};
