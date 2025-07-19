import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleListMcpServers,
    listMcpServersDefinition,
} from '../../../tools/mcp/list-mcp-servers.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('List MCP Servers', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(listMcpServersDefinition.name).toBe('list_mcp_servers');
            expect(listMcpServersDefinition.description).toContain(
                'List all configured MCP servers',
            );
            expect(listMcpServersDefinition.inputSchema.properties).toEqual({});
            expect(listMcpServersDefinition.inputSchema.required).toEqual([]);
        });
    });

    describe('Functionality Tests', () => {
        it('should list MCP servers successfully', async () => {
            const mockServers = {
                toolselector: {
                    url: 'http://localhost:3000',
                    description: 'Tool selector MCP server',
                },
                filesystem: {
                    url: 'http://localhost:3001',
                    description: 'Filesystem MCP server',
                },
                github: {
                    url: 'http://localhost:3002',
                    description: 'GitHub MCP server',
                },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers',
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(3);
            expect(data.servers).toEqual(mockServers);
            expect(data.servers.toolselector).toBeDefined();
            expect(data.servers.filesystem).toBeDefined();
            expect(data.servers.github).toBeDefined();
        });

        it('should handle empty server list', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: {} });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(0);
            expect(data.servers).toEqual({});
        });

        it('should handle servers with minimal configuration', async () => {
            const mockServers = {
                'basic-server': {},
                'another-server': { url: 'http://localhost:4000' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(2);
            expect(data.servers['basic-server']).toEqual({});
            expect(data.servers['another-server'].url).toBe('http://localhost:4000');
        });

        it('should ignore any input arguments', async () => {
            const mockServers = { 'test-server': {} };
            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            // Pass some random args that should be ignored
            const result = await handleListMcpServers(mockServer, {
                unused: 'argument',
                another: 'ignored',
            });

            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(1);
        });

        it('should handle servers with complex configuration', async () => {
            const mockServers = {
                'advanced-server': {
                    url: 'http://localhost:5000',
                    description: 'Advanced MCP server',
                    capabilities: ['tool-execution', 'code-generation'],
                    auth: {
                        type: 'bearer',
                        token: 'xxx',
                    },
                    metadata: {
                        version: '1.0.0',
                        author: 'Test Author',
                    },
                },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.servers['advanced-server']).toEqual(mockServers['advanced-server']);
            expect(data.servers['advanced-server'].capabilities).toHaveLength(2);
            expect(data.servers['advanced-server'].metadata.version).toBe('1.0.0');
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const error = new Error('Network error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListMcpServers(mockServer, {})).rejects.toThrow('Network error');
        });

        it('should handle authentication errors', async () => {
            const error = new Error('Unauthorized');
            error.response = { status: 401, data: { error: 'Invalid credentials' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListMcpServers(mockServer, {})).rejects.toThrow('Unauthorized');
        });

        it('should handle malformed response data', async () => {
            // If API returns non-object data
            mockServer.api.get.mockResolvedValueOnce({ data: null });

            await expect(handleListMcpServers(mockServer, {})).rejects.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle server names with special characters', async () => {
            const mockServers = {
                'server-with-dash': { url: 'http://localhost:3000' },
                server_with_underscore: { url: 'http://localhost:3001' },
                'server.with.dots': { url: 'http://localhost:3002' },
                'server@special#chars': { url: 'http://localhost:3003' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(4);
            expect(Object.keys(data.servers)).toEqual(Object.keys(mockServers));
        });

        it('should handle very large server lists', async () => {
            const mockServers = {};
            for (let i = 0; i < 100; i++) {
                mockServers[`server-${i}`] = {
                    url: `http://localhost:${3000 + i}`,
                    description: `Server number ${i}`,
                };
            }

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.server_count).toBe(100);
            expect(Object.keys(data.servers)).toHaveLength(100);
        });

        it('should preserve all server configuration fields', async () => {
            const mockServers = {
                'test-server': {
                    url: 'http://localhost:3000',
                    custom_field_1: 'value1',
                    nested: {
                        field: 'value',
                        array: [1, 2, 3],
                    },
                    boolean_field: true,
                    number_field: 42,
                },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: mockServers });

            const result = await handleListMcpServers(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.servers['test-server']).toEqual(mockServers['test-server']);
            expect(data.servers['test-server'].nested.array).toEqual([1, 2, 3]);
            expect(data.servers['test-server'].boolean_field).toBe(true);
        });
    });
});
