# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Management

This repository is tracked in the Huly project management system:
- **Project**: Letta MCP Project (LMP)
- **Description**: Project for Letta MCP server
- **Issues**: Track bugs, features, and improvements in Huly under the LMP project identifier

## Commands

### Development
```bash
# Install dependencies
npm install

# Run server with different transports
npm run dev         # stdio transport (for local MCP integration)
npm run dev:sse     # SSE transport
npm run dev:http    # HTTP transport (recommended for production)

# Production
npm run start       # stdio transport
npm run start:sse   # SSE transport  
npm run start:http  # HTTP transport
```

### Docker Operations
```bash
# Build image
docker build -t letta-mcp-server .

# Run container
docker run -d -p 3001:3001 \
  -e LETTA_BASE_URL=https://your-letta-instance.com/v1 \
  -e LETTA_PASSWORD=your-password \
  -e PORT=3001 \
  -e NODE_ENV=production \
  --name letta-mcp \
  letta-mcp-server

# Health check
curl http://localhost:3001/health
```

### Testing Individual Tools
```bash
# Run server on alternate port for testing
PORT=3002 npm run dev:http

# Test tool functionality via MCP
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Architecture

### Core Structure
The server implements the Model Context Protocol (MCP) specification with a modular architecture:

1. **Entry Point** (`src/index.js`)
   - Initializes LettaServer instance
   - Registers all tool handlers via `registerToolHandlers()`
   - Determines transport mode from CLI args (`--http`, `--sse`, or default stdio)
   - Launches appropriate transport handler

2. **Server Core** (`src/core/server.js`)
   - `LettaServer` class manages MCP server instance and Letta API communication
   - Validates environment variables (`LETTA_BASE_URL`, `LETTA_PASSWORD`)
   - Provides centralized API client with authentication headers
   - Implements standardized error handling via `createErrorResponse()`

3. **Transport Layer** (`src/transports/`)
   - **http-transport.js**: Streamable HTTP with SSE fallback, session management, CORS, health endpoint
   - **sse-transport.js**: Server-Sent Events for unidirectional streaming
   - **stdio-transport.js**: Standard I/O for local process communication
   - All transports handle MCP protocol compliance and message routing

4. **Tool System** (`src/tools/`)
   - Tools organized by domain (agents/, memory/, passages/, tools/, mcp/, models/)
   - Each tool exports:
     - Handler function: Async function that processes requests
     - Tool definition: JSON schema describing parameters
   - `index.js` aggregates all tools and registers handlers with MCP server

### Key Patterns

**Tool Implementation Pattern**:
```javascript
// Tool definition with Zod schema
export const toolNameToolDefinition = {
    name: 'tool_name',
    description: 'What this tool does',
    inputSchema: zodToJsonSchema(ToolNameArgsSchema)
};

// Handler function
export async function handleToolName(server, args) {
    try {
        const validatedArgs = ToolNameArgsSchema.parse(args);
        const response = await server.api.post('/endpoint', data, {
            headers: server.getApiHeaders()
        });
        return { content: [{ type: 'text', text: JSON.stringify(response.data) }] };
    } catch (error) {
        server.createErrorResponse(error, 'Context for error');
    }
}
```

**Error Handling**:
- All API errors are caught and transformed to MCP-compliant error responses
- HTTP status codes are mapped to appropriate MCP error codes
- Detailed error context is preserved for debugging

**Session Management** (HTTP Transport):
- Sessions identified by UUID, stored in memory
- Automatic cleanup of inactive sessions (5-minute timeout)
- Session required for all non-initialize requests

### Environment Variables
- `LETTA_BASE_URL`: Letta API base URL (must include /v1 suffix)
- `LETTA_PASSWORD`: Authentication password for Letta API
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

### API Communication
All Letta API requests:
1. Use axios instance configured with base URL
2. Include authentication headers via `getApiHeaders()`
3. Handle responses with standardized error transformation
4. Return MCP-formatted tool responses

### Adding New Tools
1. Create new file in appropriate subdirectory under `src/tools/`
2. Define Zod schema for input validation
3. Export tool definition and handler function
4. Import and register in `src/tools/index.js`
5. Follow existing error handling patterns