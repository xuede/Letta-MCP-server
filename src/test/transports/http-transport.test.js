import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

describe('HTTP Transport Integration', () => {
    let server;
    let port;

    beforeEach(async () => {
        // Set random port
        process.env.PORT = '0';
        process.env.LETTA_BASE_URL = 'http://test.com/v1';
        process.env.LETTA_PASSWORD = 'test-password';

        // Clear module cache to ensure fresh imports
        vi.resetModules();

        // Mock logger to avoid console output
        vi.doMock('../../../src/core/logger.js', () => ({
            createLogger: () => ({
                info: vi.fn(),
                error: vi.fn(),
                warn: vi.fn(),
                debug: vi.fn(),
            }),
        }));
    });

    afterEach(async () => {
        // Clean up server
        if (server && server.close) {
            await new Promise((resolve) => {
                server.close(() => resolve());
            });
        }

        // Clear all mocks
        vi.clearAllMocks();
        vi.resetModules();

        // Reset environment
        delete process.env.PORT;
        delete process.env.LETTA_BASE_URL;
        delete process.env.LETTA_PASSWORD;
    });

    describe('Server Initialization', () => {
        it('should start HTTP server and respond to health checks', async () => {
            // Import after mocks are set up
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            // Create real server instance
            const lettaServer = new LettaServer();

            // Start HTTP server
            server = await runHTTP(lettaServer);
            expect(server).toBeDefined();

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            expect(server.listening).toBe(true);

            // Get dynamic port
            port = server.address().port;
            expect(port).toBeGreaterThan(0);

            // Test health endpoint
            const response = await request(`http://localhost:${port}`).get('/health').expect(200);

            expect(response.body).toMatchObject({
                status: 'healthy',
                service: 'letta-mcp-server',
                transport: 'streamable_http',
                protocol_version: '2025-06-18',
            });
        });

        it('should handle CORS preflight requests', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`)
                .options('/mcp')
                .set('Origin', 'http://localhost')
                .expect(204);

            expect(response.headers['access-control-allow-origin']).toBe('http://localhost');
            expect(response.headers['access-control-allow-methods']).toContain('POST');
        });

        it('should reject requests from unauthorized origins', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`)
                .post('/mcp')
                .set('Origin', 'http://evil.com')
                .send({ jsonrpc: '2.0', method: 'test', id: 1 })
                .expect(403);

            expect(response.body.error.message).toBe('Forbidden: Invalid origin');
        });
    });

    describe('Basic Endpoint Tests', () => {
        it('should reject non-initialization requests without session', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`)
                .post('/mcp')
                .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
                .expect(400);

            expect(response.body.error.message).toContain('No valid session ID provided');
        });

        it('should handle malformed JSON gracefully', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`)
                .post('/mcp')
                .set('Content-Type', 'application/json')
                .send('{"invalid json}')
                .expect(400);

            // The response might be plain text for parse errors
            if (response.body && response.body.error) {
                expect(response.body.error).toBeDefined();
            } else {
                expect(response.text).toContain('Error');
            }
        });

        it('should support DELETE endpoint for session termination', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            // Try to delete without session ID
            const response = await request(`http://localhost:${port}`).delete('/mcp').expect(400);

            expect(response.body.error.message).toContain('No session ID provided');
        });

        it('should return 404 for unknown session deletion', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`)
                .delete('/mcp')
                .set('mcp-session-id', 'unknown-session-id')
                .expect(404);

            expect(response.body.error.message).toBe('Session not found');
        });

        it('should require session for GET /mcp endpoint', async () => {
            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            port = server.address().port;

            const response = await request(`http://localhost:${port}`).get('/mcp').expect(400);

            expect(response.text).toBe('Session ID required');
        });
    });

    describe('Environment Configuration', () => {
        it('should use PORT environment variable', async () => {
            process.env.PORT = '0'; // Let OS assign

            const { runHTTP } = await import('../../transports/http-transport.js');
            const { LettaServer } = await import('../../core/server.js');

            const lettaServer = new LettaServer();
            server = await runHTTP(lettaServer);

            // Wait for server to be listening
            if (!server.listening) {
                await new Promise((resolve) => {
                    server.once('listening', resolve);
                });
            }
            expect(server.listening).toBe(true);
            const actualPort = server.address().port;
            expect(actualPort).toBeGreaterThan(0);
        });
    });
});
