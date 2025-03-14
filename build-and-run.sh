#!/bin/bash

# Install dependencies
echo "Installing dependencies..."
npm i

# Build the application
echo "Building the application..."
npm run build

# Check if build was successful
if [ $? -eq 0 ]; then
  echo "Build successful! Starting the server..."
  
  # Check if debug mode is requested
  if [[ "$1" == "--debug" ]]; then
    echo "Running in debug mode..."
    npm run debug
  else
    # Start the proxy server
    npm start
  fi
else
  echo "Build failed. Please check the errors above."
  exit 1
fi 