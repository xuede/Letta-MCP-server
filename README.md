# Letta MCP Server

A Model Context Protocol (MCP) server for managing Letta agents, memory and tools. This repository is now focused on running the server via **Docker Compose** using the HTTP transport with Tailscale baked in for secure networking.

## Features

- Agent and memory management tools
- HTTP transport with `/health` endpoint
- Built-in Tailscale for private network access
- Ready-to-run Docker Compose setup

## Prerequisites

Create a `.env` file in the project root with the following variables:

```bash
LETTA_BASE_URL=https://your-letta-instance.com/v1
LETTA_PASSWORD=your-secure-password
TAILSCALE_AUTHKEY=tskey-auth-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional
TAILSCALE_HOSTNAME=letta-mcp
PORT=3001
NODE_ENV=production
```

`TAILSCALE_AUTHKEY` should be a reusable auth key from your Tailscale admin console. `TAILSCALE_HOSTNAME` sets the node name within your tailnet.

## Run with Docker Compose

Build and start the server:

```bash
docker compose up -d --build
```

The server will start, join your Tailscale network and listen on port `3001` (or the value of `PORT`).

Check the health endpoint:

```bash
curl http://localhost:3001/health
```

You can also reach the server via its Tailscale IP or MagicDNS name:

```bash
curl http://<tailscale-ip>:3001/health
```

To view logs or stop the service:

```bash
docker compose logs -f
# Stop
docker compose down
```

## Development & Testing

Install dependencies and run tests locally:

```bash
npm install
npm test
```

## License

MIT License - see [LICENSE](LICENSE) for details.
