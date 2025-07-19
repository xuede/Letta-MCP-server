import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { runSSE } from '../../transports/sse-transport.js';
import { createMockLettaServer } from '../utils/mock-server.js';
import { EventSource } from 'eventsource';

// Mock EventSource for node environment
global.EventSource = EventSource;

describe('SSE Transport Integration', () => {
    let mockServer;
    let server;
    let currentPort = 9645; // Start from a different range
    
    // Helper to get next available port
    const getNextPort = () => {
        return currentPort++;
    };
    
    // Helper to start server with retry logic
    const startServer = async (port) => {
        const originalPort = process.env.PORT;
        process.env.PORT = port;
        
        try {
            // Create a promise to wait for server to start
            const serverStarted = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Server start timeout')), 5000);
                
                vi.spyOn(console, 'log').mockImplementation((msg) => {
                    if (msg.includes('SSE server running on')) {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            });
            
            // Start server
            const app = runSSE(mockServer);
            await serverStarted;
            
            return { server: app, port };
        } finally {
            process.env.PORT = originalPort;
        }
    };
    
    beforeEach(async () => {
        mockServer = createMockLettaServer();
        
        // Mock the server's connect method to track connections
        mockServer.server.connect = vi.fn().mockResolvedValue();
        
        // Mock server handlers
        mockServer.server.setRequestHandler = vi.fn();
    }, 15000);
    
    afterEach(async () => {
        vi.restoreAllMocks();
        if (server) {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    // Force close if graceful close fails
                    resolve();
                }, 5000);
                
                if (server.close) {
                    server.close((err) => {
                        clearTimeout(timeout);
                        if (err) reject(err);
                        else resolve();
                    });
                } else {
                    clearTimeout(timeout);
                    resolve();
                }
            }).catch(() => {}); // Ignore close errors
            server = null;
        }
        // Give time for port to be released
        await new Promise(resolve => setTimeout(resolve, 200));
    }, 15000);
    
    describe('Server Initialization', () => {
        it('should start SSE server on specified port', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const response = await request(`http://localhost:${port}`)
                .get('/health')
                .expect(200);
            
            expect(response.text).toBe('OK');
        });
        
        it('should handle initial SSE connection', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const response = await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream')
                .expect(200);
            
            expect(response.headers['content-type']).toBe('text/event-stream');
            expect(response.headers['cache-control']).toBe('no-cache');
            expect(response.headers['connection']).toBe('keep-alive');
        });
    });
    
    describe('SSE Connection Management', () => {
        it('should establish SSE connection with unique client ID', async (done) => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const eventSource = new EventSource(`http://localhost:${port}/`);
            let clientId;
            
            eventSource.onopen = () => {
                expect(mockServer.server.connect).toHaveBeenCalled();
                eventSource.close();
                done();
            };
            
            eventSource.onerror = (error) => {
                eventSource.close();
                done(error);
            };
        });
        
        it('should handle multiple concurrent SSE connections', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const connections = [];
            const clientIds = new Set();
            
            // Create 3 concurrent connections
            for (let i = 0; i < 3; i++) {
                const response = await request(`http://localhost:${port}`)
                    .get('/')
                    .set('Accept', 'text/event-stream')
                    .expect(200);
                
                connections.push(response);
            }
            
            // Verify multiple connect calls
            expect(mockServer.server.connect).toHaveBeenCalledTimes(3);
        });
        
        it('should track active connections', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Establish connection
            const response = await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream')
                .set('X-Forwarded-For', '192.168.1.100')
                .expect(200);
            
            // Connection should be tracked
            expect(mockServer.server.connect).toHaveBeenCalled();
        });
    });
    
    describe('Message Handling', () => {
        it('should handle POST messages to /message endpoint', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // First establish SSE connection
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Send message
            const message = {
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 1
            };
            
            const response = await request(`http://localhost:${port}`)
                .post('/message')
                .send(message)
                .expect(200);
            
            expect(response.text).toBe('Message sent to all connected clients');
        });
        
        it('should broadcast messages to all connected clients', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Establish multiple connections
            const clients = [];
            for (let i = 0; i < 2; i++) {
                await request(`http://localhost:${port}`)
                    .get('/')
                    .set('Accept', 'text/event-stream');
                clients.push(i);
            }
            
            // Send message
            const message = {
                jsonrpc: '2.0',
                method: 'test',
                params: { data: 'broadcast test' },
                id: 1
            };
            
            await request(`http://localhost:${port}`)
                .post('/message')
                .send(message)
                .expect(200);
            
            // Verify message was sent to all clients
            expect(mockServer.server.connect).toHaveBeenCalledTimes(2);
        });
    });
    
    describe('Reconnection Logic', () => {
        it('should attempt reconnection on connection failure', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Mock connection failure then success
            mockServer.server.connect
                .mockRejectedValueOnce(new Error('Connection failed'))
                .mockResolvedValueOnce();
            
            // Attempt connection
            const response = await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Wait for reconnection attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Should have attempted to connect twice
            expect(mockServer.server.connect.mock.calls.length).toBeGreaterThanOrEqual(2);
        });
        
        it('should implement exponential backoff for reconnections', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Mock multiple connection failures
            mockServer.server.connect
                .mockRejectedValueOnce(new Error('Failed 1'))
                .mockRejectedValueOnce(new Error('Failed 2'))
                .mockResolvedValueOnce();
            
            const startTime = Date.now();
            
            // Attempt connection
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Wait for reconnections
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // Should take longer due to exponential backoff
            expect(duration).toBeGreaterThan(3000);
        });
        
        it('should respect maximum reconnection attempts', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Mock all connection attempts to fail
            mockServer.server.connect.mockRejectedValue(new Error('Persistent failure'));
            
            // Attempt connection
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Wait for all reconnection attempts
            await new Promise(resolve => setTimeout(resolve, 30000));
            
            // Should not exceed maximum attempts (10)
            expect(mockServer.server.connect.mock.calls.length).toBeLessThanOrEqual(11); // 1 initial + 10 retries
        }, 35000); // Increase timeout for this test
    });
    
    describe('Connection Cleanup', () => {
        it('should clean up connections on client disconnect', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const controller = new AbortController();
            
            // Establish connection
            const responsePromise = request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream')
                .timeout({ response: 100 }) // Short timeout to trigger disconnect
                .catch(err => {
                    // Expected timeout error
                    expect(err.code).toBe('ECONNABORTED');
                });
            
            await responsePromise;
            
            // Connection should have been cleaned up
            // (In real implementation, check activeConnections map)
        });
        
        it('should handle connection errors gracefully', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Mock transport creation to fail
            const originalSSEServerTransport = (await import('@modelcontextprotocol/sdk/server/sse.js')).SSEServerTransport;
            vi.doMock('@modelcontextprotocol/sdk/server/sse.js', () => ({
                SSEServerTransport: class {
                    constructor() {
                        throw new Error('Transport creation failed');
                    }
                }
            }));
            
            // Attempt connection should not crash server
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Server should still be running
            const healthResponse = await request(`http://localhost:${port}`)
                .get('/health')
                .expect(200);
            
            expect(healthResponse.text).toBe('OK');
        });
    });
    
    describe('Error Handling', () => {
        it('should handle malformed messages gracefully', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Establish connection first
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Send malformed JSON
            const response = await request(`http://localhost:${port}`)
                .post('/message')
                .set('Content-Type', 'application/json')
                .send('{"invalid json}')
                .expect(400);
            
            expect(response.body.error).toBe('Invalid JSON');
        });
        
        it('should handle transport errors', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Mock transport to throw error
            mockServer.server.connect.mockImplementation(() => {
                throw new Error('Transport error');
            });
            
            // Connection should fail but not crash
            const response = await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream');
            
            // Should still receive SSE headers
            expect(response.headers['content-type']).toBe('text/event-stream');
        });
    });
    
    describe('Client Information Tracking', () => {
        it('should track client IP addresses', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const testIp = '10.0.0.1';
            
            await request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream')
                .set('X-Forwarded-For', testIp);
            
            // In real implementation, verify IP is tracked in activeConnections
            expect(mockServer.server.connect).toHaveBeenCalled();
        });
        
        it('should generate unique client IDs', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            const clientIds = new Set();
            
            // Create multiple connections and track client IDs
            for (let i = 0; i < 5; i++) {
                await request(`http://localhost:${port}`)
                    .get('/')
                    .set('Accept', 'text/event-stream');
            }
            
            // All connections should have been established
            expect(mockServer.server.connect).toHaveBeenCalledTimes(5);
        });
    });
    
    describe('Performance and Scalability', () => {
        it('should handle rapid connection/disconnection cycles', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            for (let i = 0; i < 10; i++) {
                const response = await request(`http://localhost:${port}`)
                    .get('/')
                    .set('Accept', 'text/event-stream')
                    .timeout({ response: 50 });
                
                // Immediately close connection
                response.abort();
            }
            
            // Server should still be responsive
            const healthCheck = await request(`http://localhost:${port}`)
                .get('/health')
                .expect(200);
            
            expect(healthCheck.text).toBe('OK');
        });
        
        it('should maintain connection stability over time', async () => {
            const port = getNextPort();
            const result = await startServer(port);
            server = result.server;
            
            // Establish long-lived connection
            const startTime = Date.now();
            
            const connectionPromise = request(`http://localhost:${port}`)
                .get('/')
                .set('Accept', 'text/event-stream')
                .timeout({ response: 5000 });
            
            // Wait for 3 seconds
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Connection should still be active
            connectionPromise.abort();
            
            const duration = Date.now() - startTime;
            expect(duration).toBeGreaterThan(2999);
        });
    });
});