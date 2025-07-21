import { createLogger } from '../core/logger.js';
import {
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const logger = createLogger('prompts');

// Registry to store available prompts
export const promptRegistry = new Map();

/**
 * Register prompt handlers with the MCP server
 * @param {LettaServer} server - The Letta server instance
 */
export function registerPromptHandlers(server) {
    logger.info('Registering prompt handlers');

    // Handler for prompts/list
    server.server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
        logger.info('Handling prompts/list request', { params: request.params });

        try {
            const prompts = Array.from(promptRegistry.values());
            const cursor = request.params?.cursor;
            const pageSize = 20;

            // Simple pagination
            let startIndex = 0;
            if (cursor) {
                startIndex = parseInt(cursor, 10) || 0;
            }

            const paginatedPrompts = prompts.slice(startIndex, startIndex + pageSize);
            const hasMore = startIndex + pageSize < prompts.length;

            return {
                prompts: paginatedPrompts.map((p) => ({
                    name: p.name,
                    title: p.title,
                    description: p.description,
                    arguments: p.arguments,
                })),
                ...(hasMore && { nextCursor: String(startIndex + pageSize) }),
            };
        } catch (error) {
            logger.error('Error listing prompts', { error: error.message });
            throw error;
        }
    });

    // Handler for prompts/get
    server.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        logger.info('Handling prompts/get request', { params: request.params });

        const { name, arguments: args } = request.params || {};

        if (!name) {
            throw new Error('Missing required parameter: name');
        }

        const prompt = promptRegistry.get(name);
        if (!prompt) {
            throw new Error(`Unknown prompt: ${name}`);
        }

        try {
            // Get the prompt messages
            const messages = await prompt.handler(args || {});

            return {
                description: prompt.description,
                messages,
            };
        } catch (error) {
            logger.error('Error getting prompt', { name, error: error.message });
            throw error;
        }
    });
}

/**
 * Register a new prompt template
 * @param {Object} prompt - Prompt definition
 * @param {string} prompt.name - Unique prompt identifier
 * @param {string} prompt.title - Human-readable title
 * @param {string} prompt.description - Prompt description
 * @param {Array} prompt.arguments - Prompt arguments schema
 * @param {Function} prompt.handler - Function that returns prompt messages
 */
export function registerPrompt(prompt) {
    if (!prompt.name || !prompt.handler) {
        throw new Error('Prompt must have name and handler');
    }

    logger.info('Registering prompt', { name: prompt.name });
    promptRegistry.set(prompt.name, prompt);
}

/**
 * Emit prompt list changed notification
 * @param {LettaServer} server - The Letta server instance
 */
export function notifyPromptsChanged(server) {
    if (server.server.sendNotification) {
        server.server.sendNotification({
            method: 'notifications/prompts/list_changed',
        });
    }
}
