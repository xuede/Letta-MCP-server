# Letta MCP Server Tools

This directory contains all the tool implementations for the Letta MCP Server, organized by functionality:

## Directory Structure

- **agents/** - Tools for managing Letta agents
  - `create-agent.js` - Create new agents
  - `list-agents.js` - List all agents
  - `prompt-agent.js` - Send prompts to agents
  - `modify-agent.js` - Modify agent configuration
  - `delete-agent.js` - Delete agents
  - `clone-agent.js` - Clone existing agents
  - `export-agent.js` - Export agent configurations
  - `import-agent.js` - Import agent configurations
  - `retrieve-agent.js` - Get agent details
  - `list-agent-tools.js` - List tools attached to an agent
  - `get-agent-summary.js` - Get agent summary information
  - `bulk-delete-agents.js` - Delete multiple agents at once

- **memory/** - Tools for managing memory blocks
  - `list-memory-blocks.js` - List memory blocks
  - `create-memory-block.js` - Create new memory blocks
  - `read-memory-block.js` - Read memory block contents
  - `update-memory-block.js` - Update memory blocks
  - `attach-memory-block.js` - Attach memory blocks to agents

- **passages/** - Tools for managing passages
  - `list-passages.js` - List passages
  - `create-passage.js` - Create new passages
  - `modify-passage.js` - Modify existing passages
  - `delete-passage.js` - Delete passages

- **tools/** - Tools for managing Letta tools
  - `attach-tool.js` - Attach tools to agents
  - `bulk-attach-tool.js` - Attach tools to multiple agents
  - `upload-tool.js` - Upload new tools

- **mcp/** - Tools for MCP server integration
  - `list-mcp-servers.js` - List available MCP servers
  - `list-mcp-tools-by-server.js` - List tools from specific MCP servers
  - `add-mcp-tool-to-letta.js` - Add MCP tools to Letta

- **models/** - Tools for managing language models
  - `list-llm-models.js` - List available LLM models
  - `list-embedding-models.js` - List available embedding models

## Tool Implementation

Each tool module exports:
- A handler function (e.g., `handleListAgents`)
- A tool definition object (e.g., `listAgentsToolDefinition`)

The `index.js` file imports all tools and registers them with the MCP server.