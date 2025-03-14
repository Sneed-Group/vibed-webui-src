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
  
  # Start the proxy server
  npm start
else
  echo "Build failed. Please check the errors above."
  exit 1
fi 