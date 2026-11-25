const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads the bot configuration files and command deploy scripts.'),
    async execute(interaction) {

        const { exec } = require('child_process');

        exec('node ~/banditbot/deploy-global.js', (error, stdout, stderr) => {
            if (error) {
                logIt(`Error Executing Shell Command: ${error}`, true);
                return;
            }

            const embed = new EmbedBuilder()
            .setColor(0xcc0000)
            .setTitle(`Reloading Bot Files`)
            .addFields(
                { name: 'Output', value: stdout },
             );
            interaction.reply({ embeds: [embed], ephemeral: true });
        });
    }
};
