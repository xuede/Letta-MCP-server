import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleBulkAttachToolToAgents,
    bulkAttachToolDefinition,
} from '../../../tools/tools/bulk-attach-tool.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Bulk Attach Tool', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(bulkAttachToolDefinition.name).toBe('bulk_attach_tool_to_agents');
            expect(bulkAttachToolDefinition.description).toContain(
                'Attaches a specified tool to multiple agents',
            );
            expect(bulkAttachToolDefinition.inputSchema.required).toEqual(['tool_id']);
            expect(bulkAttachToolDefinition.inputSchema.properties).toHaveProperty('tool_id');
            expect(bulkAttachToolDefinition.inputSchema.properties).toHaveProperty(
                'agent_name_filter',
            );
            expect(bulkAttachToolDefinition.inputSchema.properties).toHaveProperty(
                'agent_tag_filter',
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should attach tool to agents filtered by name', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Test Agent 1' },
                { id: 'agent-2', name: 'Test Agent 2' },
            ];

            // Mock list agents
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });

            // Mock successful attachments
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'Test',
            });

            // Verify API calls
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: { name: 'Test' },
                }),
            );

            expect(mockServer.api.patch).toHaveBeenCalledTimes(2);
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-1/tools/attach/tool-123',
                {},
                expect.objectContaining({ headers: expect.any(Object) }),
            );
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-2/tools/attach/tool-123',
                {},
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.summary.total_agents).toBe(2);
            expect(data.summary.success_count).toBe(2);
            expect(data.summary.error_count).toBe(0);
            expect(data.results).toHaveLength(2);
            expect(data.results.every((r) => r.status === 'success')).toBe(true);
        });

        it('should attach tool to agents filtered by tag', async () => {
            const mockAgents = [{ id: 'agent-3', name: 'Tagged Agent' }];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-456',
                agent_tag_filter: 'production',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: { tags: 'production' },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.summary.total_agents).toBe(1);
            expect(data.summary.success_count).toBe(1);
        });

        it('should handle both name and tag filters', async () => {
            const mockAgents = [{ id: 'agent-4', name: 'Test Production Agent' }];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-789',
                agent_name_filter: 'Test',
                agent_tag_filter: 'production',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: {
                        name: 'Test',
                        tags: 'production',
                    },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.summary.total_agents).toBe(1);
        });

        it('should handle no agents found', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'NonExistent',
            });

            const data = expectValidToolResponse(result);
            expect(data.message).toBe('No agents found matching the specified filter.');
            expect(data.results).toEqual([]);
        });

        it('should handle partial failures', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Agent 1' },
                { id: 'agent-2', name: 'Agent 2' },
                { id: 'agent-3', name: 'Agent 3' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });

            // Mock mixed success/failure
            mockServer.api.patch
                .mockResolvedValueOnce({ data: {} }) // Success for agent-1
                .mockRejectedValueOnce(new Error('Permission denied')) // Fail for agent-2
                .mockResolvedValueOnce({ data: {} }); // Success for agent-3

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'Agent',
            });

            const data = expectValidToolResponse(result);
            expect(data.summary.total_agents).toBe(3);
            expect(data.summary.success_count).toBe(2);
            expect(data.summary.error_count).toBe(1);

            expect(data.results[0].status).toBe('success');
            expect(data.results[1].status).toBe('error');
            expect(data.results[1].error).toContain('Permission denied');
            expect(data.results[2].status).toBe('success');
        });

        it('should properly encode special characters in IDs', async () => {
            const mockAgents = [{ id: 'agent/with/slashes', name: 'Special Agent' }];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool/special/id',
                agent_name_filter: 'Special',
            });

            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent%2Fwith%2Fslashes/tools/attach/tool%2Fspecial%2Fid',
                {},
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.summary.success_count).toBe(1);
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing tool_id', async () => {
            await expect(
                handleBulkAttachToolToAgents(mockServer, {
                    agent_name_filter: 'Test',
                }),
            ).rejects.toThrow('Missing required argument: tool_id');
        });

        it('should throw error when no filters provided', async () => {
            await expect(
                handleBulkAttachToolToAgents(mockServer, {
                    tool_id: 'tool-123',
                }),
            ).rejects.toThrow('Provide either agent_name_filter or agent_tag_filter');
        });

        it('should handle API error during agent listing', async () => {
            const error = new Error('API Error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleBulkAttachToolToAgents(mockServer, {
                    tool_id: 'tool-123',
                    agent_name_filter: 'Test',
                }),
            ).rejects.toThrow('Failed during bulk attach operation: API Error');
        });

        it('should handle non-array response from agents API', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: 'not-an-array' });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'Test',
            });

            const data = expectValidToolResponse(result);
            expect(data.message).toBe('No agents found matching the specified filter.');
        });

        it('should include detailed error information for failures', async () => {
            const mockAgents = [{ id: 'agent-1', name: 'Agent 1' }];
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });

            const error = new Error('Attachment failed');
            error.response = {
                status: 403,
                data: { error: 'Forbidden', details: 'Insufficient permissions' },
            };
            mockServer.api.patch.mockRejectedValueOnce(error);

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'Agent',
            });

            const data = expectValidToolResponse(result);
            const errorResult = data.results.find((r) => r.status === 'error');
            expect(errorResult.error).toContain('Status: 403');
            expect(errorResult.error).toContain('Forbidden');
            expect(errorResult.error).toContain('Insufficient permissions');
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty agent names gracefully', async () => {
            const mockAgents = [
                { id: 'agent-1', name: '' },
                { id: 'agent-2' }, // No name property
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_tag_filter: 'test',
            });

            const data = expectValidToolResponse(result);
            expect(data.results).toHaveLength(2);
            expect(data.results[0].name).toBe('');
            expect(data.results[1].name).toBeUndefined();
        });

        it('should handle large number of agents', async () => {
            const mockAgents = Array.from({ length: 100 }, (_, i) => ({
                id: `agent-${i}`,
                name: `Agent ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_name_filter: 'Agent',
            });

            expect(mockServer.api.patch).toHaveBeenCalledTimes(100);

            const data = expectValidToolResponse(result);
            expect(data.summary.total_agents).toBe(100);
            expect(data.summary.success_count).toBe(100);
        });

        it('should handle comma-separated tags', async () => {
            const mockAgents = [{ id: 'agent-1', name: 'Multi-tag Agent' }];

            mockServer.api.get.mockResolvedValueOnce({ data: mockAgents });
            mockServer.api.patch.mockResolvedValue({ data: {} });

            const result = await handleBulkAttachToolToAgents(mockServer, {
                tool_id: 'tool-123',
                agent_tag_filter: 'tag1,tag2,tag3',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    params: { tags: 'tag1,tag2,tag3' },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.summary.success_count).toBe(1);
        });
    });
});
