import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleDeletePassage,
    deletePassageDefinition,
} from '../../../tools/passages/delete-passage.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Delete Passage', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(deletePassageDefinition.name).toBe('delete_passage');
            expect(deletePassageDefinition.description).toContain(
                "Delete a memory from an agent's archival memory",
            );
            expect(deletePassageDefinition.description).toContain(
                'WARNING: This action is permanent',
            );
            expect(deletePassageDefinition.inputSchema.required).toEqual(['agent_id', 'memory_id']);
            expect(deletePassageDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(deletePassageDefinition.inputSchema.properties).toHaveProperty('memory_id');
        });
    });

    describe('Functionality Tests', () => {
        it('should delete passage successfully', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-456';

            // Mock successful deletion (returns empty response)
            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            // Verify API call
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${memoryId}`,
                expect.objectContaining({
                    headers: expect.any(Object),
                }),
            );

            // Verify response contains IDs
            const data = expectValidToolResponse(result);
            expect(data.memory_id).toBe(memoryId);
            expect(data.agent_id).toBe(agentId);
        });

        it('should handle special characters in agent ID', async () => {
            const agentId = 'agent@special#id';
            const encodedAgentId = encodeURIComponent(agentId);
            const memoryId = 'passage-123';

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            expect(mockServer.api.delete).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory/${memoryId}`,
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(agentId);
        });

        it('should handle special characters in memory ID', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage@special#id';
            const encodedMemoryId = encodeURIComponent(memoryId);

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            expect(mockServer.api.delete).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${encodedMemoryId}`,
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.memory_id).toBe(memoryId);
        });

        it('should handle UUID format IDs', async () => {
            const agentId = '550e8400-e29b-41d4-a716-446655440000';
            const memoryId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            expect(mockServer.api.delete).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${memoryId}`,
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(agentId);
            expect(data.memory_id).toBe(memoryId);
        });

        it('should handle 204 No Content response', async () => {
            const agentId = 'agent-204';
            const memoryId = 'passage-204';

            // Mock 204 response (no content)
            mockServer.api.delete.mockResolvedValueOnce({
                data: null,
                status: 204,
                statusText: 'No Content',
            });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            const data = expectValidToolResponse(result);
            expect(data.memory_id).toBe(memoryId);
            expect(data.agent_id).toBe(agentId);
        });

        it('should delete multiple passages in sequence', async () => {
            const agentId = 'agent-multi';
            const memoryIds = ['passage-1', 'passage-2', 'passage-3'];

            for (const memoryId of memoryIds) {
                mockServer.api.delete.mockResolvedValueOnce({ data: {} });

                const result = await handleDeletePassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                });

                const data = expectValidToolResponse(result);
                expect(data.memory_id).toBe(memoryId);
            }

            expect(mockServer.api.delete).toHaveBeenCalledTimes(3);
        });

        it('should handle deletion with complex IDs', async () => {
            const agentId = 'agent_123-456.test';
            const memoryId = 'passage_789-012.data';

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(agentId);
            expect(data.memory_id).toBe(memoryId);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing agent_id', async () => {
            await expect(
                handleDeletePassage(mockServer, {
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle missing memory_id', async () => {
            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: memory_id',
            );
        });

        it('should handle null args', async () => {
            await expect(handleDeletePassage(mockServer, null)).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle 404 not found error', async () => {
            const agentId = 'agent-123';
            const memoryId = 'non-existent-passage';

            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { error: 'Passage not found' },
            };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                `Agent or Passage not found: agent_id=${agentId}, memory_id=${memoryId}`,
            );
        });

        it('should handle 401 unauthorized error', async () => {
            const error = new Error('Unauthorized');
            error.response = {
                status: 401,
                data: { error: 'Invalid authentication' },
            };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle 403 forbidden error', async () => {
            const error = new Error('Forbidden');
            error.response = {
                status: 403,
                data: { error: 'Cannot delete this passage' },
            };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle 409 conflict error', async () => {
            const error = new Error('Conflict');
            error.response = {
                status: 409,
                data: { error: 'Passage is in use and cannot be deleted' },
            };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle server errors', async () => {
            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { error: 'Database error during deletion' },
            };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle network errors without response', async () => {
            const error = new Error('Network error: Connection refused');
            // No response property
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle timeout errors', async () => {
            const error = new Error('Request timeout');
            error.code = 'ECONNABORTED';
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty string IDs gracefully', async () => {
            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: '',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );

            await expect(
                handleDeletePassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: '',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: memory_id',
            );
        });

        it('should handle very long IDs', async () => {
            const longAgentId = 'agent-' + 'x'.repeat(1000);
            const longMemoryId = 'passage-' + 'y'.repeat(1000);

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: longAgentId,
                memory_id: longMemoryId,
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(longAgentId);
            expect(data.memory_id).toBe(longMemoryId);
        });

        it('should handle IDs with unicode characters', async () => {
            const agentId = 'agent-你好-🚀';
            const memoryId = 'passage-世界-💬';
            const encodedAgentId = encodeURIComponent(agentId);
            const encodedMemoryId = encodeURIComponent(memoryId);

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            expect(mockServer.api.delete).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory/${encodedMemoryId}`,
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(agentId);
            expect(data.memory_id).toBe(memoryId);
        });

        it('should handle deletion with unexpected response data', async () => {
            const agentId = 'agent-unexpected';
            const memoryId = 'passage-unexpected';

            // API returns unexpected data structure
            mockServer.api.delete.mockResolvedValueOnce({
                data: {
                    success: true,
                    deleted_count: 1,
                    message: 'Passage deleted successfully',
                },
            });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            // Should still return standard response
            const data = expectValidToolResponse(result);
            expect(data.memory_id).toBe(memoryId);
            expect(data.agent_id).toBe(agentId);
        });

        it('should handle rapid successive deletions', async () => {
            const agentId = 'agent-rapid';
            const memoryIds = Array.from({ length: 10 }, (_, i) => `passage-${i}`);

            // Mock all deletions
            memoryIds.forEach(() => {
                mockServer.api.delete.mockResolvedValueOnce({ data: {} });
            });

            // Delete all passages rapidly
            const promises = memoryIds.map((memoryId) =>
                handleDeletePassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                }),
            );

            const results = await Promise.all(promises);

            // Verify all deletions succeeded
            results.forEach((result, index) => {
                const data = expectValidToolResponse(result);
                expect(data.memory_id).toBe(memoryIds[index]);
            });

            expect(mockServer.api.delete).toHaveBeenCalledTimes(10);
        });

        it('should handle case-sensitive IDs correctly', async () => {
            const agentId = 'Agent-ABC';
            const memoryId = 'Passage-XYZ';

            mockServer.api.delete.mockResolvedValueOnce({ data: {} });

            const result = await handleDeletePassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
            });

            // Should preserve case
            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('Agent-ABC');
            expect(data.memory_id).toBe('Passage-XYZ');
        });
    });
});
