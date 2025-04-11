# Letta MCP Server

A powerful server implementation of the Model Context Protocol (MCP) that provides comprehensive tools for agent management, memory operations, and integration with the Letta system.

## Overview

### What is Letta MCP Server?
Letta MCP Server is a Node.js-based implementation of the Model Context Protocol that enables:
- Creation and management of AI agents
- Persistent memory management for agents
- Tool attachment and management
- Integration with various LLM models
- Knowledge base management through passages

### Key Features
- 🤖 Comprehensive agent lifecycle management
- 💾 Persistent memory system
- 🔧 Extensible tool architecture
- 🔄 Import/Export capabilities
- 🔌 Multiple transport layers (SSE/stdio)
- 🐳 Docker-ready deployment

### Prerequisites
- Node.js >= 16.x
- NPM >= 8.x
- Docker (optional, for containerized deployment)
- Environment Variables:
  - LETTA_BASE_URL: Base URL for the Letta API
  - LETTA_PASSWORD: Authentication password
  - PORT: Server port (default: 3001)
  - NODE_ENV: Environment setting (development/production)

## Quick Setup

### Option 1: Local Development
```bash
# Install dependencies
npm install

# Development mode with hot reload
npm run dev:sse     # SSE transport
# OR
npm run dev         # stdio transport

# Production mode
npm run build
npm run start:sse   # SSE transport
# OR
npm run start       # stdio transport
```

### Option 2: Docker Deployment
```bash
# Build locally
docker build -t letta-mcp-server .
docker run -d \
  -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -e LETTA_BASE_URL=your_api_url \
  -e LETTA_PASSWORD=your_password \
  --name letta-mcp \
  letta-mcp-server

# Or use our public image
docker run -d \
  -p 3001:3001 \
  -e PORT=3001 \
  -e NODE_ENV=production \
  -e LETTA_BASE_URL=your_api_url \
  -e LETTA_PASSWORD=your_password \
  --name letta-mcp \
  ghcr.io/oculairmedia/letta-mcp-server:latest
```

## Feature Documentation

### Agent Management

#### Creating Agents
```javascript
// Example: Creating a new agent
{
  "name": "research_assistant",
  "description": "AI assistant specialized in research tasks",
  "model": "openai/gpt-4",        // Optional, defaults to gpt-4
  "embedding": "openai/text-embedding-ada-002"  // Optional
}
```

Available agent operations:
- `create_agent`: Create new agents
- `list_agents`: View all agents
- `modify_agent`: Update agent settings
- `delete_agent`: Remove agents
- `clone_agent`: Create agent copies
- `bulk_delete_agents`: Remove multiple agents
- `get_agent_summary`: Get agent details

### Memory System
The memory system provides persistent storage for agent context and knowledge:

Memory operations:
- `create_memory_block`: Create new memory blocks
- `read_memory_block`: Retrieve memory content
- `update_memory_block`: Modify existing memories
- `attach_memory_block`: Link memory to agents
- `list_memory_blocks`: View available memories

### Tool Management
Tools extend agent capabilities:

Available operations:
- `upload_tool`: Add new tools
- `attach_tool`: Connect tools to agents
- `list_tools`: View available tools
- `list_agent_tools`: See agent-specific tools
- `bulk_attach_tool_to_agents`: Mass tool assignment

## Configuration

### Environment Variables
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| LETTA_BASE_URL | Base URL for Letta API | Yes | - |
| LETTA_PASSWORD | API authentication | Yes | - |
| PORT | Server port | No | 3001 |
| NODE_ENV | Environment mode | No | development |

### MCP Settings Example
```json
{
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
    "alwaysAllow": ["upload_tool", "attach_tool", "list_agents"]
  }
}
```

## Development Guide

### Local Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure
4. Start development server: `npm run dev:sse`

### Testing
```bash
# Run all tests
npm test

# Run specific test suite
npm test -- --grep "Agent Management"
```

### Contributing
1. Fork the repository
2. Create feature branch
3. Commit changes
4. Submit pull request

## Troubleshooting

### Common Issues
1. Connection Refused
   - Check if LETTA_BASE_URL is accessible
   - Verify PORT is not in use

2. Authentication Failed
   - Verify LETTA_PASSWORD is correct
   - Check API token expiration

3. Tool Registration Failed
   - Verify tool schema matches requirements
   - Check for duplicate tool names

### Debug Mode
Enable debug logs:
```bash
DEBUG=letta:* npm run dev:sse
```

## Security Considerations
- Always use HTTPS in production
- Regularly rotate LETTA_PASSWORD
- Implement rate limiting for production
- Review tool permissions carefully
- Monitor server logs for unusual activity

## Support
- GitHub Issues: [Report bugs or request features]
- Documentation: [Link to full documentation]
- Community: [Link to community/forum]

## License
MIT License - see LICENSE file for details