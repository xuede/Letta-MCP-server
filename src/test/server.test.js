import { describe, it } from 'node:test';
import assert from 'node:assert';
import { LettaServer } from '../core/server.js';

describe('LettaServer', () => {
    it('should throw error when LETTA_BASE_URL is not set', () => {
        const originalUrl = process.env.LETTA_BASE_URL;
        delete process.env.LETTA_BASE_URL;

        assert.throws(() => {
            new LettaServer();
        }, /Missing required environment variable: LETTA_BASE_URL/);

        // Restore
        if (originalUrl) process.env.LETTA_BASE_URL = originalUrl;
    });

    it('should create server instance with valid config', () => {
        process.env.LETTA_BASE_URL = 'https://test.letta.com/v1';
        process.env.LETTA_PASSWORD = 'test-password';

        const server = new LettaServer();
        assert.ok(server);
        assert.ok(server.api);
    });

    it('should create error response with proper format', () => {
        process.env.LETTA_BASE_URL = 'https://test.letta.com/v1';
        process.env.LETTA_PASSWORD = 'test-password';

        const server = new LettaServer();
        const error = new Error('Test error');

        assert.throws(() => {
            server.createErrorResponse(error, 'Test context');
        });
    });
});
