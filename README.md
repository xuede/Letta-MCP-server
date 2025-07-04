[![MseeP.ai Security Assessment Badge](https://mseep.net/mseep-audited.png)](https://mseep.ai/app/oculairmedia-letta-mcp-server)

# Letta MCP Server

A Model Context Protocol (MCP) server that provides comprehensive tools for agent management, memory operations, and integration with the Letta system. Supports multiple transport protocols including HTTP (recommended), SSE, and stdio.

## Features

- 🤖 **Agent Management** - Create, modify, clone, and manage Letta agents
- 🧠 **Memory Operations** - Handle memory blocks and passages
- 🔧 **Tool Integration** - Attach and manage tools for agents
- 🌐 **Multiple Transports** - HTTP, SSE, and stdio support
- 🔗 **MCP Server Integration** - Integrate with other MCP servers
- 📦 **Docker Support** - Easy deployment with Docker

## Environment Configuration

Create a `.env` file with the following variables:

```bash
# Required
LETTA_BASE_URL=https://your-letta-instance.com/v1
LETTA_PASSWORD=your-secure-password

# Optional
PORT=3001
NODE_ENV=production
```

## Quick Setup

### Option 1: Run with Node.js

```bash
# Install dependencies
npm install

# Development
npm run dev         # Default (stdio) transport
npm run dev:sse     # SSE transport
npm run dev:http    # HTTP transport (recommended)

# Production
npm run start       # Default (stdio) transport
npm run start:sse   # SSE transport
npm run start:http  # HTTP transport (recommended)
```

### Option 2: Run with Docker

```bash
# Build and run locally
docker build -t letta-mcp-server .
docker run -d -p 3001:3001 -e PORT=3001 -e NODE_ENV=production --name letta-mcp letta-mcp-server

# Or use the public image
docker run -d -p 3001:3001 -e PORT=3001 -e NODE_ENV=production --name letta-mcp ghcr.io/oculairmedia/letta-mcp-server:latest
```

## Directory Structure

- `src/index.js` - Main entry point
- `src/core/` - Core server functionality
- `src/tools/` - Tool implementations organized by category:
  - `agents/` - Agent management tools
  - `memory/` - Memory block tools
  - `passages/` - Passage management tools
  - `tools/` - Tool attachment and management
  - `mcp/` - MCP server integration tools
  - `models/` - Model listing tools
- `src/transports/` - Server transport implementations (stdio, SSE, HTTP)

## Transport Protocols

The server supports three transport protocols:

1. **HTTP (Recommended)** - Streamable HTTP transport with full duplex communication
   - Endpoint: `http://your-server:3001/mcp`
   - Best for production use and remote connections
   - Supports health checks at `/health`

2. **SSE (Server-Sent Events)** - Real-time event streaming
   - Endpoint: `http://your-server:3001/sse`
   - Good for unidirectional server-to-client updates

3. **stdio** - Standard input/output
   - Direct process communication
   - Best for local development and testing

## Available Tools

### Agent Management

| Tool | Description | Required Parameters | Optional Parameters |
|------|-------------|---------------------|---------------------|
| `create_agent` | Create a new Letta agent | name, description | model, embedding |
| `list_agents` | List all available agents | - | filter |
| `prompt_agent` | Send a message to an agent | agent_id, message | - |
| `retrieve_agent` | Get agent details by ID | agent_id | - |
| `get_agent_summary` | Get agent summary information | agent_id | - |
| `modify_agent` | Update an existing agent | agent_id, update_data | - |
| `delete_agent` | Delete an agent | agent_id | - |
| `clone_agent` | Clone an existing agent | source_agent_id, new_agent_name | override_existing_tools, project_id |
| `bulk_delete_agents` | Delete multiple agents | - | agent_ids, agent_name_filter, agent_tag_filter |

### Memory Management

| Tool | Description | Required Parameters | Optional Parameters |
|------|-------------|---------------------|---------------------|
| `list_memory_blocks` | List all memory blocks | - | filter, agent_id, page, pageSize, label |
| `create_memory_block` | Create a new memory block | name, label, value | agent_id, metadata |
| `read_memory_block` | Read a memory block | block_id | agent_id |
| `update_memory_block` | Update a memory block | block_id | value, metadata, agent_id |
| `attach_memory_block` | Attach memory to an agent | block_id, agent_id | label |

### Tool Management

| Tool | Description | Required Parameters | Optional Parameters |
|------|-------------|---------------------|---------------------|
| `list_agent_tools` | List tools for a specific agent | agent_id | - |
| `attach_tool` | Attach tools to an agent | agent_id | tool_id, tool_ids, tool_names |
| `upload_tool` | Upload a new tool | name, description, source_code | category, agent_id |
| `bulk_attach_tool_to_agents` | Attach a tool to multiple agents | tool_id | agent_name_filter, agent_tag_filter |

### Additional Tools

- **Model Management**: `list_llm_models`, `list_embedding_models`
- **Archive Management**: `list_passages`, `create_passage`, `modify_passage`, `delete_passage`
- **MCP Server Management**: `list_mcp_servers`, `list_mcp_tools_by_server`, `add_mcp_tool_to_letta`
- **Import/Export**: `export_agent`, `import_agent`

## Docker Operations

```bash
# View container logs
docker logs -f letta-mcp

# Stop the container
docker stop letta-mcp

# Update to latest version
docker pull ghcr.io/oculairmedia/letta-mcp-server:latest
docker stop letta-mcp
docker rm letta-mcp
docker run -d -p 3001:3001 -e PORT=3001 -e NODE_ENV=production --name letta-mcp ghcr.io/oculairmedia/letta-mcp-server:latest
```

## Configuration with MCP Settings

Add the server to your mcp_settings.json:

```json
"letta": {
  "command": "node",
  "args": [
    "--no-warnings",
    "--experimental-modules",
    "path/to/letta-server/src/index.js"
  ],
  "env": {
    "LETTA_BASE_URL": "https://your-letta-instance.com",
    "LETTA_PASSWORD": "yourPassword"
  },
  "disabled": false,
  "alwaysAllow": [
    "upload_tool",
    "attach_tool",
    "list_agents",
    "list_memory_blocks"
  ],
  "timeout": 300
}
```

For remote instances with HTTP transport (recommended):

```json
"remote_letta_tools": {
  "url": "http://your-server:3001/mcp",
  "transport": "http",
  "disabled": false,
  "alwaysAllow": [
    "attach_tool", 
    "list_agents",
    "list_tools",
    "get_agent"
  ],
  "timeout": 120
}
```

## Troubleshooting

### Common Issues

1. **Connection refused errors**
   - Ensure the server is running and accessible
   - Check firewall settings for port 3001
   - Verify the correct transport protocol is being used

2. **Authentication failures**
   - Verify LETTA_BASE_URL includes `/v1` suffix
   - Check LETTA_PASSWORD is correct
   - Ensure environment variables are loaded

3. **Tool execution timeouts**
   - Increase timeout values in MCP configuration
   - Check network latency for remote connections
   - Consider using HTTP transport for better reliability

### Health Check

The HTTP transport provides a health endpoint:

```bash
curl http://your-server:3001/health
```

Response:
```json
{
  "status": "healthy",
  "transport": "streamable_http",
  "protocol_version": "2025-06-18",
  "sessions": 0,
  "uptime": 12345.678
}
```

## License

MIT License - see LICENSE file for details
