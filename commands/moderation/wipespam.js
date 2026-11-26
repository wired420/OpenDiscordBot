// Right-click a message > Apps > "Wipe Spam"
// For compromised accounts posting spam: DMs the user a warning, bans them (which deletes
// their messages from the last 2 hours in every channel), and lifts the ban after the
// server's spamBanMinutes setting.
const {
    ActionRowBuilder, ApplicationCommandType, ButtonBuilder, ButtonStyle, ContextMenuCommandBuilder,
    InteractionContextType, MessageFlags, PermissionFlagsBits,
} = require('discord.js');
const settings = require('../../lib/settings');
const tempbans = require('../../lib/tempbans');
const { isOwnerOrAdmin } = require('../../lib/permissions');
const { formatMinutes } = require('../../lib/duration');
const { logIt, channelLog } = require('../../lib/logger');

const WIPE_SECONDS = 2 * 60 * 60; // delete messages from the last 2 hours

function dmText(guild, minutes) {
    const banLine = minutes
        ? `You have been temporarily banned from **${guild.name}** for ${formatMinutes(minutes)}. You can rejoin with an invite after that.`
        : `You have been banned from **${guild.name}**.`;
    return [
        `⚠️ **Your Discord account appears to be hacked.** It has been sending spam messages in **${guild.name}**.`,
        banLine,
        '',
        '**Please secure your account now:**',
        '1. Change your Discord password (User Settings > My Account). This also logs out other sessions.',
        '2. Turn on Two-Factor Authentication on the same page.',
        '3. Check User Settings > Authorized Apps and remove anything you don\'t recognize.',
        '4. Reset or disable any API keys and bot tokens you own, and change the password on the email tied to your Discord account.',
        '5. Run a malware scan, and never scan QR codes or run files that someone sends you to "verify" your account.',
    ].join('\n');
}

module.exports = {
    data: new ContextMenuCommandBuilder()
        .setName('Wipe Spam')
        .setType(ApplicationCommandType.Message)
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        const ephemeral = content => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] }, components: [] });
        const guild = interaction.guild;
        const target = interaction.targetMessage.author;

        if (!isOwnerOrAdmin(interaction) && !interaction.memberPermissions?.has(PermissionFlagsBits.BanMembers)) {
            await interaction.reply(ephemeral('You need the **Ban Members** permission to use Wipe Spam.'));
            return;
        }
        if (interaction.targetMessage.webhookId || target.bot) {
            await interaction.reply(ephemeral('That message was posted by a bot or webhook, not a member.'));
            return;
        }
        if (target.id === interaction.user.id || target.id === guild.ownerId) {
            await interaction.reply(ephemeral(target.id === guild.ownerId ? 'You can\'t use Wipe Spam on the server owner.' : 'You can\'t use Wipe Spam on yourself.'));
            return;
        }

        // Both lookups at once: the confirm prompt has to go out within Discord's 3-second reply window.
        const [me, member] = await Promise.all([
            guild.members.me ?? guild.members.fetchMe(),
            guild.members.fetch(target.id).catch(() => null), // null if they already left
        ]);
        if (!me.permissions.has(PermissionFlagsBits.BanMembers)) {
            await interaction.reply(ephemeral('I need the **Ban Members** permission to do that.'));
            return;
        }

        if (member) {
            if (member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply(ephemeral(`${member} is an administrator. Remove their admin role first if their account is compromised.`));
                return;
            }
            if (!member.bannable) {
                await interaction.reply(ephemeral(`I can't ban ${member} because their highest role is above mine. Move my role higher in Server Settings > Roles.`));
                return;
            }
        }

        const minutes = settings.get(guild.id, 'spamBanMinutes');
        const durationText = minutes ? `for **${formatMinutes(minutes)}**` : '**permanently**';

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('wipespam:confirm').setLabel('Wipe and ban').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('wipespam:cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
        );
        const response = await interaction.reply({
            content: `Wipe spam from **${target.tag}**?\n• Their messages from the last 2 hours are deleted in every channel.\n• They're banned ${durationText}.\n• They get a DM saying their account looks hacked and how to secure it.`,
            components: [row],
            flags: MessageFlags.Ephemeral,
            withResponse: true,
        });

        let click;
        try {
            click = await response.resource.message.awaitMessageComponent({
                filter: i => i.user.id === interaction.user.id,
                time: 60_000,
            });
        } catch {
            await interaction.editReply(ephemeral('Wipe Spam timed out. Nothing was done.'));
            return;
        }
        if (click.customId !== 'wipespam:confirm') {
            await click.update(ephemeral('Cancelled. Nothing was done.'));
            return;
        }
        await click.update(ephemeral(`Wiping spam from **${target.tag}**...`));

        // DM first: once banned, the bot may no longer share a server with them.
        let dmSent = false;
        try {
            await target.send(dmText(guild, minutes));
            dmSent = true;
        } catch { /* DMs closed */ }

        const reason = `Wipe Spam by ${interaction.user.tag}: compromised account spamming`;
        try {
            await guild.bans.create(target.id, { deleteMessageSeconds: WIPE_SECONDS, reason });
        } catch (error) {
            logIt(`Wipe Spam ban failed for ${target.tag} on ${guild.name}: ${error.message}`, true);
            await interaction.editReply(ephemeral(`Couldn't ban **${target.tag}**: ${error.message}${dmSent ? '\n(They were already sent the warning DM.)' : ''}`));
            return;
        }

        if (minutes) tempbans.add(guild.id, target.id, Date.now() + minutes * 60_000, reason);
        else tempbans.remove(guild.id, target.id);

        const summary = `**${target.tag}** was banned ${durationText} and their messages from the last 2 hours were deleted. `
            + (dmSent ? 'They were sent a DM about securing their account.' : 'I couldn\'t DM them (their DMs are closed).');
        logIt(`Wipe Spam: ${interaction.user.tag} wiped ${target.tag} (${target.id}) on ${guild.name}, ban ${formatMinutes(minutes)}, DM ${dmSent ? 'sent' : 'failed'}.`);
        await Promise.all([
            interaction.editReply(ephemeral(summary)),
            channelLog(guild, `[Wipe Spam]: ${interaction.user.username} wiped spam from <@${target.id}> (${target.tag}). Ban length: ${formatMinutes(minutes)}. Last 2 hours of messages deleted. Warning DM ${dmSent ? 'sent' : 'not delivered'}.`),
        ]);
    },
};
