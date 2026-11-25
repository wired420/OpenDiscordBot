const { ChannelType, EmbedBuilder, InteractionContextType, MessageFlags, SlashCommandBuilder } = require('discord.js');
const settings = require('../../lib/settings');
const { isOwnerOrAdmin } = require('../../lib/permissions');
const { logIt } = require('../../lib/logger');

// How each setting is shown in /settings view.
const display = {
    prefix: v => `\`${v}\``,
    logChannel: v => (v ? `<#${v}>` : '*not set*'),
    everyoneRole: v => (v ? `<@&${v}>` : '*not set (admins only)*'),
    verifyEnabled: v => (v ? 'on' : 'off'),
    verifyMessage: v => (v ? `\`${v}\`` : '*not set*'),
    verifyRole: v => (v ? `<@&${v}>` : '*not set*'),
    verifyEmoji: v => v,
};

// Accepts a message id or a message link and returns the id.
function parseMessageId(input) {
    const match = input.trim().match(/(\d{17,20})\/?$/);
    return match ? match[1] : null;
}

function ephemeral(content) {
    return { content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } };
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('settings')
        .setDescription('View or change this server\'s bot settings (bot owner or server administrators).')
        .setContexts(InteractionContextType.Guild)
        .addSubcommand(sc => sc.setName('view').setDescription('Show the current settings for this server.'))
        .addSubcommand(sc => sc.setName('prefix').setDescription('Set the prefix for text commands like !help.')
            .addStringOption(o => o.setName('prefix').setDescription('New prefix, e.g. ! or ?').setRequired(true).setMaxLength(5)))
        .addSubcommand(sc => sc.setName('logchannel').setDescription('Set the channel the bot logs to. Leave empty to turn logging off.')
            .addChannelOption(o => o.setName('channel').setDescription('Log channel')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)))
        .addSubcommand(sc => sc.setName('everyonerole').setDescription('Set the role allowed to use /everyone. Leave empty for admins only.')
            .addRoleOption(o => o.setName('role').setDescription('Role')))
        .addSubcommand(sc => sc.setName('verify').setDescription('Set up the rules-reaction role.')
            .addBooleanOption(o => o.setName('enabled').setDescription('Turn rules verification on or off').setRequired(true))
            .addStringOption(o => o.setName('message').setDescription('Rules message link or id'))
            .addRoleOption(o => o.setName('role').setDescription('Role to give after reacting'))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji members must react with (default ✅)').setMaxLength(64)))
        .addSubcommand(sc => sc.setName('reset').setDescription('Reset one setting, or all of them, to the default.')
            .addStringOption(o => o.setName('setting').setDescription('Setting to reset').setRequired(true)
                .addChoices({ name: 'all', value: 'all' }, ...Object.keys(settings.DEFINITIONS).map(k => ({ name: k, value: k }))))),

    async execute(interaction) {
        if (!isOwnerOrAdmin(interaction)) {
            await interaction.reply(ephemeral('Only the bot owner or server administrators can change bot settings.'));
            return;
        }

        const guild = interaction.guild;
        const sub = interaction.options.getSubcommand();
        const opts = interaction.options;
        let changed = null;

        switch (sub) {
            case 'view': {
                const current = settings.getAll(guild.id);
                const embed = new EmbedBuilder()
                    .setColor(0xcc0000)
                    .setTitle(`Settings for ${guild.name}`)
                    .setDescription(Object.entries(current)
                        .map(([k, v]) => `**${k}**: ${display[k](v)}\n-# ${settings.DEFINITIONS[k].description}`)
                        .join('\n'));
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
                return;
            }

            case 'prefix': {
                const prefix = opts.getString('prefix').trim();
                if (!prefix || /\s/.test(prefix)) {
                    await interaction.reply(ephemeral('The prefix can\'t be empty or contain spaces.'));
                    return;
                }
                settings.set(guild.id, 'prefix', prefix);
                changed = `Prefix is now \`${prefix}\`.`;
                break;
            }

            case 'logchannel': {
                const channel = opts.getChannel('channel');
                settings.set(guild.id, 'logChannel', channel?.id ?? null);
                changed = channel ? `I'll log to ${channel}. Make sure I can send messages there.` : 'Logging is turned off.';
                break;
            }

            case 'everyonerole': {
                const role = opts.getRole('role');
                settings.set(guild.id, 'everyoneRole', role?.id ?? null);
                changed = role ? `Members with ${role} can now use /everyone.` : '/everyone is now limited to administrators.';
                break;
            }

            case 'verify': {
                const values = { verifyEnabled: opts.getBoolean('enabled') };
                const messageInput = opts.getString('message');
                const role = opts.getRole('role');
                const emoji = opts.getString('emoji')?.trim();

                if (messageInput) {
                    const id = parseMessageId(messageInput);
                    if (!id) {
                        await interaction.reply(ephemeral('That doesn\'t look like a message link or id. Right-click the rules message and choose **Copy Message Link**.'));
                        return;
                    }
                    values.verifyMessage = id;
                }
                if (role) values.verifyRole = role.id;
                if (emoji) values.verifyEmoji = emoji;
                settings.setMany(guild.id, values);

                const s = settings.getAll(guild.id);
                const notes = [];
                if (s.verifyEnabled && (!s.verifyMessage || !s.verifyRole)) notes.push('⚠️ Set both a **message** and a **role**, or verification won\'t do anything.');
                const vRole = s.verifyRole && guild.roles.cache.get(s.verifyRole);
                if (vRole && guild.members.me.roles.highest.comparePositionTo(vRole) <= 0) {
                    notes.push(`⚠️ My highest role must be above ${vRole} in the role list, or I can't give it out.`);
                }
                changed = `Rules verification is **${s.verifyEnabled ? 'on' : 'off'}**: react with ${s.verifyEmoji} on message \`${s.verifyMessage ?? 'not set'}\` to get ${s.verifyRole ? `<@&${s.verifyRole}>` : '*no role set*'}.`
                    + (notes.length ? `\n${notes.join('\n')}` : '');
                break;
            }

            case 'reset': {
                const key = opts.getString('setting');
                if (key === 'all') settings.clearGuild(guild.id);
                else settings.set(guild.id, key, null);
                changed = key === 'all' ? 'All settings were reset to their defaults.' : `**${key}** was reset to its default.`;
                break;
            }
        }

        logIt(`${interaction.user.tag} changed settings on ${guild.name}: /settings ${sub}`);
        await interaction.reply(ephemeral(changed));
    },
};
