# Letta MCP Server

A Model Context Protocol (MCP) server for managing Letta agents, memory and tools.  This repo now targets a **Docker Compose** workflow only and runs the server over HTTP with networking provided by [Tailscale](https://tailscale.com).

## Prerequisites

- Docker and Docker Compose
- A Tailscale account and [auth key](https://tailscale.com/kb/1085/auth-keys)
- Access to a running Letta instance

## Environment Variables

Create a `.env` file based on `.env.example` and set the following variables:

| Variable | Description |
| --- | --- |
| `LETTA_BASE_URL` | URL to your Letta API (include `/v1`) |
| `LETTA_PASSWORD` | API password for Letta |
| `PORT` | Port exposed for HTTP access (default `3001`) |
| `NODE_ENV` | Runtime environment (default `production`) |
| `TS_AUTHKEY` | Tailscale auth key used to join your tailnet |
| `TS_HOSTNAME` | Optional hostname for this node on the tailnet |

## Run with Docker Compose

```bash
docker compose up -d
```

The stack launches two services:

- **tailscale** – connects the container to your tailnet and publishes port `3001`
- **letta-mcp** – the MCP server running over HTTP and sharing the Tailscale network namespace

Logs can be viewed with:

```bash
docker compose logs -f
```

Stop the services with:

```bash
docker compose down
```

## Accessing the Server

- **Tailnet:** `http://<TS_HOSTNAME>:3001/mcp`
- **Local machine:** `http://localhost:3001/mcp`

A simple health check is available:

```bash
curl http://localhost:3001/health
```

## Troubleshooting

- Ensure `TS_AUTHKEY` is valid and has not expired
- Verify `LETTA_BASE_URL` ends with `/v1`
- Check logs with `docker compose logs` for connection or authentication issues

## License

MIT License – see [LICENSE](LICENSE).

