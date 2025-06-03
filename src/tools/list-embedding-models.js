/**
 * Tool handler for listing available embedding models
 */
export async function handleListEmbeddingModels(server, args) {
    try {
        const headers = server.getApiHeaders();

        // Use the specific endpoint from the OpenAPI spec
        const response = await server.api.get(`/models/embedding`, { headers });
        const models = response.data; // Assuming response.data is an array of EmbeddingConfig objects

        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    model_count: models.length,
                    models: models
                }, null, 2),
            }],
        };
    } catch (error) {
        server.createErrorResponse(error);
    }
}

/**
 * Tool definition for list_embedding_models
 */
export const listEmbeddingModelsDefinition = {
    name: 'list_embedding_models',
    description: 'List available embedding models configured on the Letta server',
    inputSchema: {
        type: 'object',
        properties: {}, // No input arguments needed
        required: [],
    },
};