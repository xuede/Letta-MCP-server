import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import axios from 'axios';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';

describe('MCP Protocol Integration Tests', () => {
    let serverProcess;
    let serverPort;
    let baseURL;
    let sessionId;

    beforeAll(async () => {
        // Find available port
        serverPort = 4000 + Math.floor(Math.random() * 1000);
        baseURL = `http://localhost:${serverPort}`;

        // Start server
        serverProcess = spawn('node', ['src/index.js', '--http'], {
            env: {
                ...process.env,
                PORT: serverPort,
                LETTA_BASE_URL: process.env.LETTA_BASE_URL || 'https://letta.oculair.ca/v1',
                LETTA_PASSWORD: process.env.LETTA_PASSWORD || 'test-password',
            },
            cwd: process.cwd(),
        });

        // Wait for server to start
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Server failed to start within 20 seconds'));
            }, 20000);

            let output = '';
            let errorOutput = '';

            // Try health check approach
            const checkHealth = async () => {
                try {
                    const response = await axios.get(`${baseURL}/health`, {
                        timeout: 1000,
                        validateStatus: () => true,
                    });
                    if (response.status === 200) {
                        clearTimeout(timeout);
                        resolve();
                        return true;
                    }
                } catch (e) {
                    // Server not ready yet
                }
                return false;
            };

            // Poll health endpoint
            const pollInterval = setInterval(async () => {
                if (await checkHealth()) {
                    clearInterval(pollInterval);
                }
            }, 500);

            serverProcess.stdout.on('data', (data) => {
                output += data.toString();
                // Server output: data.toString();
            });

            serverProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
                console.error('Server error:', data.toString());
            });

            serverProcess.on('error', (err) => {
                clearTimeout(timeout);
                clearInterval(pollInterval);
                reject(new Error(`Failed to start server: ${err.message}`));
            });

            serverProcess.on('exit', (code) => {
                clearTimeout(timeout);
                clearInterval(pollInterval);
                if (code !== 0) {
                    reject(
                        new Error(
                            `Server exited with code ${code}. Output: ${output}\nError: ${errorOutput}`,
                        ),
                    );
                }
            });
        });
    }, 30000);

    afterAll(async () => {
        if (serverProcess) {
            serverProcess.kill();
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    });

    beforeEach(() => {
        sessionId = null;
    });

    const makeRequest = async (method, params = {}) => {
        const headers = {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
        };

        if (sessionId) {
            headers['mcp-session-id'] = sessionId;
        }

        const response = await axios.post(
            `${baseURL}/mcp`,
            {
                jsonrpc: '2.0',
                method,
                params,
                id: randomBytes(4).toString('hex'),
            },
            { headers },
        );

        // Parse SSE response
        if (response.headers['content-type']?.includes('text/event-stream')) {
            const lines = response.data.split('\n');
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.slice(6));
                    // Store session ID if present
                    if (response.headers['mcp-session-id']) {
                        sessionId = response.headers['mcp-session-id'];
                    }
                    return data;
                }
            }
        }

        return response.data;
    };

    describe('Health Check', () => {
        it('should respond to health check', async () => {
            const response = await axios.get(`${baseURL}/health`);
            expect(response.status).toBe(200);
            expect(response.data).toHaveProperty('status');
            expect(response.data.status).toMatch(/ok|healthy/);
        });
    });

    describe('MCP Protocol Flow', () => {
        it('should complete full MCP handshake', async () => {
            // Initialize
            const initResponse = await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: {
                    name: 'integration-test',
                    version: '1.0.0',
                },
            });

            expect(initResponse.result).toMatchObject({
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: { listChanged: true },
                    prompts: { listChanged: true },
                    resources: { subscribe: true, listChanged: true },
                },
                serverInfo: {
                    name: 'letta-server',
                    version: expect.any(String),
                },
            });

            expect(sessionId).toBeTruthy();
        });

        it('should reject requests without valid session', async () => {
            await expect(makeRequest('tools/list')).rejects.toThrow();
        });

        it('should handle multiple sessions independently', async () => {
            // Create first session
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'client1', version: '1.0.0' },
            });
            const session1 = sessionId;

            // Create second session
            sessionId = null;
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'client2', version: '1.0.0' },
            });
            const session2 = sessionId;

            expect(session1).not.toBe(session2);
        });
    });

    describe('Tools Integration', () => {
        beforeEach(async () => {
            // Initialize session
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            });
        });

        it('should list available tools', async () => {
            const response = await makeRequest('tools/list');

            expect(response.result.tools).toBeInstanceOf(Array);
            expect(response.result.tools.length).toBeGreaterThan(0);

            // Check tool structure
            const tool = response.result.tools[0];
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('inputSchema');
        });

        it('should execute tool calls', async () => {
            const response = await makeRequest('tools/call', {
                name: 'list_agents',
                arguments: {},
            });

            expect(response).toBeDefined();
            // Tool calls should return a result or error
            if (response.result) {
                expect(response.result).toHaveProperty('content');
                expect(response.result.content).toBeInstanceOf(Array);
            } else {
                expect(response.error).toBeDefined();
            }
        });

        it('should handle tool errors gracefully', async () => {
            const response = await makeRequest('tools/call', {
                name: 'retrieve_agent',
                arguments: { agent_id: 'non-existent-agent-id' },
            });

            // Should return error in error field, not result.isError
            expect(response.error).toBeDefined();
            expect(response.error.message).toBeDefined();
        });
    });

    describe('Prompts Integration', () => {
        beforeEach(async () => {
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            });
        });

        it('should list available prompts', async () => {
            const response = await makeRequest('prompts/list');

            expect(response.result.prompts).toBeInstanceOf(Array);
            expect(response.result.prompts.length).toBeGreaterThan(0);

            const prompt = response.result.prompts[0];
            expect(prompt).toHaveProperty('name');
            expect(prompt).toHaveProperty('title');
            expect(prompt).toHaveProperty('description');
            expect(prompt).toHaveProperty('arguments');
        });

        it('should get specific prompt with arguments', async () => {
            const response = await makeRequest('prompts/get', {
                name: 'letta_debug_assistant',
                arguments: {
                    agent_id: 'test-123',
                    issue: 'Test issue',
                },
            });

            expect(response.result).toHaveProperty('description');
            expect(response.result).toHaveProperty('messages');
            expect(response.result.messages).toBeInstanceOf(Array);
            expect(response.result.messages[0]).toHaveProperty('role');
            expect(response.result.messages[0]).toHaveProperty('content');
        });

        it('should handle missing prompts', async () => {
            const response = await makeRequest('prompts/get', {
                name: 'non_existent_prompt',
            });

            expect(response.error).toBeDefined();
            expect(response.error.message.toLowerCase()).toContain('unknown');
        });
    });

    describe('Resources Integration', () => {
        beforeEach(async () => {
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            });
        });

        it('should list available resources', async () => {
            const response = await makeRequest('resources/list');

            expect(response.result.resources).toBeInstanceOf(Array);
            expect(response.result.resources.length).toBeGreaterThan(0);

            const resource = response.result.resources[0];
            expect(resource).toHaveProperty('uri');
            expect(resource).toHaveProperty('name');
            expect(resource).toHaveProperty('title');
            expect(resource).toHaveProperty('mimeType');
        });

        it('should read resource content', async () => {
            const response = await makeRequest('resources/read', {
                uri: 'letta://system/status',
            });

            expect(response.result.contents).toBeInstanceOf(Array);
            expect(response.result.contents[0]).toHaveProperty('uri');
            expect(response.result.contents[0]).toHaveProperty('text');
            expect(response.result.contents[0]).toHaveProperty('mimeType');
        });

        it('should list resource templates', async () => {
            const response = await makeRequest('resources/templates/list');

            expect(response.result.resourceTemplates).toBeInstanceOf(Array);

            if (response.result.resourceTemplates.length > 0) {
                const template = response.result.resourceTemplates[0];
                expect(template).toHaveProperty('uriTemplate');
                expect(template).toHaveProperty('name');
                expect(template).toHaveProperty('title');
            }
        });

        it('should subscribe to resources', async () => {
            const response = await makeRequest('resources/subscribe', {
                uri: 'letta://system/status',
            });

            // Subscribe returns empty object on success
            expect(response.result).toEqual({});
        });
    });

    describe('Error Handling', () => {
        beforeEach(async () => {
            await makeRequest('initialize', {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            });
        });

        it('should handle malformed JSON-RPC requests', async () => {
            const response = await axios.post(
                `${baseURL}/mcp`,
                { invalid: 'request' },
                {
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json, text/event-stream',
                        'mcp-session-id': sessionId,
                    },
                    validateStatus: () => true,
                },
            );

            expect(response.status).toBe(400);
        });

        it('should handle unknown methods', async () => {
            const response = await makeRequest('unknown/method');

            expect(response.error).toBeDefined();
            expect(response.error.code).toBe(-32601);
            expect(response.error.message).toContain('Method not found');
        });

        it('should handle missing parameters', async () => {
            const response = await makeRequest('resources/read', {});

            expect(response.error).toBeDefined();
            // Zod validation returns structured error
            expect(response.error.message.toLowerCase()).toMatch(/required|invalid/);
        });
    });

    describe('Protocol Version Negotiation', () => {
        it('should handle different protocol versions', async () => {
            const response = await makeRequest('initialize', {
                protocolVersion: '2024-10-01', // Older version
                capabilities: {},
                clientInfo: { name: 'test', version: '1.0.0' },
            });

            // Server should respond with its supported version
            expect(response.result.protocolVersion).toMatch(/^202[4-5]-/);
        });
    });
});
