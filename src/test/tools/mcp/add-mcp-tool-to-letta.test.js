import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleAddMcpToolToLetta,
    addMcpToolToLettaDefinition,
} from '../../../tools/mcp/add-mcp-tool-to-letta.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Add MCP Tool to Letta', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(addMcpToolToLettaDefinition.name).toBe('add_mcp_tool_to_letta');
            expect(addMcpToolToLettaDefinition.description).toContain(
                'Registers a tool from a connected MCP server',
            );
            expect(addMcpToolToLettaDefinition.inputSchema.required).toEqual([
                'tool_name',
                'agent_id',
            ]);
            expect(addMcpToolToLettaDefinition.inputSchema.properties).toHaveProperty('tool_name');
            expect(addMcpToolToLettaDefinition.inputSchema.properties).toHaveProperty('agent_id');
        });
    });

    describe('Functionality Tests', () => {
        it('should find, register and attach MCP tool successfully', async () => {
            const mockServers = {
                'test-server': { url: 'http://localhost:3000' },
                'another-server': { url: 'http://localhost:3001' },
            };
            const mockTools = [
                { name: 'test-tool', description: 'A test tool' },
                { name: 'another-tool', description: 'Another tool' },
            ];
            const mockRegisteredTool = { id: 'letta-tool-123', name: 'test-tool' };
            const mockUpdatedAgent = {
                id: 'agent-456',
                tools: [mockRegisteredTool],
            };

            // Mock server listing
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url === '/tools/mcp/servers/test-server/tools') {
                    return Promise.resolve({ data: mockTools });
                }
                if (url === '/tools/mcp/servers/another-server/tools') {
                    return Promise.resolve({ data: [] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            // Mock registration
            mockServer.api.post.mockResolvedValueOnce({ data: mockRegisteredTool });

            // Mock attachment
            mockServer.api.patch.mockResolvedValueOnce({ data: mockUpdatedAgent });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'test-tool',
                agent_id: 'agent-456',
            });

            // Verify server search
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers',
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify tool registration
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/mcp/servers/test-server/test-tool',
                {},
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify attachment
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-456/tools/attach/letta-tool-123',
                {},
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.letta_tool_id).toBe('letta-tool-123');
            expect(data.letta_tool_name).toBe('test-tool');
            expect(data.agent_id).toBe('agent-456');
            expect(data.attached).toBe(true);
            expect(data.mcp_server_name).toBe('test-server');
            expect(data.mcp_tool_name).toBe('test-tool');
        });

        it('should search multiple servers to find tool', async () => {
            const mockServers = {
                server1: {},
                server2: {},
                server3: {},
            };
            const targetTool = { name: 'target-tool', description: 'Tool to find' };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url === '/tools/mcp/servers/server1/tools') {
                    return Promise.resolve({ data: [{ name: 'other-tool' }] });
                }
                if (url === '/tools/mcp/servers/server2/tools') {
                    return Promise.resolve({ data: [] });
                }
                if (url === '/tools/mcp/servers/server3/tools') {
                    return Promise.resolve({ data: [targetTool] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            mockServer.api.post.mockResolvedValueOnce({
                data: { id: 'tool-123', name: 'target-tool' },
            });
            mockServer.api.patch.mockResolvedValueOnce({
                data: { tools: [{ id: 'tool-123' }] },
            });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'target-tool',
                agent_id: 'agent-123',
            });

            // Should have checked all servers until found
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers/server1/tools',
                expect.any(Object),
            );
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers/server2/tools',
                expect.any(Object),
            );
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/mcp/servers/server3/tools',
                expect.any(Object),
            );

            // Should register from server3
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/mcp/servers/server3/target-tool',
                {},
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.mcp_server_name).toBe('server3');
        });

        it('should handle attachment failure gracefully', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'test-tool' }];
            const mockRegisteredTool = { id: 'tool-123', name: 'test-tool' };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            mockServer.api.post.mockResolvedValueOnce({ data: mockRegisteredTool });

            // Mock attachment failure
            const attachError = new Error('Permission denied');
            attachError.response = { data: { error: 'Insufficient permissions' } };
            mockServer.api.patch.mockRejectedValueOnce(attachError);

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'test-tool',
                agent_id: 'agent-123',
            });

            // Should still return success for registration but indicate attachment failed
            const data = expectValidToolResponse(result);
            expect(data.letta_tool_id).toBe('tool-123');
            expect(data.attached).toBe(false);
            expect(data.error).toBeDefined();
            expect(data.error.error).toBe('Insufficient permissions');
            expect(result.isError).toBe(true);
        });

        it('should handle attachment success but tool not in list', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'test-tool' }];
            const mockRegisteredTool = { id: 'tool-123', name: 'test-tool' };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            mockServer.api.post.mockResolvedValueOnce({ data: mockRegisteredTool });

            // Mock attachment response without the tool in list
            mockServer.api.patch.mockResolvedValueOnce({
                data: { tools: [{ id: 'other-tool' }] },
            });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'test-tool',
                agent_id: 'agent-123',
            });

            const data = expectValidToolResponse(result);
            expect(data.attached).toBe(false);
            expect(result.isError).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing tool_name', async () => {
            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow('Missing required argument: tool_name');
        });

        it('should throw error for missing agent_id', async () => {
            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                }),
            ).rejects.toThrow('Missing required argument: agent_id');
        });

        it('should throw error when tool not found in any server', async () => {
            const mockServers = {
                server1: {},
                server2: {},
            };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: [] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'non-existent-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow(
                "Could not find any MCP server providing the tool named 'non-existent-tool'",
            );
        });

        it('should throw error when MCP servers list fails', async () => {
            const error = new Error('Network error');
            error.response = { status: 500 };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow('Network error');
        });

        it('should handle invalid server response format', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: null });

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow('Failed to list MCP servers or invalid response format');
        });

        it('should continue searching if one server fails', async () => {
            const mockServers = {
                'failing-server': {},
                'working-server': {},
            };
            const mockTool = { name: 'test-tool' };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url === '/tools/mcp/servers/failing-server/tools') {
                    return Promise.reject(new Error('Server error'));
                }
                if (url === '/tools/mcp/servers/working-server/tools') {
                    return Promise.resolve({ data: [mockTool] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            mockServer.api.post.mockResolvedValueOnce({
                data: { id: 'tool-123', name: 'test-tool' },
            });
            mockServer.api.patch.mockResolvedValueOnce({
                data: { tools: [{ id: 'tool-123' }] },
            });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'test-tool',
                agent_id: 'agent-123',
            });

            const data = expectValidToolResponse(result);
            expect(data.mcp_server_name).toBe('working-server');
            expect(data.attached).toBe(true);
        });

        it('should throw error when registration fails', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'test-tool' }];

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            const regError = new Error('Registration failed');
            regError.response = { status: 400, data: { error: 'Invalid tool' } };
            mockServer.api.post.mockRejectedValueOnce(regError);

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow('Registration failed');
        });

        it('should throw error when registration response missing ID', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'test-tool' }];

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            // Registration response without ID
            mockServer.api.post.mockResolvedValueOnce({ data: { name: 'test-tool' } });

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow(
                'Registration API call succeeded but did not return the expected tool ID',
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty MCP servers list', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: {} });

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow("Could not find any MCP server providing the tool named 'test-tool'");
        });

        it('should handle tool name with special characters', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'tool-with-special/chars' }];

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            mockServer.api.post.mockResolvedValueOnce({
                data: { id: 'tool-123', name: 'tool-with-special/chars' },
            });
            mockServer.api.patch.mockResolvedValueOnce({
                data: { tools: [{ id: 'tool-123' }] },
            });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'tool-with-special/chars',
                agent_id: 'agent-123',
            });

            const data = expectValidToolResponse(result);
            expect(data.letta_tool_name).toBe('tool-with-special/chars');
        });

        it('should use returned tool name if different from requested', async () => {
            const mockServers = { 'test-server': {} };
            const mockTools = [{ name: 'requested-name' }];

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: mockTools });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            // Registration returns different name
            mockServer.api.post.mockResolvedValueOnce({
                data: { id: 'tool-123', name: 'actual-registered-name' },
            });
            mockServer.api.patch.mockResolvedValueOnce({
                data: { tools: [{ id: 'tool-123' }] },
            });

            const result = await handleAddMcpToolToLetta(mockServer, {
                tool_name: 'requested-name',
                agent_id: 'agent-123',
            });

            const data = expectValidToolResponse(result);
            expect(data.mcp_tool_name).toBe('requested-name');
            expect(data.letta_tool_name).toBe('actual-registered-name');
        });

        it('should handle tools array not being array', async () => {
            const mockServers = { 'test-server': {} };

            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: mockServers });
                }
                if (url.includes('/tools')) {
                    return Promise.resolve({ data: 'not-an-array' });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });

            await expect(
                handleAddMcpToolToLetta(mockServer, {
                    tool_name: 'test-tool',
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow("Could not find any MCP server providing the tool named 'test-tool'");
        });
    });
});
