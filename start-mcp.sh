#!/bin/bash
# Letta MCP Server startup script for stdio transport
# Configure environment variables before running

cd /opt/stacks/letta-MCP-server

# Load environment variables from .env file if it exists
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set defaults if not loaded from .env
export LETTA_BASE_URL=${LETTA_BASE_URL:-"https://letta.oculair.ca/v1"}
export LETTA_PASSWORD=${LETTA_PASSWORD:-"your-password"}
export NODE_ENV=${NODE_ENV:-"production"}

# Check if environment variables are set
if [[ -z "$LETTA_BASE_URL" ]] || [[ -z "$LETTA_PASSWORD" ]]; then
    echo "Error: Please set LETTA_BASE_URL and LETTA_PASSWORD environment variables"
    echo "You can create a .env file in this directory with these values"
    echo "Example:"
    echo "  LETTA_BASE_URL=https://your-letta-instance.com/v1"
    echo "  LETTA_PASSWORD=your-password"
    exit 1
fi

# Ensure node_modules are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Start the server with stdio transport (default)
exec node src/index.js