/**
 * Enhanced tool descriptions with detailed examples and best practices
 */

export const enhancedDescriptions = {
    // Agent Management Tools
    create_agent: {
        description: 'Create a new Letta agent with specified configuration. After creation, use attach_tool to add capabilities, attach_memory_block to configure memory, or prompt_agent to start conversations.',
        longDescription: `Creates a new Letta agent with customizable LLM and embedding models. 
        
Best practices:
- Always set up core memory blocks (persona, human) after creation
- Attach relevant tools based on the agent's purpose
- Test the agent with a simple prompt to verify functionality

Common workflows:
1. Create agent → Set up memory → Attach tools → Test
2. Use letta_agent_wizard prompt for guided creation`,
        examples: [
            {
                scenario: 'Create a research assistant',
                params: {
                    name: 'research-assistant',
                    description: 'An agent specialized in research and information gathering',
                    model: 'openai/gpt-4',
                },
            },
            {
                scenario: 'Create a code helper with specific model',
                params: {
                    name: 'code-helper',
                    description: 'Assists with programming tasks and code review',
                    model: 'anthropic/claude-3-opus',
                    embedding: 'openai/text-embedding-3-large',
                },
            },
        ],
    },

    prompt_agent: {
        description: 'Send a message to an agent and get a response. Ensure the agent has necessary tools attached (see attach_tool) first. Use list_agents to find agent IDs.',
        longDescription: `Sends a message to a Letta agent and retrieves its response. The agent will use its attached tools and memory to provide contextual responses.

Prerequisites:
- Agent must exist and be properly configured
- Memory blocks should be attached for context
- Relevant tools should be attached for functionality

Response includes:
- Agent's message content
- Tool usage information
- Memory updates if applicable`,
        examples: [
            {
                scenario: 'Simple conversation',
                params: {
                    agent_id: 'agent-123',
                    message: 'Hello, can you help me understand your capabilities?',
                },
            },
            {
                scenario: 'Task-oriented prompt',
                params: {
                    agent_id: 'research-agent-456',
                    message: 'Please research the latest developments in quantum computing and summarize the key findings.',
                },
            },
        ],
    },

    attach_tool: {
        description: 'Attach one or more tools (by ID or name) to an agent. If a name corresponds to an MCP tool not yet in Letta, it will be registered first. Find tools with list_mcp_tools_by_server or create custom ones with upload_tool. Use list_agent_tools to verify attachment.',
        longDescription: `Attaches tools to an agent, expanding its capabilities. Supports both existing Letta tools and MCP tools that can be auto-registered.

Tool attachment strategies:
- Use tool_ids for known Letta tools
- Use tool_names for MCP tools (auto-registers if needed)
- Batch attach multiple tools for efficiency

After attachment:
- Verify with list_agent_tools
- Test tool functionality with prompt_agent
- Monitor performance impact`,
        examples: [
            {
                scenario: 'Attach multiple tools by ID',
                params: {
                    agent_id: 'agent-123',
                    tool_ids: ['tool-456', 'tool-789'],
                },
            },
            {
                scenario: 'Attach MCP tools by name',
                params: {
                    agent_id: 'agent-123',
                    tool_names: ['web_search', 'file_reader', 'calculator'],
                },
            },
        ],
    },

    // Memory Management Tools
    create_memory_block: {
        description: 'Create a new memory block in the Letta system. Common labels: "persona", "human", "system". Use attach_memory_block to link to agents, or update_memory_block to modify later.',
        longDescription: `Creates a memory block that can be attached to agents for persistent context.

Memory block types:
- persona: Agent's identity and behavior
- human: Information about the user
- system: System-level instructions
- custom: Domain-specific memory

Best practices:
- Keep persona concise and focused
- Update human block with user preferences
- Use system blocks for operational guidelines`,
        examples: [
            {
                scenario: 'Create persona memory',
                params: {
                    name: 'research_assistant_persona',
                    label: 'persona',
                    value: 'You are a meticulous research assistant who values accuracy and comprehensive analysis. You cite sources and acknowledge uncertainty.',
                },
            },
            {
                scenario: 'Create user context memory',
                params: {
                    name: 'user_preferences',
                    label: 'human',
                    value: 'The user prefers technical explanations and appreciates detailed breakdowns of complex topics.',
                    agent_id: 'agent-123',
                },
            },
        ],
    },

    list_passages: {
        description: 'Retrieve the memories in an agent\'s archival memory store (paginated query). Use create_passage to add new memories, modify_passage to edit, or delete_passage to remove them.',
        longDescription: `Retrieves archival memories (passages) for an agent with pagination and search capabilities.

Use cases:
- Audit agent's knowledge base
- Search for specific information
- Manage memory capacity
- Export agent knowledge

Search tips:
- Use keywords for targeted results
- Combine with pagination for large datasets
- Sort by date for recent memories`,
        examples: [
            {
                scenario: 'Get all passages',
                params: {
                    agent_id: 'agent-123',
                    limit: 50,
                },
            },
            {
                scenario: 'Search specific topic',
                params: {
                    agent_id: 'agent-123',
                    search: 'machine learning algorithms',
                    limit: 20,
                },
            },
        ],
    },

    // Tool Management
    list_mcp_tools_by_server: {
        description: 'List all available tools for a specific MCP server. Use list_mcp_servers first to see available servers, then add_mcp_tool_to_letta to import tools into Letta.',
        longDescription: `Discovers available tools from a connected MCP server for potential integration with Letta agents.

Workflow:
1. List MCP servers to find available sources
2. List tools from desired server
3. Review tool capabilities and requirements
4. Import selected tools with add_mcp_tool_to_letta
5. Attach to agents as needed

Filter options help find specific tool types or capabilities.`,
        examples: [
            {
                scenario: 'List all tools from a server',
                params: {
                    mcp_server_name: 'web-tools-server',
                },
            },
            {
                scenario: 'Search for specific tools',
                params: {
                    mcp_server_name: 'utility-server',
                    filter: 'calculator',
                    pageSize: 20,
                },
            },
        ],
    },

    // Bulk Operations
    bulk_attach_tool_to_agents: {
        description: 'Attaches a specified tool to multiple agents based on filter criteria (name or tags). Use list_agents to find agents and list_mcp_tools_by_server or upload_tool to get tool IDs.',
        longDescription: `Efficiently attaches a tool to multiple agents matching specified criteria.

Use cases:
- Deploy new capability across agent fleet
- Standardize tool sets for agent types
- Update agents after tool improvements

Filtering options:
- By name pattern (substring match)
- By tags (exact or partial match)
- Combine filters for precision`,
        examples: [
            {
                scenario: 'Attach to all research agents',
                params: {
                    tool_id: 'web-search-tool-123',
                    agent_name_filter: 'research',
                },
            },
            {
                scenario: 'Attach to tagged agents',
                params: {
                    tool_id: 'calculator-tool-456',
                    agent_tag_filter: 'mathematical,scientific',
                },
            },
        ],
    },

    // Import/Export
    export_agent: {
        description: 'Export an agent\'s configuration to a JSON file and optionally upload it. Use import_agent to recreate the agent later, or clone_agent for a quick copy. Use list_agents to find agent IDs.',
        longDescription: `Exports complete agent configuration including tools, memory, and settings for backup or migration.

Export includes:
- Agent metadata and configuration
- Attached tools and their settings
- Memory blocks and content
- Custom configurations

Options:
- Save locally or upload to cloud
- Base64 encoding for API transport
- Automatic file naming`,
        examples: [
            {
                scenario: 'Export for backup',
                params: {
                    agent_id: 'agent-123',
                    output_path: 'backups/agent-123-backup.json',
                },
            },
            {
                scenario: 'Export and upload',
                params: {
                    agent_id: 'agent-123',
                    upload_to_xbackbone: true,
                    return_base64: true,
                },
            },
        ],
    },

    // Debugging
    get_agent_summary: {
        description: 'Provides a concise summary of an agent\'s configuration, including core memory snippets and attached tool/source names. Use list_agents to find agent IDs. Follow up with modify_agent to change settings or attach_tool to add capabilities.',
        longDescription: `Retrieves a comprehensive summary of an agent's current state for quick assessment.

Summary includes:
- Basic configuration (name, model, etc.)
- Memory block excerpts
- Tool inventory with names
- Recent activity indicators
- Performance metrics

Use for:
- Quick status checks
- Debugging conversations
- Pre-modification review
- Documentation`,
        examples: [
            {
                scenario: 'Get full agent overview',
                params: {
                    agent_id: 'agent-123',
                },
            },
        ],
    },
};

/**
 * Get enhanced description for a tool
 * @param {string} toolName - Name of the tool
 * @returns {Object} Enhanced description object
 */
export function getEnhancedDescription(toolName) {
    return enhancedDescriptions[toolName] || {
        description: `Tool ${toolName} - No enhanced description available`,
        longDescription: 'Please refer to the basic tool description.',
        examples: [],
    };
}

/**
 * Generate markdown documentation for a tool
 * @param {string} toolName - Name of the tool
 * @returns {string} Markdown formatted documentation
 */
export function generateToolDocumentation(toolName) {
    const enhanced = getEnhancedDescription(toolName);

    let doc = `# ${toolName}\n\n`;
    doc += `${enhanced.description}\n\n`;

    if (enhanced.longDescription) {
        doc += `## Detailed Description\n\n${enhanced.longDescription}\n\n`;
    }

    if (enhanced.examples && enhanced.examples.length > 0) {
        doc += `## Examples\n\n`;
        enhanced.examples.forEach((example, index) => {
            doc += `### Example ${index + 1}: ${example.scenario}\n\n`;
            doc += '```json\n';
            doc += JSON.stringify(example.params, null, 2);
            doc += '\n```\n\n';
        });
    }

    return doc;
}