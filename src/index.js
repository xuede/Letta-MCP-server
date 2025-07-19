#!/usr/bin/env node
import dotenv from 'dotenv';
import { LettaServer } from './core/server.js';
import { registerToolHandlers } from './tools/index.js';
import { runStdio, runSSE, runHTTP } from './transports/index.js';
import { createLogger } from './core/logger.js';

// Load environment variables
dotenv.config();

// Create logger for main module
const logger = createLogger('Main');

/**
 * Initialize and run the Letta MCP server
 */
async function main() {
    try {
        // Create server instance
        const server = new LettaServer();

        // Register all tool handlers
        registerToolHandlers(server);

        // Determine transport mode from command line arguments
        const useSSE = process.argv.includes('--sse');
        const useHTTP = process.argv.includes('--http');

        // Run server with appropriate transport
        if (useHTTP) {
            logger.info('Starting Letta server with HTTP transport');
            await runHTTP(server);
        } else if (useSSE) {
            logger.info('Starting Letta server with SSE transport');
            await runSSE(server);
        } else {
            logger.info('Starting Letta server with stdio transport');
            await runStdio(server);
        }
    } catch (error) {
        logger.error('Failed to start Letta server:', error);
        process.exit(1);
    }
}

// Run the server
main().catch((error) => {
    logger.error('Uncaught error in main:', error);
    process.exit(1);
});
