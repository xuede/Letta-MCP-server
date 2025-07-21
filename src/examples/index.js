import { registerExamplePrompts } from './prompts.js';
import { registerExampleResources } from './resources.js';
import { createLogger } from '../core/logger.js';

const logger = createLogger('examples');

/**
 * Initialize all example prompts and resources
 * @param {LettaServer} server - The Letta server instance
 */
export function initializeExamples(server) {
    logger.info('Initializing example prompts and resources');

    try {
        // Register example prompts
        registerExamplePrompts();
        logger.info('Example prompts registered successfully');

        // Register example resources
        registerExampleResources(server);
        logger.info('Example resources registered successfully');
    } catch (error) {
        logger.error('Failed to initialize examples', { error: error.message });
        throw error;
    }
}
