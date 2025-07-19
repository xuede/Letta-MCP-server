import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from '../core/logger.js';

/**
 * Run the server using stdio transport
 * @param {Object} server - The LettaServer instance
 */
export async function runStdio(server) {
    const logger = createLogger('stdio-transport');
    try {
        const transport = new StdioServerTransport();
        await server.server.connect(transport);
        logger.info('Letta MCP server running on stdio');

        const cleanup = async () => {
            await server.server.close();
            process.exit(0);
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);
        process.on('uncaughtException', async (error) => {
            logger.error('Uncaught exception:', error);
            await cleanup();
        });
    } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}
