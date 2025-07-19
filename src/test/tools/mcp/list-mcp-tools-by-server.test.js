import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleListMcpToolsByServer,
    listMcpToolsByServerDefinition,
} from '../../../tools/mcp/list-mcp-tools-by-server.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('List MCP Tools By Server', () => {
    let mockServer;
    beforeEach(() => {
        mockServer = createMockLettaServer();
        // Mock console.error to suppress error logging in tests
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(listMcpToolsByServerDefinition.name).toBe('list_mcp_tools_by_server');
            expect(listMcpToolsByServerDefinition.description).toContain(
                'List all available tools for a specific MCP server',
            );
            expect(listMcpToolsByServerDefinition.inputSchema.required).toEqual([
                'mcp_server_name',
            ]);
            expect(listMcpToolsByServerDefinition.inputSchema.properties).toHaveProperty(
                'mcp_server_name',
            );
            expect(listMcpToolsByServerDefinition.inputSchema.properties).toHaveProperty('filter');
            expect(listMcpToolsByServerDefinition.inputSchema.properties).toHaveProperty('page');
            expect(listMcpToolsByServerDefinition.inputSchema.properties).toHaveProperty(
                'pageSize',
            );
        });
    });

    describe('Functionality Tests', () => {
        const mockTools = [
            {
                name: 'tool1',
                description: 'First tool for testing',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'tool2',
                description: 'Second tool for testing',
                inputSchema: { type: 'object', properties: {} },
            },
            {
                name: 'search_tool',
                description: 'Tool for searching data',
                inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
            },
        ];

        it('should list tools from MCP server with default pagination', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: mockTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'toolselector',
            });

            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers/toolselector/tools',
                expect.objectContaining({
                    headers: expect.any(Object),
                    timeout: 60000,
                }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.mcp_server_name).toBe('toolselector');
            expect(data.tool_count).toBe(3);
            expect(data.tools).toHaveLength(3);
            expect(data.pagination).toEqual({
                page: 1,
                pageSize: 10,
                totalTools: 3,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
            });
        });

        it('should handle pagination correctly', async () => {
            const manyTools = Array.from({ length: 25 }, (_, i) => ({
                name: `tool${i}`,
                description: `Tool number ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: manyTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                page: 2,
                pageSize: 10,
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(10);
            expect(data.tools[0].name).toBe('tool10');
            expect(data.tools[9].name).toBe('tool19');
            expect(data.pagination).toEqual({
                page: 2,
                pageSize: 10,
                totalTools: 25,
                totalPages: 3,
                hasNextPage: true,
                hasPreviousPage: true,
            });
        });

        it('should handle last page with partial results', async () => {
            const tools = Array.from({ length: 15 }, (_, i) => ({
                name: `tool${i}`,
                description: `Tool ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: tools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                page: 2,
                pageSize: 10,
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(5);
            expect(data.tools).toHaveLength(5);
            expect(data.pagination.hasNextPage).toBe(false);
            expect(data.pagination.hasPreviousPage).toBe(true);
        });

        it('should filter tools by name', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: mockTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'toolselector',
                filter: 'search',
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(1);
            expect(data.tools[0].name).toBe('search_tool');
        });

        it('should filter tools by description', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: mockTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'toolselector',
                filter: 'testing',
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(2);
            expect(data.tools.map((t) => t.name)).toEqual(['tool1', 'tool2']);
        });

        it('should handle case-insensitive filtering', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: mockTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'toolselector',
                filter: 'SEARCH',
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(1);
            expect(data.tools[0].name).toBe('search_tool');
        });

        it('should handle empty tool list', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'empty-server',
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(0);
            expect(data.tools).toEqual([]);
            expect(data.pagination.totalTools).toBe(0);
        });

        it('should encode special characters in server name', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'server/with/slashes',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers/server%2Fwith%2Fslashes/tools',
                expect.any(Object),
            );
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing mcp_server_name', async () => {
            await expect(handleListMcpToolsByServer(mockServer, {})).rejects.toThrow(
                'Missing required argument: mcp_server_name',
            );
        });

        it('should handle 404 error for non-existent server', async () => {
            const error = new Error('Not found');
            error.response = { status: 404, data: { error: 'Server not found' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListMcpToolsByServer(mockServer, {
                    mcp_server_name: 'non-existent',
                }),
            ).rejects.toThrow('MCP Server not found: non-existent');
        });

        it('should handle other API errors with context', async () => {
            const error = new Error('Network error');
            error.response = {
                status: 500,
                data: { error: 'Internal server error', details: 'Connection failed' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListMcpToolsByServer(mockServer, {
                    mcp_server_name: 'test-server',
                }),
            ).rejects.toThrow(/Error executing list_mcp_tools_by_server.*Network error/);
        });

        it('should handle API timeout', async () => {
            const error = new Error('Timeout');
            error.code = 'ECONNABORTED';
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListMcpToolsByServer(mockServer, {
                    mcp_server_name: 'slow-server',
                }),
            ).rejects.toThrow(/Timeout/);
        });

        it('should handle invalid pageSize', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [{ name: 'tool1' }] });

            // pageSize of 0 should use default pageSize of 10
            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                pageSize: 0,
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(1); // Gets 1 tool (all available)
            expect(data.tools).toEqual([{ name: 'tool1' }]);
            expect(data.pagination.pageSize).toBe(10); // Uses default
        });
    });

    describe('Edge Cases', () => {
        it('should handle tools with missing properties', async () => {
            const incompleteTools = [
                { name: 'tool1' }, // No description
                { description: 'Tool without name' }, // No name
                { name: 'complete', description: 'Complete tool' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: incompleteTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                filter: 'tool',
            });

            const data = expectValidToolResponse(result);
            // Should match 'tool1' by name and 'Tool without name' by description
            expect(data.tool_count).toBe(3);
        });

        it('should handle very large page sizes', async () => {
            const tools = Array.from({ length: 5 }, (_, i) => ({
                name: `tool${i}`,
                description: `Tool ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: tools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                pageSize: 1000,
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(5);
            expect(data.tools).toHaveLength(5);
            expect(data.pagination.totalPages).toBe(1);
        });

        it('should handle page number beyond available pages', async () => {
            const tools = Array.from({ length: 5 }, (_, i) => ({
                name: `tool${i}`,
                description: `Tool ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: tools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
                page: 10,
                pageSize: 10,
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(0);
            expect(data.tools).toEqual([]);
            expect(data.pagination.page).toBe(10);
            expect(data.pagination.hasNextPage).toBe(false);
        });

        it('should handle filter that matches no tools', async () => {
            const tools = [
                { name: 'tool1', description: 'First tool' },
                { name: 'tool2', description: 'Second tool' },
                { name: 'search_tool', description: 'Tool for searching data' },
            ];
            mockServer.api.get.mockResolvedValueOnce({ data: tools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'toolselector',
                filter: 'nonexistent',
            });

            const data = expectValidToolResponse(result);
            expect(data.tool_count).toBe(0);
            expect(data.tools).toEqual([]);
            expect(data.pagination.totalTools).toBe(0);
        });

        it('should preserve tool schema and additional properties', async () => {
            const complexTools = [
                {
                    name: 'complex_tool',
                    description: 'A complex tool',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            param1: { type: 'string', description: 'First parameter' },
                            param2: { type: 'number', default: 42 },
                        },
                        required: ['param1'],
                    },
                    outputSchema: {
                        type: 'object',
                        properties: {
                            result: { type: 'string' },
                        },
                    },
                    metadata: {
                        version: '1.0.0',
                        author: 'Test',
                    },
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: complexTools });

            const result = await handleListMcpToolsByServer(mockServer, {
                mcp_server_name: 'test-server',
            });

            const data = expectValidToolResponse(result);
            expect(data.tools[0]).toEqual(complexTools[0]);
            expect(data.tools[0].inputSchema.properties.param2.default).toBe(42);
            expect(data.tools[0].metadata.version).toBe('1.0.0');
        });
    });
});
