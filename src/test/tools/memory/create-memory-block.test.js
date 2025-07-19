import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleCreateMemoryBlock,
    createMemoryBlockToolDefinition,
} from '../../../tools/memory/create-memory-block.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Create Memory Block', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(createMemoryBlockToolDefinition.name).toBe('create_memory_block');
            expect(createMemoryBlockToolDefinition.description).toContain(
                'Create a new memory block',
            );
            expect(createMemoryBlockToolDefinition.inputSchema.required).toEqual([
                'name',
                'label',
                'value',
            ]);
            expect(createMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('name');
            expect(createMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('label');
            expect(createMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('value');
            expect(createMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty(
                'agent_id',
            );
            expect(createMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty(
                'metadata',
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should create memory block successfully with minimal args', async () => {
            const createdBlock = {
                ...fixtures.memory.block,
                id: 'new-block-123',
                name: 'Test Block',
                label: 'persona',
                value: 'I am a helpful assistant',
            };

            // Mock successful block creation
            mockServer.api.post.mockResolvedValueOnce({ data: createdBlock });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'Test Block',
                label: 'persona',
                value: 'I am a helpful assistant',
            });

            // Verify API call
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    name: 'Test Block',
                    label: 'persona',
                    value: 'I am a helpful assistant',
                    metadata: expect.objectContaining({
                        type: 'persona',
                        version: '1.0',
                        last_updated: expect.any(String),
                    }),
                }),
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe('new-block-123');
            expect(data.name).toBe('Test Block');
            expect(data.label).toBe('persona');
            expect(data.agent_id).toBeUndefined();
        });

        it('should create memory block with custom metadata', async () => {
            const customMetadata = {
                custom_field: 'custom_value',
                version: '2.0',
                tags: ['important', 'user-defined'],
            };

            const createdBlock = {
                id: 'custom-block-123',
                name: 'Custom Block',
                label: 'human',
                value: 'User information',
                metadata: customMetadata,
            };

            mockServer.api.post.mockResolvedValueOnce({ data: createdBlock });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'Custom Block',
                label: 'human',
                value: 'User information',
                metadata: customMetadata,
            });

            // Verify metadata was passed correctly
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    metadata: customMetadata,
                }),
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe('custom-block-123');
        });

        it('should create and attach memory block to agent', async () => {
            const agentId = 'agent-789';
            const blockId = 'attached-block-123';
            const agentInfo = {
                id: agentId,
                name: 'Test Agent',
            };

            // Mock block creation
            mockServer.api.post.mockResolvedValueOnce({
                data: { id: blockId },
            });

            // Mock attachment (patch returns empty)
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });

            // Mock agent info retrieval
            mockServer.api.get.mockResolvedValueOnce({
                data: agentInfo,
            });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'Agent Memory',
                label: 'system',
                value: 'System configuration',
                agent_id: agentId,
            });

            // Verify user_id header was set
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/blocks',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        user_id: agentId,
                    }),
                }),
            );

            // Verify attachment call
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/core-memory/blocks/attach/${blockId}`,
                {},
                expect.objectContaining({
                    headers: expect.objectContaining({
                        user_id: agentId,
                    }),
                }),
            );

            // Verify agent info retrieval
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        user_id: agentId,
                    }),
                }),
            );

            // Verify response includes agent info
            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe(blockId);
            expect(data.agent_id).toBe(agentId);
            expect(data.agent_name).toBe('Test Agent');
        });

        it('should handle agent without name when attaching', async () => {
            const agentId = 'agent-no-name';
            const blockId = 'block-no-name';

            mockServer.api.post.mockResolvedValueOnce({
                data: { id: blockId },
            });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({
                data: { id: agentId }, // No name field
            });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'No Name Block',
                label: 'persona',
                value: 'Content',
                agent_id: agentId,
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_name).toBe('Unknown');
        });

        it('should handle very long memory block values', async () => {
            const longValue = 'A'.repeat(10000); // 10k characters
            const createdBlock = {
                id: 'long-block-123',
                name: 'Long Block',
                label: 'system',
                value: longValue,
                limit: 10000,
            };

            mockServer.api.post.mockResolvedValueOnce({ data: createdBlock });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'Long Block',
                label: 'system',
                value: longValue,
            });

            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    value: longValue,
                }),
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe('long-block-123');
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing name', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    label: 'persona',
                    value: 'Some value',
                }),
            ).rejects.toThrow('Missing required argument: name');
        });

        it('should throw error for non-string name', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 123,
                    label: 'persona',
                    value: 'Some value',
                }),
            ).rejects.toThrow('Missing required argument: name (must be a string)');
        });

        it('should throw error for missing label', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Test Block',
                    value: 'Some value',
                }),
            ).rejects.toThrow('Missing required argument: label');
        });

        it('should throw error for non-string label', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Test Block',
                    label: ['invalid'],
                    value: 'Some value',
                }),
            ).rejects.toThrow('Missing required argument: label (must be a string)');
        });

        it('should throw error for missing value', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Test Block',
                    label: 'persona',
                }),
            ).rejects.toThrow('Missing required argument: value');
        });

        it('should throw error for non-string value', async () => {
            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Test Block',
                    label: 'persona',
                    value: { invalid: 'object' },
                }),
            ).rejects.toThrow('Missing required argument: value (must be a string)');
        });

        it('should handle API error during block creation', async () => {
            const error = new Error('Server error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Failed Block',
                    label: 'persona',
                    value: 'This will fail',
                }),
            ).rejects.toThrow('Server error');
        });

        it('should handle API error during attachment', async () => {
            const agentId = 'agent-fail';
            const blockId = 'block-fail';

            // Block creation succeeds
            mockServer.api.post.mockResolvedValueOnce({
                data: { id: blockId },
            });

            // Attachment fails
            const error = new Error('Failed to attach');
            error.response = { status: 404, data: { error: 'Agent not found' } };
            mockServer.api.patch.mockRejectedValueOnce(error);

            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Attach Fail Block',
                    label: 'persona',
                    value: 'Will fail on attach',
                    agent_id: agentId,
                }),
            ).rejects.toThrow('Failed to attach');
        });

        it('should handle API error when retrieving agent info', async () => {
            const agentId = 'agent-info-fail';
            const blockId = 'block-info-fail';

            // Block creation succeeds
            mockServer.api.post.mockResolvedValueOnce({
                data: { id: blockId },
            });

            // Attachment succeeds
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });

            // Agent info retrieval fails
            const error = new Error('Failed to get agent');
            error.response = { status: 404 };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleCreateMemoryBlock(mockServer, {
                    name: 'Info Fail Block',
                    label: 'persona',
                    value: 'Will fail on agent info',
                    agent_id: agentId,
                }),
            ).rejects.toThrow('Failed to get agent');
        });
    });

    describe('Memory Block Limits', () => {
        it('should handle blocks at maximum character limit', async () => {
            const maxValue = 'X'.repeat(5000); // Assuming 5000 is the default limit
            const createdBlock = {
                id: 'max-block-123',
                name: 'Max Block',
                label: 'system',
                value: maxValue,
                limit: 5000,
            };

            mockServer.api.post.mockResolvedValueOnce({ data: createdBlock });

            const result = await handleCreateMemoryBlock(mockServer, {
                name: 'Max Block',
                label: 'system',
                value: maxValue,
            });

            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe('max-block-123');
        });

        it('should create blocks with different labels', async () => {
            const labels = ['persona', 'human', 'system', 'custom_label'];

            for (const label of labels) {
                const createdBlock = {
                    id: `block-${label}`,
                    name: `${label} Block`,
                    label: label,
                    value: `Content for ${label}`,
                };

                mockServer.api.post.mockResolvedValueOnce({ data: createdBlock });

                const result = await handleCreateMemoryBlock(mockServer, {
                    name: `${label} Block`,
                    label: label,
                    value: `Content for ${label}`,
                });

                const data = expectValidToolResponse(result);
                expect(data.label).toBe(label);
            }
        });
    });
});
