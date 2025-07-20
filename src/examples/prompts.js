import { registerPrompt } from '../handlers/prompts.js';

/**
 * Register example prompts for Letta agent workflows
 */
export function registerExamplePrompts() {
    // Agent Creation Wizard
    registerPrompt({
        name: 'letta_agent_wizard',
        title: 'Letta Agent Creation Wizard',
        description: 'Interactive wizard to help create a properly configured Letta agent with memory and tools',
        arguments: [
            {
                name: 'purpose',
                title: 'Agent Purpose',
                description: 'What is the primary purpose of this agent?',
                required: true,
            },
            {
                name: 'personality',
                title: 'Agent Personality',
                description: 'Describe the personality traits for this agent',
                required: false,
            },
            {
                name: 'tools',
                title: 'Required Tools',
                description: 'List of tool categories needed (e.g., web, file, memory)',
                required: false,
            },
        ],
        handler: async (args) => {
            const purpose = args.purpose || 'general assistant';
            const personality = args.personality || 'helpful and professional';
            const tools = args.tools || 'basic';

            return [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `I want to create a new Letta agent with the following specifications:
                        
Purpose: ${purpose}
Personality: ${personality}
Required tools: ${tools}

Please help me:
1. Create the agent with an appropriate name and description
2. Set up the core memory (persona and human blocks)
3. Attach relevant tools based on the requirements
4. Configure any necessary settings
5. Provide a test prompt to verify the agent is working

Make sure the agent is properly configured for its intended purpose.`,
                    },
                },
            ];
        },
    });

    // Memory Optimization Prompt
    registerPrompt({
        name: 'letta_memory_optimizer',
        title: 'Letta Memory Optimization',
        description: 'Analyze and optimize agent memory usage',
        arguments: [
            {
                name: 'agent_id',
                title: 'Agent ID',
                description: 'ID of the agent to optimize',
                required: true,
            },
            {
                name: 'focus',
                title: 'Optimization Focus',
                description: 'What aspect to focus on (e.g., archival, core, passages)',
                required: false,
            },
        ],
        handler: async (args) => {
            const agentId = args.agent_id;
            const focus = args.focus || 'all';

            return [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Please analyze and optimize the memory configuration for agent ${agentId}.

Focus area: ${focus}

Tasks to perform:
1. Review current memory blocks and their content
2. Analyze archival memory usage and passages
3. Identify any redundant or outdated information
4. Suggest optimizations for better performance
5. Implement approved changes

Provide a summary of:
- Current memory usage statistics
- Identified issues or inefficiencies
- Recommended optimizations
- Actions taken`,
                    },
                },
            ];
        },
    });

    // Debug Assistant Prompt
    registerPrompt({
        name: 'letta_debug_assistant',
        title: 'Letta Debug Assistant',
        description: 'Help debug issues with Letta agents',
        arguments: [
            {
                name: 'agent_id',
                title: 'Agent ID',
                description: 'ID of the agent having issues',
                required: true,
            },
            {
                name: 'issue',
                title: 'Issue Description',
                description: 'Describe the problem you are experiencing',
                required: true,
            },
            {
                name: 'recent_messages',
                title: 'Include Recent Messages',
                description: 'Include recent message history (true/false)',
                required: false,
            },
        ],
        handler: async (args) => {
            const agentId = args.agent_id;
            const issue = args.issue;
            const includeMessages = args.recent_messages === 'true';

            return [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Help me debug an issue with Letta agent ${agentId}.

Issue description: ${issue}

Please perform the following diagnostic steps:
1. Check agent configuration and status
2. Verify all attached tools are functioning
3. Review memory blocks for any corruption or issues
4. ${includeMessages ? 'Analyze recent message history for errors' : 'Check for any error patterns'}
5. Test agent responsiveness with a simple prompt

Provide:
- Root cause analysis
- Specific error messages or warnings found
- Recommended fixes
- Steps to prevent similar issues in the future`,
                    },
                },
            ];
        },
    });

    // Tool Configuration Assistant
    registerPrompt({
        name: 'letta_tool_config',
        title: 'Letta Tool Configuration Assistant',
        description: 'Help configure and manage tools for Letta agents',
        arguments: [
            {
                name: 'action',
                title: 'Action',
                description: 'What to do: discover, attach, create, or audit',
                required: true,
            },
            {
                name: 'agent_id',
                title: 'Agent ID',
                description: 'Target agent ID (if applicable)',
                required: false,
            },
            {
                name: 'tool_type',
                title: 'Tool Type',
                description: 'Type of tools to work with',
                required: false,
            },
        ],
        handler: async (args) => {
            const action = args.action;
            const agentId = args.agent_id || 'not specified';
            const toolType = args.tool_type || 'all';

            const actionPrompts = {
                discover: `Discover available tools of type "${toolType}" that could be useful. List MCP servers and their tools, categorize them, and recommend the most relevant ones.`,
                attach: `Help me attach appropriate tools to agent ${agentId}. Analyze the agent's purpose and current tools, then recommend and attach additional tools that would enhance its capabilities.`,
                create: `Guide me through creating a custom tool for ${toolType} functionality. Provide a template, help with the implementation, and register it in the system.`,
                audit: `Audit the tools attached to agent ${agentId}. Check for redundancies, missing tools, and optimization opportunities. Provide a detailed report.`,
            };

            return [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: actionPrompts[action] || `Help me ${action} tools for Letta agents.`,
                    },
                },
            ];
        },
    });

    // Migration Assistant
    registerPrompt({
        name: 'letta_migration',
        title: 'Letta Agent Migration Assistant',
        description: 'Help migrate agents between environments or versions',
        arguments: [
            {
                name: 'migration_type',
                title: 'Migration Type',
                description: 'Type of migration: export, import, upgrade, or clone',
                required: true,
            },
            {
                name: 'source',
                title: 'Source',
                description: 'Source agent ID or file path',
                required: true,
            },
            {
                name: 'destination',
                title: 'Destination',
                description: 'Destination environment or new name',
                required: false,
            },
        ],
        handler: async (args) => {
            const migrationType = args.migration_type;
            const source = args.source;
            const destination = args.destination || 'default';

            const migrationPrompts = {
                export: `Export agent ${source} to a portable format. Include all configurations, memory, tools, and passages. Save to ${destination} or provide download link.`,
                import: `Import agent from ${source}. Validate the configuration, check for conflicts, and create the agent in the current environment. Handle any compatibility issues.`,
                upgrade: `Upgrade agent ${source} to the latest format. Backup current state, migrate configurations, and ensure all tools are compatible.`,
                clone: `Clone agent ${source} to create ${destination}. Copy all settings but create independent memory spaces. Adjust configuration as needed.`,
            };

            return [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: migrationPrompts[migrationType] || `Help me with ${migrationType} migration for Letta agents.`,
                    },
                },
            ];
        },
    });
}