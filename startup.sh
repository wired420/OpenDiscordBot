#!/bin/sh
# Starts the bot in a detached screen session named "opendiscordbot".
cd "$(dirname "$0")" && screen -dmS opendiscordbot node index.js
