import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleDeleteAgent, deleteAgentDefinition } from '../../../tools/agents/delete-agent.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Delete Agent', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(deleteAgentDefinition.name).toBe('delete_agent');
            expect(deleteAgentDefinition.description).toContain('Delete a specific agent');
            expect(deleteAgentDefinition.description).toContain(
                'WARNING: This action is permanent',
            );
            expect(deleteAgentDefinition.inputSchema.required).toEqual(['agent_id']);
            expect(deleteAgentDefinition.inputSchema.properties).toHaveProperty('agent_id');
        });

        it('should require agent_id parameter', () => {
            const agentIdProp = deleteAgentDefinition.inputSchema.properties.agent_id;
            expect(agentIdProp.type).toBe('string');
            expect(agentIdProp.description).toContain('ID of the agent to delete');
        });
    });

    describe('Functionality Tests', () => {
        it('should delete agent successfully', async () => {
            // Mock successful deletion (204 No Content)
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: 'agent-123',
            });

            // Verify API call
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/agents/agent-123',
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent-123');
        });

        it('should handle special characters in agent_id', async () => {
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: 'agent@special#123',
            });

            // Verify URL encoding
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/agents/agent%40special%23123',
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent@special#123');
        });

        it('should handle 200 OK response', async () => {
            // Some APIs return 200 instead of 204
            mockServer.api.delete.mockResolvedValueOnce({
                status: 200,
                data: { message: 'Agent deleted successfully' },
            });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: 'agent-456',
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent-456');
        });

        it('should handle unicode characters in agent_id', async () => {
            const unicodeId = 'agent-🤖-123';
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: unicodeId,
            });

            // Verify proper encoding
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                expect.stringContaining('agent-'),
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(unicodeId);
        });

        it('should pass correct headers', async () => {
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            await handleDeleteAgent(mockServer, {
                agent_id: 'agent-789',
            });

            expect(mockServer.getApiHeaders).toHaveBeenCalled();
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/agents/agent-789',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-token',
                        'Content-Type': 'application/json',
                    }),
                }),
            );
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing agent_id', async () => {
            await expect(handleDeleteAgent(mockServer, {})).rejects.toThrow(
                'Missing required argument: agent_id',
            );
        });

        it('should throw error for null agent_id', async () => {
            await expect(handleDeleteAgent(mockServer, { agent_id: null })).rejects.toThrow(
                'Missing required argument: agent_id',
            );
        });

        it('should throw error for undefined args', async () => {
            await expect(handleDeleteAgent(mockServer, undefined)).rejects.toThrow(
                'Missing required argument: agent_id',
            );
        });

        it('should handle agent not found (404)', async () => {
            const error = new Error('Not found');
            error.response = { status: 404 };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeleteAgent(mockServer, { agent_id: 'nonexistent' }),
            ).rejects.toThrow('Agent not found: nonexistent');
        });

        it('should handle unauthorized access (401)', async () => {
            const error = new Error('Unauthorized');
            error.response = { status: 401, data: { error: 'Invalid credentials' } };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Unauthorized',
            );
        });

        it('should handle forbidden access (403)', async () => {
            const error = new Error('Forbidden');
            error.response = { status: 403, data: { error: 'Insufficient permissions' } };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Forbidden',
            );
        });

        it('should handle server errors (500)', async () => {
            const error = new Error('Internal server error');
            error.response = { status: 500, data: { error: 'Database error' } };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Internal server error',
            );
        });

        it('should handle network errors', async () => {
            const error = new Error('Network error');
            // No response property for network errors
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Network error',
            );
        });

        it('should handle timeout errors', async () => {
            const error = new Error('Request timeout');
            error.code = 'ECONNABORTED';
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Request timeout',
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty agent_id string', async () => {
            await expect(handleDeleteAgent(mockServer, { agent_id: '' })).rejects.toThrow(
                'Missing required argument: agent_id',
            );
        });

        it('should handle very long agent_id', async () => {
            const longId = 'a'.repeat(1000);
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: longId,
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(longId);
        });

        it('should handle agent_id with spaces', async () => {
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: 'agent with spaces',
            });

            // Verify proper encoding of spaces
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/agents/agent%20with%20spaces',
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent with spaces');
        });

        it('should handle agent_id with slashes', async () => {
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result = await handleDeleteAgent(mockServer, {
                agent_id: 'org/team/agent',
            });

            // Verify proper encoding of slashes
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/agents/org%2Fteam%2Fagent',
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('org/team/agent');
        });

        it('should not retry on 404 errors', async () => {
            const error = new Error('Not found');
            error.response = { status: 404 };
            mockServer.api.delete.mockRejectedValue(error);

            await expect(handleDeleteAgent(mockServer, { agent_id: 'not-found' })).rejects.toThrow(
                'Agent not found: not-found',
            );

            // Should only be called once, no retries
            expect(mockServer.api.delete).toHaveBeenCalledTimes(1);
        });

        it('should handle already deleted agents gracefully', async () => {
            // First deletion succeeds
            mockServer.api.delete.mockResolvedValueOnce({ status: 204 });

            const result1 = await handleDeleteAgent(mockServer, {
                agent_id: 'agent-to-delete',
            });

            const data1 = expectValidToolResponse(result1);
            expect(data1.agent_id).toBe('agent-to-delete');

            // Second deletion returns 404
            const error = new Error('Not found');
            error.response = { status: 404 };
            mockServer.api.delete.mockRejectedValueOnce(error);

            await expect(
                handleDeleteAgent(mockServer, { agent_id: 'agent-to-delete' }),
            ).rejects.toThrow('Agent not found: agent-to-delete');
        });
    });
});
