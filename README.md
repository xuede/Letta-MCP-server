# Letta MCP Server

An MCP (Model Context Protocol) server implementation for interacting with the Letta API. This server provides tools for managing agents, memory blocks, and tools in the Letta system.

## Features

- Create and manage Letta agents
- List and filter available agents
- Create and manage memory blocks
- Attach memory blocks to agents
- List and manage agent tools
- Send messages to agents and receive responses

## Installation

```bash
# Clone the repository
git clone https://github.com/oculairmedia/Letta-MCP-server.git
cd letta-server

# Install dependencies
npm install
```

## Configuration

1. Create a `.env` file in the root directory with the following variables:
```
LETTA_BASE_URL=your_letta_api_url
LETTA_PASSWORD=your_letta_api_password
```

You can use the provided `.env.example` as a template.

## Available Scripts

- `npm run build`: Build the TypeScript code
- `npm run start`: Build and start the server
- `npm run dev`: Start the server in development mode with watch mode enabled

## Tools

### Agent Management
- `create_agent`: Create a new Letta agent with specified configuration
- `list_agents`: List all available agents in the Letta system
- `prompt_agent`: Send a message to an agent and get a response

### Memory Block Management
- `create_memory_block`: Create a new memory block
- `list_memory_blocks`: List all memory blocks
- `attach_memory_block`: Attach a memory block to an agent

### Tool Management
- `list_tools`: List all available tools
- `list_agent_tools`: List tools available for a specific agent
- `attach_tool`: Attach a tool to an agent

## Example Usage

When integrated with Cline, you can use the MCP tools as follows:

```typescript
// Create a memory block
<use_mcp_tool>
<server_name>letta</server_name>
<tool_name>create_memory_block</tool_name>
<arguments>
{
  "name": "example_block",
  "label": "custom",
  "value": "This is an example memory block."
}
</arguments>
</use_mcp_tool>

// Attach the block to an agent
<use_mcp_tool>
<server_name>letta</server_name>
<tool_name>attach_memory_block</tool_name>
<arguments>
{
  "block_id": "returned_block_id",
  "agent_id": "target_agent_id"
}
</arguments>
</use_mcp_tool>
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.