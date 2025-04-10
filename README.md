# Letta MCP Server

This directory contains the reorganized Letta MCP server code with a more logical structure.

## Directory Structure

- `core/` - Core server functionality
  - `server.js` - Main server class with initialization and API communication

- `tools/` - Individual tool implementations
  - Contains various tool implementations for agent management, memory operations, and more
  - `index.js` - Exports all tool definitions and handlers

- `transports/` - Server transport implementations
  - `stdio-transport.js` - StdioServerTransport implementation
  - `sse-transport.js` - SSEServerTransport implementation
  - `index.js` - Exports all transport handlers

- `index.js` - Main entry point that initializes and runs the server

## Available MCP Tools

### Agent Management Tools

- `create_agent` - Create a new Letta agent with specified configuration
  - Required: name (string), description (string)
  - Optional: model (string, default: 'openai/gpt-4'), embedding (string, default: 'openai/text-embedding-ada-002')

- `list_agents` - List all available agents in the Letta system
  - Optional: filter (string) - Filter to search for specific agents

- `prompt_agent` - Send a message to an agent and get a response
  - Required: agent_id (string), message (string)

- `retrieve_agent` - Get the state of a specific agent by ID
  - Required: agent_id (string)

- `modify_agent` - Update an existing agent by ID with provided data
  - Required: agent_id (string), update_data (object)

- `delete_agent` - Delete a specific agent by ID
  - Required: agent_id (string)

- `clone_agent` - Create a new agent by cloning an existing one
  - Required: source_agent_id (string), new_agent_name (string)
  - Optional: override_existing_tools (boolean), project_id (string)

- `get_agent_summary` - Get a concise summary of an agent's configuration
  - Required: agent_id (string)

- `bulk_delete_agents` - Delete multiple agents based on criteria
  - Optional: agent_ids (string[]), agent_name_filter (string), agent_tag_filter (string)

### Memory Management Tools

- `list_memory_blocks` - List all memory blocks in the system
  - Optional: filter (string), agent_id (string), page (number), pageSize (number), label (string)

- `create_memory_block` - Create a new memory block
  - Required: name (string), label (string), value (string)
  - Optional: agent_id (string), metadata (object)

- `read_memory_block` - Get details of a specific memory block
  - Required: block_id (string)
  - Optional: agent_id (string)

- `update_memory_block` - Update contents/metadata of a memory block
  - Required: block_id (string)
  - Optional: value (string), metadata (object), agent_id (string)

- `attach_memory_block` - Attach a memory block to an agent
  - Required: block_id (string), agent_id (string)
  - Optional: label (string)

### Tool Management Tools

- `list_tools` - List all available tools on the Letta server
  - Optional: filter (string), page (number), pageSize (number)

- `list_agent_tools` - List tools available for a specific agent
  - Required: agent_id (string)

- `attach_tool` - Attach tools to an agent
  - Required: agent_id (string)
  - Optional: tool_id (string), tool_ids (string[]), tool_names (string[])

- `upload_tool` - Upload a new tool to the system
  - Required: name (string), description (string), source_code (string)
  - Optional: category (string), agent_id (string)

- `bulk_attach_tool_to_agents` - Attach a tool to multiple agents
  - Required: tool_id (string)
  - Optional: agent_name_filter (string), agent_tag_filter (string)

### Model Management Tools

- `list_llm_models` - List available LLM models
- `list_embedding_models` - List available embedding models

### Passage/Archive Tools

- `list_passages` - List memories in an agent's archival store
  - Required: agent_id (string)
  - Optional: after (string), before (string), limit (number), search (string)

- `create_passage` - Create a new memory in archival store
  - Required: agent_id (string), text (string)

- `modify_passage` - Modify an existing memory
  - Required: agent_id (string), memory_id (string), update_data (object)

- `delete_passage` - Delete a memory from archival store
  - Required: agent_id (string), memory_id (string)

### MCP Server Tools

- `list_mcp_servers` - List all configured MCP servers

- `list_mcp_tools_by_server` - List available tools for a specific MCP server
  - Required: mcp_server_name (string)
  - Optional: filter (string), page (number), pageSize (number)

- `export_agent` - Export an agent's configuration
  - Required: agent_id (string)
  - Optional: output_path (string), return_base64 (boolean), upload_to_xbackbone (boolean)

- `import_agent` - Import an agent from configuration
  - Required: file_path (string)
  - Optional: append_copy_suffix (boolean), override_existing_tools (boolean)

## Running the Server

### Using JavaScript (Development)

```bash
# Run with stdio transport
npm run dev

# Run with SSE transport
npm run dev:sse
```

### Using TypeScript (Production)

```bash
# Build the TypeScript code
npm run build

# Run with stdio transport
npm run start

# Run with SSE transport
npm run start:sse
```