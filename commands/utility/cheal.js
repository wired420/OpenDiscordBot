const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cheal')
        .setDescription('Automatically sets up the cheal chain for raids.')
        .addStringOption((option) =>
            option.setName('delay1')
                .setDescription('First delay in cheal macro')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('delay2')
                .setDescription('Delay until next user casts')
                .setRequired(true)
        )
        .addStringOption((option) =>
            option.setName('healers').setDescription('A list of healer names separated by spaces')
                .setRequired(true)
        ),
    async execute(interaction) {
        // Lock Cheal commands to this channel so we don't spam up the server.
        const chealChannelId = 1454967762349723750;

        const d1 = interaction.options.getString('delay1');
        const d2 = interaction.options.getString('delay2');
        const heals = interaction.options.getString('healers');
        const healArray = heals.split(" ");

	// Check if we're in the right channel before posting.
        if (interaction.channel.id != chealChannelId) {
            await interaction.reply({ content: 'Please limit use of the /cheal command to #complete-heal-chain channel under Raid Tools.', ephemeral: true});
            return;
        }

        if (healArray.length < 2) {
            await interaction.reply({ content: 'Please list at least two healers.', ephemeral: true});
            return;
        }

        if (healArray.length > 10) {
            await interaction.reply({ content: 'Please list at least no more than ten healers. More can flood the bot offline. If more is needed at some point, please speak with Kayenda.', ephemeral: true});
            return;
        }

        await interaction.channel.bulkDelete(100, true);

        for (let i = 0; i < healArray.length; i++) {
            var nextHealer = healArray[i+1];
            var myNumber = String(i+1);
            var nextNumber = String(i+2);
            if (typeof nextHealer == 'undefined') {
                var nextHealer = healArray[0];
                var nextNumber = String(1);
            }

            var chembed = new EmbedBuilder()
            .setColor(0xcc0000)
            .setTitle(healArray[i])
            .setDescription(`Complete Heal Macro for ${healArray[i]}.`)
            .addFields(
                { name: 'Line 1', value: `\/rsay \[**${myNumber}${myNumber}${myNumber}**\] Casting CHeal On \< \%t\ > \- Get Ready **${nextHealer}** \[**${myNumber}${myNumber}${myNumber}**\]` },
                { name: 'Line 2', value: `\/pause ${d1}` },
                { name: 'Line 3', value: `\/cast gem\#` },
                { name: 'Line 4', value: `\/pause ${d2}` },
                { name: 'Line 5', value: `\/rsay \[**${nextNumber}${nextNumber}${nextNumber}**\] **${nextHealer}** \- Start Casting Now \[**${nextNumber}${nextNumber}${nextNumber}**\]` },
            );
            await interaction.channel.send({ embeds: [chembed] });
        }
        await interaction.channel.send('Replace Gem# in line 3 with the gem number you have complete heal memorized in. To **PASTE** into everquest. ALT+O -> Keys Tab -> UI in Drop down -> Paste from clipboard option. Set a key. CTRL+V is the normal for every other program, just for example. Items in **BOLD** need to be changed when the order of the cheal chain changes.');
//        return;
    }
};

