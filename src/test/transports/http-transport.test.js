import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { runHTTP } from '../../transports/http-transport.js';
import { createMockLettaServer } from '../utils/mock-server.js';

describe('HTTP Transport Integration', () => {
    let mockServer;
    let app;
    let server;
    const TEST_PORT = 9544;
    
    beforeEach(async () => {
        mockServer = createMockLettaServer();
        
        // Mock the server's connect method to track connections
        mockServer.server.connect = vi.fn().mockResolvedValue();
        
        // Mock server handlers
        mockServer.server.setRequestHandler = vi.fn();
        
        // Start the HTTP transport
        const originalPort = process.env.PORT;
        process.env.PORT = TEST_PORT;
        
        // Create a promise to wait for server to start
        const serverStarted = new Promise((resolve) => {
            vi.spyOn(console, 'log').mockImplementation((msg) => {
                if (msg.includes(`MCP server running on http://localhost:${TEST_PORT}/mcp`)) {
                    resolve();
                }
            });
        });
        
        // Start server
        const httpServer = await runHTTP(mockServer);
        await serverStarted;
        
        // Store the server instance
        server = httpServer;
        
        // Restore original port
        process.env.PORT = originalPort;
        
        // Get the app instance for testing
        app = express();
    });
    
    afterEach(async () => {
        vi.restoreAllMocks();
        if (server) {
            await new Promise((resolve) => {
                server.close(() => resolve());
            });
            server = null;
        }
        // Give time for port to be released
        await new Promise(resolve => setTimeout(resolve, 100));
    });
    
    describe('Server Initialization', () => {
        it('should start server on specified port', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .get('/health')
                .expect(200);
            
            expect(response.body).toEqual({
                status: 'healthy',
                service: 'letta-mcp-server',
                timestamp: expect.any(String)
            });
        });
        
        it('should handle CORS headers correctly', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .options('/mcp')
                .set('Origin', 'http://localhost')
                .expect(204);
            
            expect(response.headers['access-control-allow-origin']).toBe('http://localhost');
            expect(response.headers['access-control-allow-credentials']).toBe('true');
        });
        
        it('should reject requests from unauthorized origins', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('Origin', 'http://evil.com')
                .send({ jsonrpc: '2.0', method: 'test', id: 1 })
                .expect(403);
            
            expect(response.body).toEqual({
                jsonrpc: '2.0',
                error: {
                    code: -32001,
                    message: 'Forbidden: Invalid origin'
                },
                id: null
            });
        });
    });
    
    describe('MCP Protocol Handling', () => {
        it('should handle initialize request and create session', async () => {
            const initRequest = {
                jsonrpc: '2.0',
                method: 'initialize',
                params: {
                    protocolVersion: '2025-06-18',
                    capabilities: {}
                },
                id: 1
            };
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send(initRequest)
                .expect(200);
            
            // Should receive session ID in response headers
            expect(response.headers['mcp-session-id']).toBeDefined();
            expect(response.headers['mcp-session-id']).toMatch(/^[0-9a-f-]{36}$/);
        });
        
        it('should reject requests without session ID after initialization', async () => {
            const toolsRequest = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 2
            };
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send(toolsRequest)
                .expect(400);
            
            expect(response.body.error.message).toContain('No valid session ID provided');
        });
        
        it('should handle requests with valid session ID', async () => {
            // First, initialize to get session ID
            const initRequest = {
                jsonrpc: '2.0',
                method: 'initialize',
                params: { protocolVersion: '2025-06-18' },
                id: 1
            };
            
            const initResponse = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send(initRequest);
            
            const sessionId = initResponse.headers['mcp-session-id'];
            
            // Then make a request with session ID
            const toolsRequest = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 2
            };
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('mcp-session-id', sessionId)
                .send(toolsRequest)
                .expect(200);
            
            expect(response.headers['content-type']).toContain('application/json');
        });
        
        it('should validate protocol version', async () => {
            const request = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 1
            };
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('mcp-protocol-version', '1.0.0')
                .set('mcp-session-id', 'test-session')
                .send(request)
                .expect(400);
            
            expect(response.body.error.message).toContain('Unsupported MCP protocol version');
        });
    });
    
    describe('Session Management', () => {
        it('should maintain separate sessions for different clients', async () => {
            // Client 1 initialization
            const init1 = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1
                });
            
            const session1 = init1.headers['mcp-session-id'];
            
            // Client 2 initialization
            const init2 = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1
                });
            
            const session2 = init2.headers['mcp-session-id'];
            
            // Sessions should be different
            expect(session1).not.toBe(session2);
            expect(session1).toBeDefined();
            expect(session2).toBeDefined();
        });
        
        it('should handle session termination', async () => {
            // Initialize session
            const initResponse = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1
                });
            
            const sessionId = initResponse.headers['mcp-session-id'];
            
            // Terminate session
            await request(`http://localhost:${TEST_PORT}`)
                .delete('/mcp')
                .set('mcp-session-id', sessionId)
                .expect(200);
            
            // Subsequent requests should fail
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('mcp-session-id', sessionId)
                .send({
                    jsonrpc: '2.0',
                    method: 'tools/list',
                    id: 2
                })
                .expect(400);
            
            expect(response.body.error.message).toContain('No valid session ID provided');
        });
    });
    
    describe('SSE Streaming', () => {
        it('should handle GET requests for SSE streaming', async () => {
            // Initialize session first
            const initResponse = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1
                });
            
            const sessionId = initResponse.headers['mcp-session-id'];
            
            // Request SSE stream
            const response = await request(`http://localhost:${TEST_PORT}`)
                .get('/mcp')
                .set('mcp-session-id', sessionId)
                .set('Accept', 'text/event-stream')
                .expect(200);
            
            expect(response.headers['content-type']).toContain('text/event-stream');
        });
        
        it('should reject SSE requests without session ID', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .get('/mcp')
                .set('Accept', 'text/event-stream')
                .expect(400);
            
            expect(response.text).toContain('Session ID required');
        });
    });
    
    describe('Error Handling', () => {
        it('should handle malformed JSON requests', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('Content-Type', 'application/json')
                .send('{"invalid json}')
                .expect(400);
            
            expect(response.body).toBeDefined();
        });
        
        it('should handle large requests within limits', async () => {
            const largeData = 'x'.repeat(1000000); // 1MB
            const request = {
                jsonrpc: '2.0',
                method: 'test',
                params: { data: largeData },
                id: 1
            };
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send(request)
                .expect(400); // Will fail due to no session, but shouldn't fail due to size
            
            expect(response.body.error.message).not.toContain('too large');
        });
        
        it('should handle transport errors gracefully', async () => {
            // Mock transport error
            const initRequest = {
                jsonrpc: '2.0',
                method: 'initialize',
                params: { protocolVersion: '2025-06-18' },
                id: 1
            };
            
            // Force an error by manipulating the mock
            mockServer.server.connect.mockRejectedValueOnce(new Error('Connection failed'));
            
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send(initRequest)
                .expect(500);
            
            expect(response.body.error.code).toBe(-32603);
            expect(response.body.error.message).toBe('Internal server error');
        });
    });
    
    describe('Recovery and Event Store', () => {
        it('should support event recovery with lastEventId', async () => {
            // Initialize session
            const initResponse = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1
                });
            
            const sessionId = initResponse.headers['mcp-session-id'];
            
            // Make several requests to build event history
            for (let i = 2; i <= 5; i++) {
                await request(`http://localhost:${TEST_PORT}`)
                    .post('/mcp')
                    .set('mcp-session-id', sessionId)
                    .send({
                        jsonrpc: '2.0',
                        method: 'tools/list',
                        id: i
                    });
            }
            
            // Simulate recovery request with lastEventId
            const recoveryResponse = await request(`http://localhost:${TEST_PORT}`)
                .get('/mcp')
                .set('mcp-session-id', sessionId)
                .set('mcp-last-event-id', 'test-event-id')
                .set('Accept', 'text/event-stream');
            
            expect(recoveryResponse.status).toBe(200);
        });
    });
    
    describe('Security Features', () => {
        it('should prevent DNS rebinding attacks', async () => {
            const response = await request(`http://localhost:${TEST_PORT}`)
                .post('/mcp')
                .set('Host', 'evil.com')
                .set('Origin', 'http://evil.com')
                .send({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    id: 1
                })
                .expect(403);
            
            expect(response.body.error.message).toContain('Forbidden');
        });
        
        it('should log requests with IP addresses', async () => {
            const logSpy = vi.spyOn(console, 'info');
            
            await request(`http://localhost:${TEST_PORT}`)
                .get('/health')
                .set('X-Forwarded-For', '192.168.1.100');
            
            expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('GET /health'));
        });
    });
});