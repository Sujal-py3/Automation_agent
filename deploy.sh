#!/bin/bash

# Build the NestJS application
echo "Building NestJS application..."
npm run build

# Install dependencies for the static server
echo "Installing dependencies..."
npm install

# Start the static server
echo "Starting server..."
npm run serve:static 