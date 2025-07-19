# Letta MCP Server Source Code

This directory contains the core implementation of the Letta MCP server with a modular architecture.

## Directory Structure

- `core/` - Core server functionality
  - `server.js` - Main LettaServer class with MCP initialization and Letta API communication
  - `logger.js` - Winston logger configuration for structured logging

- `tools/` - Tool implementations organized by domain
  - `agents/` - Agent management tools (create, list, modify, delete, clone, etc.)
  - `memory/` - Memory block operations (create, read, update, attach)
  - `passages/` - Passage management tools (CRUD operations)
  - `tools/` - Tool attachment and management (attach, upload, bulk operations)
  - `mcp/` - MCP server integration tools
  - `models/` - Model listing tools (LLM and embedding models)
  - `index.js` - Aggregates and registers all tool handlers

- `transports/` - Server transport implementations
  - `stdio-transport.js` - Standard I/O transport for local communication
  - `sse-transport.js` - Server-Sent Events transport for streaming
  - `http-transport.js` - HTTP transport with session management (recommended)
  - `index.js` - Transport selection logic

- `test/` - Comprehensive test suite
  - `core/` - Core functionality tests
  - `tools/` - Tool-specific tests
  - `transports/` - Transport layer tests
  - `utils/` - Test utilities and helpers

- `index.js` - Main entry point that initializes and runs the server

## Running the Server

### Development

```bash
# Run with stdio transport (default)
npm run dev

# Run with SSE transport
npm run dev:sse

# Run with HTTP transport (recommended)
npm run dev:http
```

### Production

```bash
# Run with stdio transport
npm run start

# Run with SSE transport
npm run start:sse

# Run with HTTP transport (recommended)
npm run start:http
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Environment Variables

- `LETTA_BASE_URL` - Letta API base URL (must include /v1 suffix)
- `LETTA_PASSWORD` - Authentication password for Letta API
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment mode (development/production)

See the main README.md for more detailed configuration and usage information.