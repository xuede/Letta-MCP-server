import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleListMemoryBlocks,
    listMemoryBlocksToolDefinition,
} from '../../../tools/memory/list-memory-blocks.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('List Memory Blocks', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(listMemoryBlocksToolDefinition.name).toBe('list_memory_blocks');
            expect(listMemoryBlocksToolDefinition.description).toContain('List all memory blocks');
            expect(listMemoryBlocksToolDefinition.inputSchema.required).toEqual([]);
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty('filter');
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty(
                'agent_id',
            );
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty('page');
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty(
                'pageSize',
            );
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty('label');
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty(
                'templates_only',
            );
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty('name');
            expect(listMemoryBlocksToolDefinition.inputSchema.properties).toHaveProperty(
                'include_full_content',
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should list all memory blocks without filters', async () => {
            const mockBlocks = [
                {
                    id: 'block-1',
                    name: 'Persona Block',
                    label: 'persona',
                    value: 'I am a helpful AI assistant with extensive knowledge',
                    limit: 5000,
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z',
                },
                {
                    id: 'block-2',
                    name: 'Human Block',
                    label: 'human',
                    value: 'The user is a software developer',
                    limit: 2000,
                    created_at: '2024-01-02T00:00:00Z',
                    updated_at: '2024-01-02T00:00:00Z',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {});

            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: expect.objectContaining({
                        templates_only: false,
                    }),
                }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(2);
            expect(data.blocks[0].id).toBe('block-1');
            expect(data.blocks[0].value_preview).toBe(
                'I am a helpful AI assistant with extensive knowledge',
            );
            expect(data.blocks[1].id).toBe('block-2');
            expect(data.blocks[1].value_preview).toBe('The user is a software developer');
            expect(data.pagination).toBeUndefined(); // No pagination for 2 items with default pageSize of 10
        });

        it('should include full content when requested', async () => {
            const mockBlocks = [
                {
                    id: 'block-full',
                    name: 'Full Content Block',
                    label: 'system',
                    value: 'This is the complete value of the memory block with all details',
                    limit: 5000,
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                include_full_content: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks[0].value).toBe(
                'This is the complete value of the memory block with all details',
            );
            expect(data.blocks[0].value_preview).toBeUndefined();
        });

        it('should truncate long values in preview', async () => {
            const longValue = 'A'.repeat(300); // 300 characters
            const mockBlocks = [
                {
                    id: 'block-long',
                    name: 'Long Block',
                    label: 'persona',
                    value: longValue,
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.blocks[0].value_preview).toBe('A'.repeat(200) + '...');
            expect(data.blocks[0].value).toBeUndefined();
        });

        it('should filter by label', async () => {
            const mockBlocks = [
                {
                    id: 'block-1',
                    name: 'Human Block',
                    label: 'human',
                    value: 'Human related content',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                label: 'human',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    params: expect.objectContaining({
                        label: 'human',
                        templates_only: false,
                    }),
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(1);
            expect(data.blocks[0].label).toBe('human');
        });

        it('should filter by text content', async () => {
            const mockBlocks = [
                {
                    id: 'block-1',
                    name: 'Developer Block',
                    label: 'human',
                    value: 'User is a software developer',
                },
                {
                    id: 'block-2',
                    name: 'Assistant Block',
                    label: 'persona',
                    value: 'I am an AI assistant',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                filter: 'developer',
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(1);
            expect(data.blocks[0].id).toBe('block-1');
        });

        it('should handle pagination correctly', async () => {
            // Create 25 mock blocks
            const mockBlocks = Array.from({ length: 25 }, (_, i) => ({
                id: `block-${i + 1}`,
                name: `Block ${i + 1}`,
                label: 'system',
                value: `Content for block ${i + 1}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                page: 2,
                pageSize: 10,
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(10);
            expect(data.blocks[0].id).toBe('block-11');
            expect(data.blocks[9].id).toBe('block-20');
            expect(data.pagination).toEqual({
                page: 2,
                pageSize: 10,
                totalBlocks: 25,
                totalPages: 3,
            });
        });

        it('should list blocks for specific agent', async () => {
            const agentId = 'agent-123';
            const mockBlocks = [
                {
                    id: 'agent-block-1',
                    name: 'Agent Persona',
                    label: 'persona',
                    value: 'Agent specific persona',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                agent_id: agentId,
            });

            // Verify agent-specific endpoint is used
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/core-memory/blocks`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        user_id: agentId,
                    }),
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(1);
        });

        it('should include agents using blocks when available', async () => {
            const mockBlocks = [
                {
                    id: 'shared-block',
                    name: 'Shared Block',
                    label: 'system',
                    value: 'Shared configuration',
                    agents: [
                        { id: 'agent-1', name: 'Agent One' },
                        { id: 'agent-2', name: 'Agent Two' },
                    ],
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.blocks[0].agents).toHaveLength(2);
            expect(data.blocks[0].agents[0]).toEqual({
                id: 'agent-1',
                name: 'Agent One',
            });
        });

        it('should filter templates only when requested', async () => {
            const mockBlocks = [
                {
                    id: 'template-1',
                    name: 'Template Block',
                    label: 'persona',
                    value: 'Template content',
                    is_template: true,
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                templates_only: true,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    params: expect.objectContaining({
                        templates_only: true,
                    }),
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(1);
        });

        it('should handle blocks with non-string values', async () => {
            const mockBlocks = [
                {
                    id: 'non-string-block',
                    name: 'Non-String Block',
                    label: 'data',
                    value: { type: 'object', data: 'complex' }, // Non-string value
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.blocks[0].value_preview).toBe('Non-string value');
        });

        it('should handle empty block list', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            const result = await handleListMemoryBlocks(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.blocks).toEqual([]);
            expect(data.pagination).toBeUndefined();
        });

        it('should handle blocks without metadata', async () => {
            const mockBlocks = [
                {
                    id: 'no-metadata',
                    name: 'No Metadata Block',
                    label: 'system',
                    value: 'Content',
                    // No metadata field
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            const result = await handleListMemoryBlocks(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.blocks[0].metadata).toEqual({});
        });

        it('should enforce pagination limits', async () => {
            const mockBlocks = Array.from({ length: 10 }, (_, i) => ({
                id: `block-${i}`,
                name: `Block ${i}`,
                label: 'system',
                value: `Content ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            // Test max page size limit
            const result = await handleListMemoryBlocks(mockServer, {
                pageSize: 150, // Over max of 100
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(10); // All blocks fit in one page
            expect(data.pagination).toBeUndefined();
        });

        it('should handle invalid page numbers', async () => {
            const mockBlocks = [
                {
                    id: 'block-1',
                    name: 'Test Block 1',
                    label: 'persona',
                    value: 'Content 1',
                },
                {
                    id: 'block-2',
                    name: 'Test Block 2',
                    label: 'human',
                    value: 'Content 2',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            // Negative page number should default to 1
            const result = await handleListMemoryBlocks(mockServer, {
                page: -5,
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors gracefully', async () => {
            const error = new Error('Server error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListMemoryBlocks(mockServer, {})).rejects.toThrow('Server error');
        });

        it('should handle network errors', async () => {
            const error = new Error('Network error');
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListMemoryBlocks(mockServer, {})).rejects.toThrow('Network error');
        });

        it('should handle malformed response data', async () => {
            // API returns non-array data
            mockServer.api.get.mockResolvedValueOnce({ data: { invalid: 'response' } });

            await expect(handleListMemoryBlocks(mockServer, {})).rejects.toThrow();
        });
    });

    describe('Complex Filtering', () => {
        it('should combine multiple filters', async () => {
            const mockBlocks = [
                {
                    id: 'match-all',
                    name: 'Developer Persona',
                    label: 'persona',
                    value: 'I help developers write code',
                },
                {
                    id: 'match-label',
                    name: 'Other Persona',
                    label: 'persona',
                    value: 'I help with general tasks',
                },
                {
                    id: 'match-text',
                    name: 'Human Dev',
                    label: 'human',
                    value: 'User is a developer',
                },
            ];

            // API will return only persona blocks based on label filter
            const personaBlocks = mockBlocks.filter((b) => b.label === 'persona');
            mockServer.api.get.mockResolvedValueOnce({ data: personaBlocks });

            const result = await handleListMemoryBlocks(mockServer, {
                label: 'persona',
                filter: 'developer',
            });

            const data = expectValidToolResponse(result);
            expect(data.blocks).toHaveLength(1);
            expect(data.blocks[0].id).toBe('match-all');
        });

        it('should filter by name parameter', async () => {
            const mockBlocks = [
                {
                    id: 'name-match',
                    name: 'Specific Name',
                    label: 'system',
                    value: 'Content',
                },
                {
                    id: 'name-no-match',
                    name: 'Other Name',
                    label: 'system',
                    value: 'Content',
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockBlocks });

            await handleListMemoryBlocks(mockServer, {
                name: 'Specific Name',
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks',
                expect.objectContaining({
                    params: expect.objectContaining({
                        name: 'Specific Name',
                    }),
                }),
            );
        });
    });
});
