/**
 * Test fixtures for common data structures
 */

export const fixtures = {
    // Agent fixtures
    agent: {
        basic: {
            id: 'agent-123',
            name: 'Test Agent',
            description: 'A test agent',
            created_at: '2024-01-01T00:00:00Z',
            last_modified: '2024-01-01T00:00:00Z',
            tool_ids: ['tool-1', 'tool-2'],
            tool_names: ['test_tool_1', 'test_tool_2'],
            tags: ['test', 'demo'],
            system: 'You are a helpful assistant',
            agent_type: 'letta_agent',
            memory_blocks: [
                {
                    label: 'human',
                    value: 'User is a developer',
                    limit: 2000,
                    is_template: false,
                },
                {
                    label: 'persona',
                    value: 'I am a helpful AI assistant',
                    limit: 2000,
                    is_template: false,
                },
            ],
            llm_config: {
                model: 'gpt-4',
                temperature: 0.7,
            },
            embedding_config: {
                model: 'text-embedding-ada-002',
            },
        },
        minimal: {
            id: 'agent-456',
            name: 'Minimal Agent',
            description: undefined,
            created_at: '2024-01-01T00:00:00Z',
        },
    },

    // Tool fixtures
    tool: {
        basic: {
            id: 'tool-123',
            name: 'test_tool',
            description: 'A test tool',
            json_schema: {
                type: 'object',
                properties: {
                    input: { type: 'string' },
                },
                required: ['input'],
            },
        },
        mcpTool: {
            name: 'mcp_test_tool',
            description: 'An MCP test tool',
            inputSchema: {
                type: 'object',
                properties: {
                    query: { type: 'string' },
                },
            },
        },
    },

    // Memory fixtures
    memory: {
        block: {
            id: 'block-123',
            label: 'test_memory',
            value: 'Test memory content',
            limit: 1000,
            is_template: false,
            created_at: '2024-01-01T00:00:00Z',
        },
        blocks: [
            {
                id: 'block-1',
                label: 'human',
                value: 'Human memory',
                limit: 2000,
            },
            {
                id: 'block-2',
                label: 'persona',
                value: 'Persona memory',
                limit: 2000,
            },
        ],
    },

    // Passage fixtures
    passage: {
        basic: {
            id: 'passage-123',
            text: 'This is a test passage',
            embedding: [0.1, 0.2, 0.3],
            metadata: {
                source: 'test',
            },
            created_at: '2024-01-01T00:00:00Z',
        },
        withoutEmbedding: {
            id: 'passage-456',
            text: 'Another test passage',
            metadata: {
                source: 'test2',
            },
        },
    },

    // Model fixtures
    models: {
        llm: [
            {
                name: 'gpt-4',
                provider: 'openai',
                context_window: 8192,
            },
            {
                name: 'claude-3',
                provider: 'anthropic',
                context_window: 100000,
            },
        ],
        embedding: [
            {
                name: 'text-embedding-ada-002',
                provider: 'openai',
                dimension: 1536,
            },
        ],
    },

    // MCP Server fixtures
    mcpServers: {
        'test-mcp-server': {
            host: 'localhost',
            port: 3000,
            transport: 'http',
        },
        'another-mcp-server': {
            host: 'localhost',
            port: 3001,
            transport: 'sse',
        },
    },

    // Error responses
    errors: {
        notFound: {
            response: {
                status: 404,
                data: { error: 'Not found' },
            },
        },
        unauthorized: {
            response: {
                status: 401,
                data: { error: 'Unauthorized' },
            },
        },
        serverError: {
            response: {
                status: 500,
                data: { error: 'Internal server error' },
            },
        },
    },
};
