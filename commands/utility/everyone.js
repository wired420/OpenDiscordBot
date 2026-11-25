const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('everyone')
        .setDescription('Tags all members. All uses of /everyone are logged.'),
    async execute(interaction) {
        const bLogChannelId = '1489424090640027819';

        if (interaction.member.roles.cache.some(r => r.name === "Event Organizer")) {
            interaction.client.channels.cache.get(bLogChannelId).send(`[Bandit Bot]: ${interaction.user.username} has used the /everyone command in ${interaction.channelId}.`);
            await interaction.reply(`\^ Raid Event: <@everyone> \^`);
        }
        else {
            await interaction.reply({ content: `Sorry. You do not have permission to use that command. See an officer or Kayenda for access`, ephemeral: true });
        }
        return;
    }
};

