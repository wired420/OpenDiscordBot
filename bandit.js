// include helpers
// Load config file
const config = require("./config.json");

// Import Node Libs
const fs = require('node:fs');
const path = require('node:path');

// Import HTTP libs
const http = require('http');
const request = require('request');
const cheerio = require('cheerio');

// Import Weather Libs
const XMLHttpRequest = require('xhr2');

// Require the necessary discord.js classes
const { Client, Collection, Events, GatewayIntentBits, Partials } = require('discord.js');

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.MessageContent],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once(Events.ClientReady, readyClient => {
    logIt(`${config.appname} ${config.version} starting up with owner ${config.owner_id}.`);
});

client.login(config.token);

// Command Handler
client.commands = new Collection();

const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        } else {
            logIt(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`, true);
        }
    }
}

client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (config.verifyEnable) {
         if (reaction.partial) {
             try {
                 await reaction.fetch();
             }
             catch (error) {
                 console.error('Something went wrong when fetching the message:', error);
                 return;
             }
         }

         if (reaction.message.id == config.verifyMessageId) {
             if (reaction.emoji.name == config.verifyEmoji) {
                 let u = await reaction.message.guild.members.cache.get(`${user.id}`);
                 channelLog(`\[${config.appname}\]: ${u.displayName} has accepted the rules! Adding to Members group.`);
                 await reaction.message.guild.members.cache.get(`${user.id}`).roles.add(config.verifyRoleId);
             }
         }
    }
});

//client.on('messageCreate', message => {
client.on(Events.MessageCreate, async message => {
    if (message.partial) {
        try {
             await message.fetch();
        }
        catch (error) {
            logIt(`Something went wrong with retriving message with id ${message}`);
            return;
        }
    }

    if (!message.content.startsWith(config.prefix) || message.author.bot) return;
    let m = message.content.slice(1);

    if (m.toLowerCase() === "help") {
        await message.channel.send('[Bandit Bot: Help] My trigger commands are: !help, !maps, !ptt/!pushtotalk');
    }
    if (m.toLowerCase() === "maps") {
        await message.channel.send('**Brewall\'s Maps** -> https://www.eqmaps.info/wp-content/uploads/2024/01/brewall-20240109.zip Put in **EverQuest\\Maps** directory. Overwrite any existing files. If you do it while games loaded you can do `/loadskin default 1` to get the game to load them without restarting. The **1** is important. It keeps your ui and boxes where they are.');
    }
    else if (m.toLowerCase() === "ptt" || m.toLowerCase() === "pushtotalk") {
        await message.channel.send('**Push to Talk** -> In your discord window. Click **User Settings**. It looks like a little gear. Go to the **Voice & Video** tab on the left. Scroll down a very short way to **Input Profile**. Under input profile look for **Push to Talk** and make sure the slider is blue and its turned on. Next just below it click **Edit Keybind** and pick a key to use. (**Kayenda Pro Tip**: *I personally use **PAUSE** button next to scroll lock because it is not near any other buttons and is mostly unused in all software.*)');
    }

    await message.delete();
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() || interaction.user.bot) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logIt(`\[${interaction.commandName}\] Command doesn't exist`);
        return;
    }

    try {
        await command.execute(interaction);
    }

    catch (error) {
        logIt(error, true);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

// Generic Helpers
function capStr(str)
{
    str = str.split(" ");

    for (var i = 0, x = str.length; i < x; i++) {
        str[i] = str[i][0].toUpperCase() + str[i].substr(1);
    }

    return str.join(" ");
}

function getUrl( hostName, pathToData, callBack )
{
    var data = '';

    var request = http.request( { host: hostName, path: pathToData }, function (res) {
        res.on('data', function (chunk) {                                                                                                                                                                                                                                                                                                                                                             data += chunk;
        });
        res.on('end', function () {
           callBack( data );
        });
    });

    request.on('error', function (e) {
        logIt(e.message);
    });

    request.end();
}

// Log certain items or errors
function logIt(message, isError = false)
{
  if (!isError)
  {
    console.log(`[${config.appname}] ` + displayTime() + "> " + message);
  }
  else
  {
    console.error(`[${config.appname}] ` + displayTime() + "> ERROR: " + message);
  }
}

// Log to logs channel
function channelLog(message) {
    client.channels.cache.get(config.logChannelId).send(message);
}

// Format Timestamps
function displayTime() {
    var str = "";
    var currentTime = new Date()
    var hours = currentTime.getHours()
    var minutes = currentTime.getMinutes()
    var seconds = currentTime.getSeconds()

    if (minutes < 10)
    {
        minutes = "0" + minutes
    }

    if (seconds < 10)
    {
        seconds = "0" + seconds
    }

    str += hours + ":" + minutes + ":" + seconds + " ";

    if(hours > 11)
    {
        str += "PM"
    }
    else
    {
        str += "AM"
    }
    return str;
}

// Remove item from array when callback is needed.
function arrayRemove(arr, item)
{
    for (var i = arr.length; i--;)
    {
        if (arr[i] === item)                                                                                                                                                                                                                                                                                                                                                                      {
            arr.splice(i, 1);
            logIt("Removed " + item + " from " + arr + " array at index [" + i + "]");
        }
    }
}

// Is passed variable a number?
function isNumeric(n)
{
  return !isNaN(parseFloat(n)) && isFinite(n);
}

// Is passed variable or array empty
function isEmpty(obj)
{
    for(var key in obj)
    {
        if(obj.hasOwnProperty(key))
        {
            return false;
        }
    }
    return true;
}

// Prototype Extensions
// Does an array contain an item?
Array.prototype.contains = function(obj)
{
    return this.indexOf(obj) > -1;
};

// Remove all instances of an item from an array
Array.prototype.remove = function(item)
{
    for (var i = this.length; i--;)
    {
        if (this[i] === item)
        {
            this.splice(i, 1);
        }
    }
}

function getDirection(heading) {
   var directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
   return directions[Math.round(((heading %= 360) < 0 ? heading + 360 : heading) / 45) % 8];
}
