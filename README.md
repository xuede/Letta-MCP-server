# Letta MCP Server with SSE Transport

This repository contains a Model Context Protocol (MCP) server implementation for the Letta platform with Server-Sent Events (SSE) transport support.

## Features

- Supports both SSE and stdio transports
- Provides access to Letta API functionality through MCP tools
- Secure by default with non-root user in Docker
- Environment variable configuration
- Health check endpoint

## Quick Start

### Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit the `.env` file with your Letta API credentials:
   ```
   LETTA_BASE_URL=https://your-letta-api-url.com
   LETTA_PASSWORD=your_password_here
   PORT=3001
   NODE_ENV=production
   ```

### Using Docker Compose

The easiest way to run the server is with Docker Compose:

```bash
docker-compose up -d
```

This will build the image if needed and start the server in detached mode.

### Using Docker Directly

You can also build and run the Docker image directly:

```bash
# Build the image
docker build -t oculair/letta-tools-mcp:v1.0.4 .

# Run the container
docker run -p 3001:3001 --env-file .env --rm -it oculair/letta-tools-mcp:v1.0.4
```

### Multi-Architecture Build

To build for multiple architectures (amd64 and arm64):

1. Enable Docker Buildx:
   ```bash
   docker buildx create --use --name multiarch-builder
   docker buildx inspect --bootstrap
   ```

2. Build and push:
   ```bash
   docker buildx build --platform linux/amd64,linux/arm64 \
     -t oculair/letta-tools-mcp:v1.0.4 \
     --push .
   ```

3. Verify the multi-architecture image:
   ```bash
   docker manifest inspect oculair/letta-tools-mcp:v1.0.4
   ```

## Development

### Project Structure

```
.
├── everything/
│   ├── src/
│   │   ├── core/       # Core server implementation
│   │   ├── tools/      # MCP tool implementations
│   │   ├── transports/ # Transport implementations (SSE, stdio)
│   │   └── index.js    # Main entry point
│   └── package.json    # Node.js dependencies
├── .env.example        # Example environment variables
├── .gitignore          # Git ignore file
├── compose.yaml        # Docker Compose configuration
├── Dockerfile          # Docker build configuration
└── README.md           # This file
```

### Debugging

To debug the container, you can run it with an interactive shell:

```bash
docker run -p 3001:3001 --env-file .env --rm -it --entrypoint bash oculair/letta-tools-mcp:v1.0.4
```

## Available MCP Tools

The Letta MCP Server provides the following tools for interacting with the Letta platform:

### Agent Management Tools

- `list_agents`: List all available agents in the Letta system
  - Optional filter parameter to search for specific agents
  - Returns agent IDs, names, and descriptions

- `create_agent`: Create a new Letta agent with specified configuration
  - Required parameters: name, description
  - Optional parameters: model (default: openai/gpt-4), embedding (default: openai/text-embedding-ada-002)

- `prompt_agent`: Send a message to an agent and get a response
  - Required parameters: agent_id, message
  - Returns the agent's response with reasoning if available

- `list_agent_tools`: List all tools available for a specific agent
  - Required parameter: agent_id

### Memory Management Tools

- `create_memory_block`: Create a new memory block in the Letta system
  - Required parameters: name, label, value

- `attach_memory_block`: Attach a memory block to an agent
  - Required parameters: block_id, agent_id
  - Optional parameter: label

- `list_memory_blocks`: List all memory blocks available in the Letta system
  - Supports filtering and pagination

### Agent Operations Tools

- `clone_agent`: Create a new agent by cloning an existing one
  - Required parameters: source_agent_id, new_agent_name

- `export_agent`: Export an agent's configuration to JSON
  - Required parameter: agent_id
  - Supports optional upload to external storage

- `import_agent`: Import a serialized agent JSON file
  - Required parameter: file_path

### System Tools

- `list_mcp_servers`: List all configured MCP servers on the Letta server

- `list_llm_models`: List available LLM models configured on the server

- `list_embedding_models`: List available embedding models configured on the server

- `upload_tool`: Upload a new tool to the Letta system
  - Required parameters: name, description, source_code