import { registerResource, registerResourceTemplate } from '../handlers/resources.js';
import { createLogger } from '../core/logger.js';
import { generateToolDocumentation } from '../tools/enhanced-descriptions.js';
import { toolDefinitions } from '../tools/index.js';

const logger = createLogger('example-resources');

/**
 * Register example resources for Letta system information
 */
export function registerExampleResources(server) {
    // Agent Configuration Resource Template
    registerResourceTemplate({
        uriTemplate: 'letta://agents/{agent_id}/config',
        name: 'agent_config',
        title: 'Agent Configuration',
        description: 'Access full configuration for a specific Letta agent',
        mimeType: 'application/json',
    });

    // Memory Block Resource Template
    registerResourceTemplate({
        uriTemplate: 'letta://agents/{agent_id}/memory/{block_id}',
        name: 'memory_block',
        title: 'Memory Block Content',
        description: 'Access specific memory block content for an agent',
        mimeType: 'application/json',
    });

    // System Status Resource
    registerResource({
        uri: 'letta://system/status',
        name: 'system_status',
        title: 'Letta System Status',
        description: 'Current status of the Letta system including version and health',
        mimeType: 'application/json',
        handler: async () => {
            try {
                const response = await server.api.get('/health', {
                    headers: server.getApiHeaders(),
                });

                return {
                    text: JSON.stringify({
                        status: 'healthy',
                        timestamp: new Date().toISOString(),
                        version: '1.1.0',
                        api_health: response.data,
                    }, null, 2),
                };
            } catch (error) {
                logger.error('Error fetching system status', { error: error.message });
                return {
                    text: JSON.stringify({
                        status: 'error',
                        timestamp: new Date().toISOString(),
                        error: error.message,
                    }, null, 2),
                };
            }
        },
    });

    // Models Configuration Resource
    registerResource({
        uri: 'letta://system/models',
        name: 'available_models',
        title: 'Available Models',
        description: 'List of available LLM and embedding models in the system',
        mimeType: 'application/json',
        handler: async () => {
            try {
                const [llmResponse, embeddingResponse] = await Promise.all([
                    server.api.get('/models', {
                        headers: server.getApiHeaders(),
                    }),
                    server.api.get('/models/embedding', {
                        headers: server.getApiHeaders(),
                    }),
                ]);

                return {
                    text: JSON.stringify({
                        llm_models: llmResponse.data,
                        embedding_models: embeddingResponse.data,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            } catch (error) {
                logger.error('Error fetching models', { error: error.message });
                return {
                    text: JSON.stringify({
                        error: error.message,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            }
        },
    });

    // MCP Servers Resource
    registerResource({
        uri: 'letta://system/mcp-servers',
        name: 'mcp_servers',
        title: 'Available MCP Servers',
        description: 'List of connected MCP servers and their capabilities',
        mimeType: 'application/json',
        handler: async () => {
            try {
                const response = await server.api.get('/tools/mcp/servers', {
                    headers: server.getApiHeaders(),
                });

                return {
                    text: JSON.stringify({
                        servers: response.data,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            } catch (error) {
                logger.error('Error fetching MCP servers', { error: error.message });
                return {
                    text: JSON.stringify({
                        error: error.message,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            }
        },
    });

    // Agent List Resource
    registerResource({
        uri: 'letta://agents/list',
        name: 'agent_list',
        title: 'All Letta Agents',
        description: 'Complete list of all agents in the system with basic metadata',
        mimeType: 'application/json',
        handler: async () => {
            try {
                const response = await server.api.get('/agents', {
                    headers: server.getApiHeaders(),
                });

                const agents = response.data || [];
                const summary = agents.map(agent => ({
                    id: agent.id,
                    name: agent.name,
                    description: agent.description,
                    created_at: agent.created_at,
                    tool_count: agent.tools?.length || 0,
                    memory_blocks: agent.memory?.length || 0,
                }));

                return {
                    text: JSON.stringify({
                        total_agents: agents.length,
                        agents: summary,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            } catch (error) {
                logger.error('Error fetching agents', { error: error.message });
                return {
                    text: JSON.stringify({
                        error: error.message,
                        timestamp: new Date().toISOString(),
                    }, null, 2),
                };
            }
        },
    });

    // Tool Documentation Resource Template
    registerResourceTemplate({
        uriTemplate: 'letta://tools/{tool_name}/docs',
        name: 'tool_documentation',
        title: 'Tool Documentation',
        description: 'Detailed documentation for a specific tool',
        mimeType: 'text/markdown',
    });

    // All Tools Documentation Resource
    registerResource({
        uri: 'letta://tools/all/docs',
        name: 'all_tools_docs',
        title: 'All Tools Documentation',
        description: 'Complete documentation for all available tools with examples',
        mimeType: 'text/markdown',
        handler: async () => {
            let allDocs = '# Letta MCP Server - All Tools Documentation\n\n';
            allDocs += 'This document provides detailed information about all available tools.\n\n';
            allDocs += '## Table of Contents\n\n';

            // Generate TOC
            toolDefinitions.forEach(tool => {
                allDocs += `- [${tool.name}](#${tool.name.replace(/_/g, '-')})\n`;
            });
            allDocs += '\n---\n\n';

            // Generate documentation for each tool
            toolDefinitions.forEach(tool => {
                allDocs += generateToolDocumentation(tool.name);
                allDocs += '\n---\n\n';
            });

            return { text: allDocs };
        },
    });

    // Documentation Resource
    registerResource({
        uri: 'letta://docs/mcp-integration',
        name: 'mcp_integration_docs',
        title: 'MCP Integration Documentation',
        description: 'Documentation for integrating MCP tools with Letta agents',
        mimeType: 'text/markdown',
        handler: async () => {
            return {
                text: `# Letta MCP Integration Documentation

## Overview
This MCP server provides full integration with Letta, enabling:
- Agent management (create, modify, delete)
- Memory system control (blocks, passages)
- Tool management and MCP server integration
- Model configuration

## Quick Start

### Creating an Agent
Use the \`create_agent\` tool with a name and description. The agent will be created with default settings.

### Attaching Tools
1. List available tools with \`list_mcp_tools_by_server\`
2. Attach tools using \`attach_tool\` with the agent ID and tool ID

### Managing Memory
- Core memory: Use \`create_memory_block\` and \`attach_memory_block\`
- Archival memory: Use \`create_passage\` for long-term storage

## Advanced Features

### Prompts
- \`letta_agent_wizard\`: Interactive agent creation
- \`letta_memory_optimizer\`: Memory usage optimization
- \`letta_debug_assistant\`: Troubleshooting help
- \`letta_tool_config\`: Tool management assistance
- \`letta_migration\`: Agent migration tools

### Resources
- \`letta://system/status\`: System health check
- \`letta://system/models\`: Available models
- \`letta://agents/list\`: All agents overview
- \`letta://system/mcp-servers\`: MCP server list

## Best Practices
1. Always set up core memory blocks (persona, human) for new agents
2. Use archival memory for long-term information storage
3. Regularly audit tool attachments for optimal performance
4. Monitor system resources and agent activity

## Troubleshooting
If an agent is not responding:
1. Check agent status with \`retrieve_agent\`
2. Verify memory blocks are properly attached
3. Ensure required tools are available
4. Use the debug assistant prompt for detailed diagnostics`,
            };
        },
    });

    // API Reference Resource
    registerResource({
        uri: 'letta://docs/api-reference',
        name: 'api_reference',
        title: 'Letta API Quick Reference',
        description: 'Quick reference for common Letta API operations',
        mimeType: 'text/markdown',
        handler: async () => {
            return {
                text: `# Letta API Quick Reference

## Authentication
All requests require Bearer token authentication:
\`\`\`
Authorization: Bearer <your-token>
\`\`\`

## Common Endpoints

### Agents
- GET /agents - List all agents
- POST /agents - Create new agent
- GET /agents/{id} - Get agent details
- PUT /agents/{id} - Update agent
- DELETE /agents/{id} - Delete agent

### Memory
- GET /agents/{id}/memory - Get core memory
- POST /agents/{id}/memory - Update core memory
- GET /agents/{id}/memory/blocks - List memory blocks
- POST /agents/{id}/memory/blocks - Create memory block

### Messages
- POST /agents/{id}/messages - Send message to agent
- GET /agents/{id}/messages - Get message history

### Tools
- GET /tools - List all tools
- POST /tools - Create new tool
- POST /agents/{id}/tools - Attach tool to agent
- DELETE /agents/{id}/tools/{tool_id} - Detach tool

### MCP Integration
- GET /tools/mcp/servers - List MCP servers
- GET /tools/mcp/servers/{name}/tools - List tools from MCP server

## Response Format
All responses follow this structure:
\`\`\`json
{
  "status": "success|error",
  "data": { ... },
  "error": "Error message if applicable"
}
\`\`\``,
            };
        },
    });
}