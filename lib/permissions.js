const { PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

function isOwner(user) {
    return user.id === config.owner_id;
}

// Bot owner (on any server) or a member with the Administrator permission.
function isOwnerOrAdmin(interaction) {
    return isOwner(interaction.user) || Boolean(interaction.memberPermissions?.has(PermissionFlagsBits.Administrator));
}

module.exports = { isOwner, isOwnerOrAdmin };
