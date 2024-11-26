// include helpers
//const cmdList = require("./config/commands.json");

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
const { Client, Collection, Events, GatewayIntentBits } = require('discord.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

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

// Command Callback
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        logIt(`No command matching ${interaction.commandName} was found.`, true);
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
