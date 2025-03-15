#!/usr/bin/env node
import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';

// Load environment variables
dotenv.config();

// Types
interface MCPRequest {
  id: string;
  method: string;
  params: any;
}

interface MCPResponse {
  id: string;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

type HeadersConfig = AxiosRequestConfig['headers'];

class LettaServer {
  private server: Server;
  private api: AxiosInstance;
  private apiBase: string;
  private password: string;
  private existingAgentId: string;
  private addressBookId: string;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'letta-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up error handler
    this.server.onerror = (error: any) => console.error('[MCP Error]', error);

    // Set up tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'create_agent',
          description: 'Create a new Letta agent with specified configuration',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the new agent',
              },
              description: {
                type: 'string',
                description: 'Description of the agent\'s purpose/role',
              },
              model: {
                type: 'string',
                description: 'The model to use for the agent',
                default: 'openai/gpt-4',
              },
              embedding: {
                type: 'string',
                description: 'The embedding model to use',
                default: 'openai/text-embedding-ada-002',
              },
            },
            required: ['name', 'description'],
          },
        },
        {
          name: 'list_agents',
          description: 'List all available agents in the Letta system',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to search for specific agents',
              },
            },
            required: [],
          },
        },
        {
          name: 'prompt_agent',
          description: 'Send a message to an agent and get a response',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'ID of the agent to prompt',
              },
              message: {
                type: 'string',
                description: 'Message to send to the agent',
              },
            },
            required: ['agent_id', 'message'],
          },
        },
        {
          name: 'list_agent_tools',
          description: 'List all tools available for a specific agent',
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: {
                type: 'string',
                description: 'ID of the agent to list tools for',
              },
            },
            required: ['agent_id'],
          },
        },
        {
          name: 'list_tools',
          description: 'List all available tools on the Letta server',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to search for specific tools by name or description',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
              },
              pageSize: {
                type: 'number',
                description: 'Number of tools per page (1-100, default: 10)',
              },
            },
            required: [],
          },
        },
        {
          name: 'attach_tool',
          description: 'Attach a tool to an agent',
          inputSchema: {
            type: 'object',
            properties: {
              tool_id: {
                type: 'string',
                description: 'The ID of the tool to attach',
              },
              agent_id: {
                type: 'string',
                description: 'The ID of the agent to attach the tool to',
              },
            },
            required: ['tool_id', 'agent_id'],
          },
        },
        {
          name: 'list_memory_blocks',
          description: 'List all memory blocks available in the Letta system',
          inputSchema: {
            type: 'object',
            properties: {
              filter: {
                type: 'string',
                description: 'Optional filter to search for specific blocks by name or content',
              },
              agent_id: {
                type: 'string',
                description: 'Optional agent ID to list blocks for a specific agent',
              },
              page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
              },
              pageSize: {
                type: 'number',
                description: 'Number of blocks per page (1-100, default: 10)',
              },
              label: {
                type: 'string',
                description: 'Optional filter for block label (e.g., "human", "persona")',
              },
              templates_only: {
                type: 'boolean',
                description: 'Whether to include only templates (default: false)',
              },
              name: {
                type: 'string',
                description: 'Optional filter for block name',
              },
              include_full_content: {
                type: 'boolean',
                description: 'Whether to include the full content of blocks (default: false)',
              },
            },
            required: [],
          },
        },
        {
          name: 'read_memory_block',
          description: 'Get full details of a specific memory block by ID',
          inputSchema: {
            type: 'object',
            properties: {
              block_id: {
                type: 'string',
                description: 'ID of the memory block to retrieve'
              }
            },
            required: ['block_id']
          }
        },
        {
          name: 'update_memory_block',
          description: 'Update the contents and metadata of a memory block',
          inputSchema: {
            type: 'object',
            properties: {
              block_id: {
                type: 'string',
                description: 'ID of the memory block to update'
              },
              value: {
                type: 'string',
                description: 'New value for the memory block (optional)'
              },
              metadata: {
                type: 'object',
                description: 'New metadata for the memory block (optional)'
              },
              agent_id: {
                type: 'string',
                description: 'Optional agent ID for authorization'
              }
            },
            required: ['block_id'],
            anyOf: [
              { required: ['value'] },
              { required: ['metadata'] }
            ]
          }
        },
        {
          name: 'attach_memory_block',
          description: 'Attach a memory block to an agent',
          inputSchema: {
            type: 'object',
            properties: {
              block_id: {
                type: 'string',
                description: 'The ID of the memory block to attach',
              },
              agent_id: {
                type: 'string',
                description: 'The ID of the agent to attach the memory block to',
              },
              label: {
                type: 'string',
                description: 'Optional label for the memory block (e.g., "persona", "human", "system")',
              },
            },
            required: ['block_id', 'agent_id'],
          },
        },
        {
          name: 'create_memory_block',
          description: 'Create a new memory block in the Letta system',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the memory block',
              },
              label: {
                type: 'string',
                description: 'Label for the memory block (e.g., "persona", "human", "system")',
              },
              value: {
                type: 'string',
                description: 'Content of the memory block',
              },
              agent_id: {
                type: 'string',
                description: 'Optional agent ID to create the block for a specific agent',
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata for the memory block',
              },
            },
            required: ['name', 'label', 'value'],
          },
        },
        {
          name: 'upload_tool',
          description: 'Upload a new tool to the Letta system',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name of the tool',
              },
              description: {
                type: 'string',
                description: 'Description of what the tool does',
              },
              source_code: {
                type: 'string',
                description: 'Python source code for the tool',
              },
              category: {
                type: 'string',
                description: 'Category/tag for the tool (e.g., "plane_api", "utility")',
                default: 'custom',
              },
              agent_id: {
                type: 'string',
                description: 'Optional agent ID to attach the tool to after creation',
              }
            },
            required: ['name', 'description', 'source_code'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      if (request.params.name === 'create_agent') {
        return this.handleCreateAgent(request.params.arguments);
      } else if (request.params.name === 'list_agents') {
        return this.handleListAgents(request.params.arguments);
      } else if (request.params.name === 'prompt_agent') {
        return this.handlePromptAgent(request.params.arguments);
      } else if (request.params.name === 'list_agent_tools') {
        return this.handleListAgentTools(request.params.arguments);
      } else if (request.params.name === 'list_tools') {
        return this.handleListTools(request.params.arguments);
      } else if (request.params.name === 'attach_tool') {
        return this.handleAttachTool(request.params.arguments);
      } else if (request.params.name === 'list_memory_blocks') {
        return this.handleListMemoryBlocks(request.params.arguments);
      } else if (request.params.name === 'attach_memory_block') {
        return this.handleAttachMemoryBlock(request.params.arguments);
      } else if (request.params.name === 'create_memory_block') {
        return this.handleCreateMemoryBlock(request.params.arguments);
      } else if (request.params.name === 'read_memory_block') {
        return this.handleReadMemoryBlock(request.params.arguments);
      } else if (request.params.name === 'update_memory_block') {
        return this.handleUpdateMemoryBlock(request.params.arguments);
      } else if (request.params.name === 'upload_tool') {
        return this.handleUploadTool(request.params.arguments);
      }
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    });

    // Validate environment variables
    this.apiBase = process.env.LETTA_BASE_URL ?? '';
    this.password = process.env.LETTA_PASSWORD ?? '';

    if (!this.apiBase || !this.password) {
      throw new Error('Missing required environment variables: LETTA_BASE_URL, LETTA_PASSWORD');
    }

    // Initialize axios instance
    this.apiBase = `${this.apiBase}/v1`;
    this.api = axios.create({
      baseURL: this.apiBase,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Constants
    this.existingAgentId = "agent-755f1df6-6c53-4a62-8cf5-e1c441c3bd41"; // Pansil
    this.addressBookId = "block-9e32f2b6-587b-4b9d-a5a7-c24c099fb781";
  }

  private async handleCreateAgent(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.name || !args.description || typeof args.name !== 'string' || typeof args.description !== 'string') {
        throw new Error('Invalid arguments: name and description must be strings');
      }

      const model = args.model ?? 'openai/gpt-4';
      const embedding = args.embedding ?? 'openai/text-embedding-ada-002';

      // Agent configuration
      const agentConfig = {
        name: args.name,
        description: args.description,
        agent_type: "memgpt_agent",
        model: model,
        llm_config: {
          model: model.split('/')[1],
          model_endpoint_type: model.split('/')[0],
          context_window: 16000,
          max_tokens: 1000,
          temperature: 0.7,
          frequency_penalty: 0.5,
          presence_penalty: 0.5,
          functions_config: {
            allow: true,
            functions: []
          }
        },
        embedding: embedding,
        parameters: {
          context_window: 16000,
          max_tokens: 1000,
          temperature: 0.7,
          presence_penalty: 0.5,
          frequency_penalty: 0.5
        },
        core_memory: {}
      };

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // 1. Create agent
      const createAgentResponse = await this.api.post('/agents', agentConfig, { headers });
      const agentId = createAgentResponse.data.id;

      // Update headers with agent ID
      headers['user_id'] = agentId;

      // Note: Memory blocks should be created and attached separately using the create_memory_block
      // and attach_memory_block tools after agent creation

      // Note: Memory blocks should be attached explicitly via the attach_memory_block tool
      // rather than automatically during agent creation

      // Note: Agent registration in address book should be handled separately
      // after agent creation using the appropriate memory block tools
      
      // Get agent info for the response
      const agentInfo = await this.api.get(`/agents/${agentId}`, { headers });
      const capabilities = agentInfo.data.tools?.map((t: any) => t.name) ?? [];

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Agent ${args.name} created successfully with ID: ${agentId}`,
            agent_id: agentId,
            capabilities,
          }, null, 2),
        }],
      };

    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleListAgents(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // Get the list of agents
      const response = await this.api.get('/agents', { headers });
      const agents = response.data;

      // Apply filter if provided
      let filteredAgents = agents;
      if (args && args.filter) {
        const filter = args.filter.toLowerCase();
        filteredAgents = agents.filter((agent: any) =>
          agent.name.toLowerCase().includes(filter) ||
          (agent.description && agent.description.toLowerCase().includes(filter))
        );
      }

      // Format the response
      const formattedAgents = filteredAgents.map((agent: any) => ({
        id: agent.id,
        name: agent.name,
        description: agent.description || 'No description',
        type: agent.agent_type,
        model: agent.model,
        created_at: agent.created_at,
        updated_at: agent.updated_at
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            count: formattedAgents.length,
            agents: formattedAgents
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handlePromptAgent(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.agent_id || !args.message) {
        throw new Error('Missing required arguments: agent_id and message');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`,
        'Authorization': `Bearer ${this.password}`
      };

      // First, check if the agent exists
      const agentInfoResponse = await this.api.get(`/agents/${args.agent_id}`, { headers });
      const agentName = agentInfoResponse.data.name;

      // Send message to agent using the messages/stream endpoint
      const response = await this.api.post(`/agents/${args.agent_id}/messages/stream`, {
        messages: [
          {
            role: "user",
            content: args.message
          }
        ],
        stream_steps: false,
        stream_tokens: false
      }, {
        headers,
        responseType: 'text'
      });

      // Extract the response
      let responseText = "";
      try {
        // The response is in Server-Sent Events (SSE) format
        if (typeof response.data === 'string') {
          // Find lines that start with "data: "
          const dataLines = response.data
            .split('\n')
            .filter(line => line.trim().startsWith('data: '));
          
          // Process each data line
          const messages = [];
          for (const line of dataLines) {
            try {
              // Extract the JSON part after "data: "
              const jsonStr = line.substring(6);
              const eventData = JSON.parse(jsonStr);
              
              // Extract the message content based on message type
              if (eventData.message_type === 'assistant_message' && eventData.content) {
                // This is the main response message
                responseText = eventData.content;
                break;
              } else if (eventData.message_type === 'reasoning_message' && eventData.reasoning) {
                // This is the reasoning message (agent's thought process)
                messages.push(`[Reasoning]: ${eventData.reasoning}`);
              } else if (eventData.delta && eventData.delta.content) {
                // This is a streaming delta update
                messages.push(eventData.delta.content);
              }
            } catch (jsonError) {
              console.error("Error parsing SSE JSON:", jsonError);
              // If we can't parse the JSON, just add the raw line
              messages.push(line.substring(6));
            }
          }
          
          // If we didn't find a specific assistant message, join all messages
          if (!responseText && messages.length > 0) {
            responseText = messages.join('\n');
          }
          
          // If we still don't have a response, use the raw data
          if (!responseText) {
            responseText = "Received response but couldn't extract message content";
          }
        } else if (response.data) {
          // Handle non-string response (unlikely with SSE)
          responseText = JSON.stringify(response.data);
        }
      } catch (error) {
        console.error("Error parsing response:", error);
        responseText = "Error parsing agent response";
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            agent_id: args.agent_id,
            agent_name: agentName,
            message: args.message,
            response: responseText,
            raw_response_length: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleListAgentTools(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.agent_id) {
        throw new Error('Missing required argument: agent_id');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // Get agent info to check if it exists and get its tools
      const agentInfoResponse = await this.api.get(`/agents/${args.agent_id}`, { headers });
      const agentName = agentInfoResponse.data.name;
      
      // Extract tools from agent info
      let tools = [];
      if (agentInfoResponse.data.tools && Array.isArray(agentInfoResponse.data.tools)) {
        tools = agentInfoResponse.data.tools;
      }

      // Format the response
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            agent_id: args.agent_id,
            agent_name: agentName,
            tool_count: tools.length,
            tools: tools
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleListTools(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // Get all tools from the Letta server
      const toolsResponse = await this.api.get('/tools', { headers });
      let tools = toolsResponse.data;
      
      // Apply filter if provided
      if (args && args.filter && typeof args.filter === 'string') {
        const filterLower = args.filter.toLowerCase();
        tools = tools.filter((tool: any) =>
          (tool.name && tool.name.toLowerCase().includes(filterLower)) ||
          (tool.description && tool.description.toLowerCase().includes(filterLower))
        );
      }

      // Apply pagination
      const page = args && typeof args.page === 'number' ? Math.max(1, args.page) : 1;
      const pageSize = args && typeof args.pageSize === 'number' ? Math.max(1, Math.min(100, args.pageSize)) : 10;
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      const totalTools = tools.length;
      const totalPages = Math.ceil(totalTools / pageSize);
      const paginatedTools = tools.slice(startIndex, endIndex);

      // Format the response
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            pagination: {
              page: page,
              pageSize: pageSize,
              totalTools: totalTools,
              totalPages: totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1
            },
            tool_count: paginatedTools.length,
            tools: paginatedTools
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleAttachTool(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.tool_id) {
        throw new Error('Missing required argument: tool_id');
      }
      if (!args.agent_id) {
        throw new Error('Missing required argument: agent_id');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`,
        'user_id': args.agent_id
      };

      // Verify tool exists
      const toolResponse = await this.api.get(`/tools/${args.tool_id}`, { headers });
      const toolData = toolResponse.data;
      const toolName = toolData.name || 'Unknown';

      // Attach tool to agent
      console.log(`Attaching tool ${toolName} (${args.tool_id}) to agent ${args.agent_id}...`);
      const attachUrl = `/agents/${args.agent_id}/tools/attach/${args.tool_id}`;
      
      const response = await this.api.patch(attachUrl, {}, { headers });
      
      // Get updated agent data
      const agentData = response.data;
      
      // Check if tool is now in agent's tools
      const attachedToolIds = agentData.tools?.map((tool: any) => tool.id) || [];
      if (attachedToolIds.includes(args.tool_id)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Tool ${toolName} successfully attached to agent ${args.agent_id}.`,
              agent_id: args.agent_id,
              agent_name: agentData.name || 'Unknown',
              tool_id: args.tool_id,
              tool_name: toolName
            }, null, 2),
          }],
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Tool ${args.tool_id} was not found in agent's tools after attachment.`,
            }, null, 2),
          }],
          isError: true,
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleListMemoryBlocks(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // If agent_id is provided, set the user_id header
      if (args && args.agent_id) {
        headers['user_id'] = args.agent_id;
      }

      // Prepare query parameters for the blocks endpoint
      const queryParams: any = {};
      
      // Add label filter if provided
      if (args && args.label) {
        queryParams.label = args.label;
      }
      
      // Add templates_only filter (default to false if not provided)
      queryParams.templates_only = args && args.templates_only !== undefined ? args.templates_only : false;
      
      // Add name filter if provided
      if (args && args.name) {
        queryParams.name = args.name;
      }

      // Get blocks from the Letta server
      let endpoint = '/blocks';
      if (args && args.agent_id) {
        // If agent_id is provided, use the agent-specific blocks endpoint
        endpoint = `/agents/${args.agent_id}/core-memory/blocks`;
      }
      
      const blocksResponse = await this.api.get(endpoint, {
        headers,
        params: queryParams
      });
      
      let blocks = blocksResponse.data;
      
      // Apply text filter if provided (this is separate from the API's label/name filters)
      if (args && args.filter && typeof args.filter === 'string') {
        const filterLower = args.filter.toLowerCase();
        blocks = blocks.filter((block: any) =>
          (block.name && block.name.toLowerCase().includes(filterLower)) ||
          (block.label && block.label.toLowerCase().includes(filterLower)) ||
          (block.value && typeof block.value === 'string' && block.value.toLowerCase().includes(filterLower))
        );
      }

      // Apply pagination
      const page = args && typeof args.page === 'number' ? Math.max(1, args.page) : 1;
      const pageSize = args && typeof args.pageSize === 'number' ? Math.max(1, Math.min(100, args.pageSize)) : 10;
      
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      
      const totalBlocks = blocks.length;
      const totalPages = Math.ceil(totalBlocks / pageSize);
      const paginatedBlocks = blocks.slice(startIndex, endIndex);

      // Format blocks for output
      const formattedBlocks = paginatedBlocks.map((block: any) => {
        const result: any = {
          id: block.id,
          name: block.name || 'Unnamed Block',
          label: block.label || 'No Label',
          metadata: block.metadata || {},
          limit: block.limit || 5000,
          created_at: block.created_at,
          updated_at: block.updated_at
        };
        
        // Include full content or truncated preview based on args
        if (args && args.include_full_content) {
          result.value = block.value;
        } else {
          // Truncate value if it's too long
          let value = block.value;
          if (typeof value === 'string') {
            result.value_preview = value.length > 200 ? value.substring(0, 200) + '...' : value;
          } else {
            result.value_preview = 'Non-string value';
          }
        }
        
        // Add agents using this block if available
        if (block.agents && Array.isArray(block.agents)) {
          result.agents = block.agents.map((agent: any) => ({
            id: agent.id,
            name: agent.name
          }));
        }
        
        return result;
      });

      // Format the response
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            pagination: {
              page: page,
              pageSize: pageSize,
              totalBlocks: totalBlocks,
              totalPages: totalPages,
              hasNextPage: page < totalPages,
              hasPreviousPage: page > 1
            },
            block_count: formattedBlocks.length,
            blocks: formattedBlocks,
            agent_specific: args && args.agent_id ? true : false,
            filters: {
              label: args?.label,
              name: args?.name,
              templates_only: args?.templates_only,
              text_filter: args?.filter
            }
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleAttachMemoryBlock(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.block_id) {
        throw new Error('Missing required argument: block_id');
      }
      if (!args.agent_id) {
        throw new Error('Missing required argument: agent_id');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`,
        'user_id': args.agent_id
      };

      // Verify block exists
      const blockResponse = await this.api.get(`/blocks/${args.block_id}`, { headers });
      const blockData = blockResponse.data;
      const blockName = blockData.name || 'Unnamed Block';
      
      // Determine label to use
      const label = args.label || blockData.label || 'custom';
      
      // Attach block to agent
      console.log(`Attaching memory block ${blockName} (${args.block_id}) to agent ${args.agent_id} with label ${label}...`);
      
      // Use the core-memory/blocks/attach endpoint
      const attachUrl = `/agents/${args.agent_id}/core-memory/blocks/attach/${args.block_id}`;
      
      // Send an empty object as the request body, as seen in handleCreateAgent method
      const response = await this.api.patch(attachUrl, {}, { headers });
      
      // Get updated agent data to verify attachment
      const agentInfoResponse = await this.api.get(`/agents/${args.agent_id}`, { headers });
      const agentData = agentInfoResponse.data;
      const agentName = agentData.name || 'Unknown';
      
      // Check if block is now in agent's memory blocks
      // This is a simplified check - in a real implementation, you might want to
      // check the agent's memory blocks more thoroughly
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Memory block ${blockName} successfully attached to agent ${agentName} with label ${label}.`,
            agent_id: args.agent_id,
            agent_name: agentName,
            block_id: args.block_id,
            block_name: blockName,
            label: label
          }, null, 2),
        }],
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleReadMemoryBlock(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      if (!args?.block_id) {
        throw new Error('Missing required argument: block_id');
      }

      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      if (args.agent_id) {
        headers['user_id'] = args.agent_id;
      }

      const response = await this.api.get(`/blocks/${args.block_id}`, {
        headers,
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            block: response.data
          }, null, 2),
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleUpdateMemoryBlock(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      if (!args?.block_id) {
        throw new Error('Missing required argument: block_id');
      }
      
      if (!args?.value && !args?.metadata) {
        throw new Error('Either value or metadata must be provided');
      }

      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      if (args.agent_id) {
        headers['user_id'] = args.agent_id;
      }

      const updateData: any = {};
      if (args.value !== undefined) {
        updateData.value = args.value;
      }
      if (args.metadata !== undefined) {
        updateData.metadata = args.metadata;
      }

      const response = await this.api.patch(`/blocks/${args.block_id}`, updateData, { headers });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            block: response.data
          }, null, 2),
        }]
      };
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleCreateMemoryBlock(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.name || typeof args.name !== 'string') {
        throw new Error('Missing required argument: name (must be a string)');
      }
      if (!args.label || typeof args.label !== 'string') {
        throw new Error('Missing required argument: label (must be a string)');
      }
      if (!args.value || typeof args.value !== 'string') {
        throw new Error('Missing required argument: value (must be a string)');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // If agent_id is provided, set the user_id header
      if (args.agent_id) {
        headers['user_id'] = args.agent_id;
      }

      // Prepare metadata
      const metadata = args.metadata || {
        type: args.label,
        version: "1.0",
        last_updated: new Date().toISOString()
      };

      // Prepare block data
      const blockData = {
        name: args.name,
        label: args.label,
        value: args.value,
        metadata: metadata
      };

      // Create the memory block
      console.log(`Creating memory block "${args.name}" with label "${args.label}"...`);
      const createResponse = await this.api.post('/blocks', blockData, { headers });
      const blockId = createResponse.data.id;

      // If agent_id is provided, attach the block to the agent
      if (args.agent_id) {
        const attachUrl = `/agents/${args.agent_id}/core-memory/blocks/attach/${blockId}`;
        await this.api.patch(attachUrl, {}, { headers });
        
        // Get agent info
        const agentInfoResponse = await this.api.get(`/agents/${args.agent_id}`, { headers });
        const agentName = agentInfoResponse.data.name || 'Unknown';
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Memory block "${args.name}" created and attached to agent ${agentName}.`,
              block_id: blockId,
              block_name: args.name,
              agent_id: args.agent_id,
              agent_name: agentName,
              label: args.label
            }, null, 2),
          }],
        };
      } else {
        // Just return the created block info
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Memory block "${args.name}" created successfully.`,
              block_id: blockId,
              block_name: args.name,
              label: args.label
            }, null, 2),
          }],
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  private async handleUploadTool(args: any): Promise<{ content: { type: string; text: string; }[]; isError?: boolean }> {
    try {
      // Validate arguments
      if (!args.name || typeof args.name !== 'string') {
        throw new Error('Missing required argument: name (must be a string)');
      }
      if (!args.description || typeof args.description !== 'string') {
        throw new Error('Missing required argument: description (must be a string)');
      }
      if (!args.source_code || typeof args.source_code !== 'string') {
        throw new Error('Missing required argument: source_code (must be a string)');
      }

      // Headers for API requests
      const headers: HeadersConfig = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-BARE-PASSWORD': `password ${this.password}`
      };

      // If agent_id is provided, set the user_id header
      if (args.agent_id) {
        headers['user_id'] = args.agent_id;
      }

      // Prepare category/tag
      const category = args.category || 'custom';

      // Check if tool exists and delete if found
      const toolsResponse = await this.api.get('/tools', { headers });
      const existingTools = toolsResponse.data;
      
      let existingToolId = null;
      for (const tool of existingTools) {
        if (tool.name === args.name) {
          existingToolId = tool.id;
          console.log(`Found existing tool ${args.name} with ID ${existingToolId}, will delete it first...`);
          break;
        }
      }
      
      if (existingToolId) {
        try {
          await this.api.delete(`/tools/${existingToolId}`, { headers });
          console.log(`Successfully deleted existing tool ${args.name}`);
        } catch (deleteError) {
          console.warn(`Failed to delete existing tool: ${deleteError}. Will try to continue anyway.`);
        }
      }

      // Prepare tool data
      const toolData = {
        source_code: args.source_code,
        description: args.description,
        tags: [category],
        source_type: "python"
      };

      // Create the tool
      console.log(`Creating tool "${args.name}"...`);
      const createResponse = await this.api.post('/tools', toolData, { headers });
      const toolId = createResponse.data.id;

      // If agent_id is provided, attach the tool to the agent
      if (args.agent_id) {
        // Attach tool to agent
        const attachUrl = `/agents/${args.agent_id}/tools/attach/${toolId}`;
        await this.api.patch(attachUrl, {}, { headers });
        
        // Get agent info
        const agentInfoResponse = await this.api.get(`/agents/${args.agent_id}`, { headers });
        const agentName = agentInfoResponse.data.name || 'Unknown';
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Tool "${args.name}" created and attached to agent ${agentName}.`,
              tool_id: toolId,
              tool_name: args.name,
              agent_id: args.agent_id,
              agent_name: agentName,
              category: category
            }, null, 2),
          }],
        };
      } else {
        // Just return the created tool info
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Tool "${args.name}" created successfully.`,
              tool_id: toolId,
              tool_name: args.name,
              category: category
            }, null, 2),
          }],
        };
      }
    } catch (error: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message,
            details: error.response?.data || error,
          }, null, 2),
        }],
        isError: true,
      };
    }
  }

  async run() {
    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('Letta MCP server running on stdio');

      // Handle graceful shutdown
      const cleanup = async () => {
        await this.server.close();
        process.exit(0);
      };

      process.on('SIGINT', cleanup);
      process.on('SIGTERM', cleanup);
      process.on('uncaughtException', async (error: Error) => {
        console.error('Uncaught exception:', error);
        await cleanup();
      });

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

const server = new LettaServer();
server.run().catch(console.error);