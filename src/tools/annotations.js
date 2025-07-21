/**
 * Tool annotations providing hints about tool behavior and requirements
 */

export const toolAnnotations = {
    // Agent Management - These modify system state
    create_agent: {
        title: 'Create New Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'fast',
        sideEffects: 'Creates persistent agent in system',
    },

    modify_agent: {
        title: 'Modify Agent Configuration',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Modifies existing agent configuration',
    },

    delete_agent: {
        title: 'Delete Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Permanently removes agent and associated data',
        dangerous: true,
    },

    // Read-only operations
    list_agents: {
        title: 'List All Agents',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    retrieve_agent: {
        title: 'Get Agent Details',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    get_agent_summary: {
        title: 'Get Agent Summary',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    // Agent interaction - may have costs
    prompt_agent: {
        title: 'Send Message to Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'high',
        executionTime: 'variable',
        sideEffects: 'May update agent memory and incur API costs',
        rateLimit: '100/hour',
    },

    // Memory operations
    create_memory_block: {
        title: 'Create Memory Block',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Creates persistent memory block',
    },

    list_memory_blocks: {
        title: 'List Memory Blocks',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    read_memory_block: {
        title: 'Read Memory Block',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    update_memory_block: {
        title: 'Update Memory Block',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Modifies memory content',
    },

    attach_memory_block: {
        title: 'Attach Memory to Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Links memory block to agent',
    },

    // Passage operations
    create_passage: {
        title: 'Create Archival Memory',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'fast',
        sideEffects: 'Creates searchable memory with embeddings',
    },

    list_passages: {
        title: 'Search Archival Memory',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    modify_passage: {
        title: 'Update Archival Memory',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'fast',
        sideEffects: 'Re-embeds modified content',
    },

    delete_passage: {
        title: 'Delete Archival Memory',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Permanently removes memory',
    },

    // Tool management
    attach_tool: {
        title: 'Attach Tools to Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Modifies agent capabilities',
    },

    list_agent_tools: {
        title: 'List Agent Tools',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    upload_tool: {
        title: 'Upload Custom Tool',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Adds new tool to system',
        securityNote: 'Executes user-provided code',
    },

    // MCP operations
    list_mcp_servers: {
        title: 'List MCP Servers',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    list_mcp_tools_by_server: {
        title: 'List Server Tools',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    add_mcp_tool_to_letta: {
        title: 'Import MCP Tool',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
        sideEffects: 'Registers external tool in system',
    },

    // Model operations
    list_llm_models: {
        title: 'List LLM Models',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    list_embedding_models: {
        title: 'List Embedding Models',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'fast',
    },

    // Import/Export operations
    export_agent: {
        title: 'Export Agent Configuration',
        readOnly: true,
        requiresAuth: true,
        costLevel: 'low',
        executionTime: 'medium',
        dataSize: 'potentially large',
    },

    import_agent: {
        title: 'Import Agent Configuration',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'medium',
        sideEffects: 'Creates new agent with tools and memory',
    },

    clone_agent: {
        title: 'Clone Existing Agent',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'medium',
        sideEffects: 'Creates duplicate agent',
    },

    // Bulk operations - potentially expensive
    bulk_attach_tool_to_agents: {
        title: 'Bulk Attach Tool',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'slow',
        sideEffects: 'Modifies multiple agents',
        bulkOperation: true,
    },

    bulk_delete_agents: {
        title: 'Bulk Delete Agents',
        readOnly: false,
        requiresAuth: true,
        costLevel: 'medium',
        executionTime: 'slow',
        sideEffects: 'Permanently removes multiple agents',
        dangerous: true,
        bulkOperation: true,
    },
};

/**
 * Get annotations for a tool
 * @param {string} toolName - Name of the tool
 * @returns {Object} Annotations object formatted for MCP
 */
export function getToolAnnotations(toolName) {
    const annotations = toolAnnotations[toolName];
    if (!annotations) {
        return undefined;
    }

    // Convert to MCP format
    const mcpAnnotations = {
        title: annotations.title,
    };

    // Add readOnly flag if true (default is false)
    if (annotations.readOnly === true) {
        mcpAnnotations.readOnly = true;
    }

    // Add custom annotations as extensions
    const customFields = [
        'requiresAuth',
        'costLevel',
        'executionTime',
        'sideEffects',
        'dangerous',
        'rateLimit',
        'securityNote',
        'dataSize',
        'bulkOperation',
    ];

    customFields.forEach((field) => {
        if (annotations[field] !== undefined) {
            mcpAnnotations[`x-${field}`] = annotations[field];
        }
    });

    return mcpAnnotations;
}
