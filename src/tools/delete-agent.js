/**
 * Tool handler for deleting a specific agent
 */
export async function handleDeleteAgent(server, args) {
    if (!args?.agent_id) {
        server.createErrorResponse("Missing required argument: agent_id");
    }

    try {
        const headers = server.getApiHeaders();
        const agentId = encodeURIComponent(args.agent_id);

        // Use the specific endpoint from the OpenAPI spec
        // Note: axios delete method typically doesn't have a body, config is the second arg
        await server.api.delete(`/agents/${agentId}`, { headers });

        // Successful deletion usually returns 200 or 204 with no body
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Agent ${args.agent_id} deleted successfully.`
                }, null, 2),
            }],
        };
    } catch (error) {
        // Handle potential 404 if agent not found, or other API errors
        if (error.response && error.response.status === 404) {
             server.createErrorResponse(`Agent not found: ${args.agent_id}`);
        }
        server.createErrorResponse(error);
    }
}

/**
 * Tool definition for delete_agent
 */
export const deleteAgentDefinition = {
    name: 'delete_agent',
    description: 'Delete a specific agent by ID',
    inputSchema: {
        type: 'object',
        properties: {
            agent_id: {
                type: 'string',
                description: 'The ID of the agent to delete',
            },
        },
        required: ['agent_id'],
    },
};