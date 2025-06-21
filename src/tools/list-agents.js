/**
 * Tool handler for listing agents in the Letta system
 */
export async function handleListAgents(server, args) {
    try {
        // Headers for API requests
        const headers = server.getApiHeaders();

        // Get the list of agents
        const response = await server.api.get('/agents/', { headers });
        const agents = response.data;

        // Apply filter if provided
        let filteredAgents = agents;
        if (args?.filter) {
            const filter = args.filter.toLowerCase();
            filteredAgents = agents.filter(agent => 
                agent.name.toLowerCase().includes(filter) ||
                (agent.description && agent.description.toLowerCase().includes(filter))
            );
        }

        // Extract only essential details for the response
        const summarizedAgents = filteredAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            description: agent.description,
        }));

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    count: summarizedAgents.length,
                    agents: summarizedAgents // Use summarized list
                }, null, 2),
            }],
        };
    } catch (error) {
        console.error('Error in list_agents:', error.message);
        console.error('API Base URL:', server.apiBase);
        console.error('Full error:', error.response?.data || error);
        server.createErrorResponse(error);
    }
}

/**
 * Tool definition for list_agents
 */
export const listAgentsToolDefinition = {
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
};