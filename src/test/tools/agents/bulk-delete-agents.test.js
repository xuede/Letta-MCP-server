import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    handleBulkDeleteAgents,
    bulkDeleteAgentsDefinition,
} from '../../../tools/agents/bulk-delete-agents.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { mockApiSuccess, mockApiError, expectValidToolResponse } from '../../utils/test-helpers.js';

// Mock the logger
vi.mock('../../../core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('Bulk Delete Agents', () => {
    let mockServer;
    let mockApi;

    beforeEach(() => {
        mockServer = createMockLettaServer();
        mockApi = mockServer.api;
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(bulkDeleteAgentsDefinition).toMatchObject({
                name: 'bulk_delete_agents',
                description: expect.stringContaining('Deletes multiple agents'),
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent_ids: {
                            type: 'array',
                            items: { type: 'string' },
                            description: expect.any(String),
                        },
                        agent_name_filter: {
                            type: 'string',
                            description: expect.any(String),
                        },
                        agent_tag_filter: {
                            type: 'string',
                            description: expect.any(String),
                        },
                    },
                    required: [],
                },
            });
        });
    });

    describe('Functionality Tests', () => {
        it('should delete agents by specific IDs', async () => {
            const agentIds = ['agent-1', 'agent-2', 'agent-3'];

            // Mock delete calls for each agent
            mockApi.delete
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-1') {
                        return Promise.resolve({ status: 200 });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-2') {
                        return Promise.resolve({ status: 200 });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-3') {
                        return Promise.resolve({ status: 200 });
                    }
                });

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: agentIds });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 3,
                success_count: 3,
                error_count: 0,
            });

            expect(parsedResult.results).toHaveLength(3);
            expect(parsedResult.results[0]).toMatchObject({
                agent_id: 'agent-1',
                name: 'ID: agent-1',
                status: 'success',
            });

            // Verify all delete calls were made
            expect(mockApi.delete).toHaveBeenCalledTimes(3);
            expect(mockApi.delete).toHaveBeenCalledWith('/agents/agent-1', expect.any(Object));
            expect(mockApi.delete).toHaveBeenCalledWith('/agents/agent-2', expect.any(Object));
            expect(mockApi.delete).toHaveBeenCalledWith('/agents/agent-3', expect.any(Object));
        });

        it('should delete agents by name filter', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Test Agent 1' },
                { id: 'agent-2', name: 'Test Agent 2' },
            ];

            // Mock list agents response
            mockApi.get.mockImplementationOnce((url, config) => {
                if (url === '/agents/' && config.params.name === 'Test') {
                    return Promise.resolve({ status: 200, data: mockAgents });
                }
            });

            // Mock delete calls
            mockApi.delete
                .mockImplementationOnce(() => Promise.resolve({ status: 200 }))
                .mockImplementationOnce(() => Promise.resolve({ status: 200 }));

            const result = await handleBulkDeleteAgents(mockServer, { agent_name_filter: 'Test' });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 2,
                success_count: 2,
                error_count: 0,
            });

            expect(parsedResult.results).toHaveLength(2);
            expect(parsedResult.results[0]).toMatchObject({
                agent_id: 'agent-1',
                name: 'Test Agent 1',
                status: 'success',
            });

            // Verify list was called with correct params
            expect(mockApi.get).toHaveBeenCalledWith('/agents/', {
                headers: expect.any(Object),
                params: { name: 'Test' },
            });
        });

        it('should delete agents by tag filter', async () => {
            const mockAgents = [
                { id: 'agent-1', name: 'Production Agent' },
                { id: 'agent-2', name: 'Another Prod Agent' },
            ];

            // Mock list agents response
            mockApi.get.mockImplementationOnce((url, config) => {
                if (url === '/agents/' && config.params.tags === 'production') {
                    return Promise.resolve({ status: 200, data: mockAgents });
                }
            });

            // Mock delete calls
            mockApi.delete
                .mockImplementationOnce(() => Promise.resolve({ status: 200 }))
                .mockImplementationOnce(() => Promise.resolve({ status: 200 }));

            const result = await handleBulkDeleteAgents(mockServer, {
                agent_tag_filter: 'production',
            });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 2,
                success_count: 2,
                error_count: 0,
            });

            // Verify list was called with correct params
            expect(mockApi.get).toHaveBeenCalledWith('/agents/', {
                headers: expect.any(Object),
                params: { tags: 'production' },
            });
        });

        it('should handle mixed success and failure', async () => {
            const agentIds = ['agent-1', 'agent-2', 'agent-3'];

            // Mock delete calls with mixed results
            mockApi.delete
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-1') {
                        return Promise.resolve({ status: 200 });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-2') {
                        return Promise.reject({
                            response: {
                                status: 404,
                                data: { error: 'Agent not found' },
                            },
                            message: 'Not found',
                        });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent-3') {
                        return Promise.resolve({ status: 200 });
                    }
                });

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: agentIds });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 3,
                success_count: 2,
                error_count: 1,
            });

            // Check individual results
            expect(parsedResult.results[0].status).toBe('success');
            expect(parsedResult.results[1].status).toBe('error');
            expect(parsedResult.results[1].error).toContain('Failed to delete agent agent-2');
            expect(parsedResult.results[2].status).toBe('success');
        });

        it('should handle no agents found', async () => {
            // Mock empty list response
            mockApi.get.mockImplementationOnce(() => Promise.resolve({ status: 200, data: [] }));

            const result = await handleBulkDeleteAgents(mockServer, {
                agent_name_filter: 'NonExistent',
            });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.message).toBe('No agents found matching the specified filter.');
            expect(parsedResult.results).toEqual([]);

            // No delete calls should be made
            expect(mockApi.delete).not.toHaveBeenCalled();
        });

        it('should handle multiple filters (name and tag)', async () => {
            const mockAgents = [{ id: 'agent-1', name: 'Test Production Agent' }];

            // Mock list agents response
            mockApi.get.mockImplementationOnce((url, config) => {
                if (
                    url === '/agents/' &&
                    config.params.name === 'Test' &&
                    config.params.tags === 'production'
                ) {
                    return Promise.resolve({ status: 200, data: mockAgents });
                }
            });

            // Mock delete call
            mockApi.delete.mockImplementationOnce(() => Promise.resolve({ status: 200 }));

            const result = await handleBulkDeleteAgents(mockServer, {
                agent_name_filter: 'Test',
                agent_tag_filter: 'production',
            });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 1,
                success_count: 1,
                error_count: 0,
            });

            // Verify list was called with both params
            expect(mockApi.get).toHaveBeenCalledWith('/agents/', {
                headers: expect.any(Object),
                params: { name: 'Test', tags: 'production' },
            });
        });

        it('should handle special characters in agent IDs', async () => {
            const agentIds = ['agent with spaces', 'agent/with/slashes', 'agent@special'];

            // Mock delete calls with proper encoding
            mockApi.delete
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent%20with%20spaces') {
                        return Promise.resolve({ status: 200 });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent%2Fwith%2Fslashes') {
                        return Promise.resolve({ status: 200 });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === '/agents/agent%40special') {
                        return Promise.resolve({ status: 200 });
                    }
                });

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: agentIds });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary.success_count).toBe(3);

            // Verify URLs were properly encoded
            expect(mockApi.delete).toHaveBeenCalledWith(
                '/agents/agent%20with%20spaces',
                expect.any(Object),
            );
            expect(mockApi.delete).toHaveBeenCalledWith(
                '/agents/agent%2Fwith%2Fslashes',
                expect.any(Object),
            );
            expect(mockApi.delete).toHaveBeenCalledWith(
                '/agents/agent%40special',
                expect.any(Object),
            );
        });

        it('should handle delete errors without response object', async () => {
            const agentIds = ['agent-1'];

            // Mock delete call with network error
            mockApi.delete.mockRejectedValueOnce(new Error('Network error'));

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: agentIds });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 1,
                success_count: 0,
                error_count: 1,
            });

            expect(parsedResult.results[0]).toMatchObject({
                status: 'error',
                error: expect.stringContaining('Network error'),
            });
        });
    });

    describe('Error Handling', () => {
        it('should throw error when no filter criteria provided', async () => {
            await expect(handleBulkDeleteAgents(mockServer, {})).rejects.toThrow(
                'Missing required argument: Provide agent_ids, agent_name_filter, or agent_tag_filter.',
            );

            await expect(handleBulkDeleteAgents(mockServer, null)).rejects.toThrow(
                'Missing required argument: Provide agent_ids, agent_name_filter, or agent_tag_filter.',
            );
        });

        it('should handle empty agent_ids array', async () => {
            // When agent_ids is empty array, it should list all agents (no filter)
            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: [],
            });

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: [] });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.message).toBe('No agents found matching the specified filter.');
            expect(parsedResult.results).toEqual([]);
        });

        it('should handle list agents API errors', async () => {
            // Mock list agents to fail
            mockApi.get.mockRejectedValueOnce({
                response: {
                    status: 500,
                    data: { error: 'Internal server error' },
                },
                message: 'Server error',
            });

            await expect(
                handleBulkDeleteAgents(mockServer, { agent_name_filter: 'Test' }),
            ).rejects.toThrow('Failed during bulk delete operation');
        });

        it('should handle unexpected response format', async () => {
            // Mock list agents with non-array response
            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { agents: [] }, // Wrong format
            });

            const result = await handleBulkDeleteAgents(mockServer, { agent_name_filter: 'Test' });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.message).toBe('No agents found matching the specified filter.');
            expect(parsedResult.results).toEqual([]);
        });

        it('should continue deleting remaining agents after individual failures', async () => {
            const agentIds = ['agent-1', 'agent-2', 'agent-3'];

            // Mock delete calls where middle one fails
            mockApi.delete
                .mockResolvedValueOnce({ status: 200 })
                .mockRejectedValueOnce(new Error('Delete failed'))
                .mockResolvedValueOnce({ status: 200 });

            const result = await handleBulkDeleteAgents(mockServer, { agent_ids: agentIds });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.summary).toMatchObject({
                total_agents: 3,
                success_count: 2,
                error_count: 1,
            });

            // All delete calls should have been attempted
            expect(mockApi.delete).toHaveBeenCalledTimes(3);
        });

        it('should handle authentication errors during list', async () => {
            mockApi.get.mockRejectedValueOnce({
                response: {
                    status: 401,
                    data: { error: 'Unauthorized' },
                },
                message: 'Authentication failed',
            });

            await expect(
                handleBulkDeleteAgents(mockServer, { agent_tag_filter: 'test' }),
            ).rejects.toThrow('Failed during bulk delete operation');
        });
    });
});
