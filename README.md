# Letta MCP Server

A server that provides tools for agent management, memory operations, and integration with the Letta system.

## Quick Setup

### Option 1: Run with Node.js

```bash
# Development (with hot reload)
npm run dev:sse     # SSE transport

# Production
npm run build       # Build TypeScript first
npm run start:sse   # SSE transport
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

- index.js - Main entry point
- `core/` - Core server functionality
- `tools/` - Individual tool implementations
- `transports/` - Server transport implementations (stdio and SSE)

## Available Tools

### Agent Management

| Tool | Description | Required Parameters | Optional Parameters |
|------|-------------|---------------------|---------------------|
| `create_agent` | Create a new Letta agent | name, description | model, embedding |
| `list_agents` | List all available agents | - | filter |
| `prompt_agent` | Send a message to an agent | agent_id, message | - |
| `get_agent` | Get agent details by ID | agent_id | - |
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
| `list_tools` | List all available tools | - | filter, page, pageSize |
| `list_agent_tools` | List tools for a specific agent | agent_id | - |
| `attach_tool` | Attach tools to an agent | agent_id | tool_id, tool_ids, tool_names |
| `upload_tool` | Upload a new tool | name, description, source_code | category, agent_id |
| `bulk_attach_tool_to_agents` | Attach a tool to multiple agents | tool_id | agent_name_filter, agent_tag_filter |

### Additional Tools

- **Model Management**: `list_llm_models`, `list_embedding_models`
- **Archive Management**: `list_passages`, `create_passage`, `modify_passage`, `delete_passage`
- **MCP Server Management**: `list_mcp_servers`, `list_mcp_tools_by_server`
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
    "path/to/letta-server/index.js"
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

For remote instances, use the URL configuration:

```json
"remote_letta_tools": {
  "url": "http://your-server:3001/sse",
  "disabled": false,
  "alwaysAllow": [
    "attach_tool", 
    "list_agents",
    "list_tools",
    "get_agent"
  ],
  "timeout": 120
}
