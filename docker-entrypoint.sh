#!/bin/sh
set -e

# Start Tailscale daemon
/usr/sbin/tailscaled --state=mem: &
# Allow daemon to start
sleep 2

# Bring up Tailscale
if [ -n "$TAILSCALE_AUTHKEY" ]; then
  tailscale up --authkey="$TAILSCALE_AUTHKEY" --hostname="${TAILSCALE_HOSTNAME:-letta-mcp}"
else
  tailscale up --hostname="${TAILSCALE_HOSTNAME:-letta-mcp}"
fi

# Start the MCP server with HTTP transport
exec node ./src/index.js --http
