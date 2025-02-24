#!/bin/bash

# Navigate to project root
cd ~/Desktop/trading-journal

# Ensure NVM is loaded
source ~/.zshrc
nvm use 18

# Start MongoDB if not running
if ! lsof -i :27017 > /dev/null; then
  brew services start mongodb-community
  echo "Starting MongoDB..."
  sleep 5
else
  echo "MongoDB already running"
fi

# Open Terminal tabs for backend and frontend
osascript -e 'tell app "Terminal" to activate' \
          -e 'tell app "Terminal" to do script "cd ~/Desktop/trading-journal/server && node index.js"' \
          -e 'tell app "Terminal" to do script "cd ~/Desktop/trading-journal/client && PORT=3001 npm start"'

echo "App launched! Check Terminal windows."