import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleModifyPassage,
    modifyPassageDefinition,
} from '../../../tools/passages/modify-passage.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Modify Passage', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(modifyPassageDefinition.name).toBe('modify_passage');
            expect(modifyPassageDefinition.description).toContain(
                "Modify a memory in the agent's archival memory",
            );
            expect(modifyPassageDefinition.inputSchema.required).toEqual([
                'agent_id',
                'memory_id',
                'update_data',
            ]);
            expect(modifyPassageDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(modifyPassageDefinition.inputSchema.properties).toHaveProperty('memory_id');
            expect(modifyPassageDefinition.inputSchema.properties).toHaveProperty('update_data');
            expect(modifyPassageDefinition.inputSchema.properties).toHaveProperty(
                'include_embeddings',
            );
            expect(modifyPassageDefinition.inputSchema.properties.update_data.required).toEqual([
                'text',
            ]);
            expect(modifyPassageDefinition.inputSchema.properties.include_embeddings.default).toBe(
                false,
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should modify passage text successfully without embeddings', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-456';
            const newText = 'Updated memory content for archival storage';

            const existingPassage = {
                id: memoryId,
                text: 'Original memory content',
                embedding: [0.1, 0.2, 0.3],
                embedding_config: { model: 'text-embedding-ada-002' },
                metadata: { created_at: '2024-01-01T00:00:00Z' },
            };

            const modifiedPassage = {
                ...existingPassage,
                text: newText,
                updated_at: '2024-01-02T00:00:00Z',
            };

            // Mock fetching all passages
            mockServer.api.get.mockResolvedValueOnce({
                data: [existingPassage, { id: 'other-passage', text: 'Other' }],
            });

            // Mock PATCH update
            mockServer.api.patch.mockResolvedValueOnce({
                data: [modifiedPassage],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: newText },
            });

            // Verify fetching passages with embeddings
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: { include_embeddings: true },
                }),
            );

            // Verify PATCH call with full payload
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${memoryId}`,
                expect.objectContaining({
                    id: memoryId,
                    text: newText,
                    embedding: [0.1, 0.2, 0.3],
                    embedding_config: { model: 'text-embedding-ada-002' },
                }),
                expect.objectContaining({
                    headers: expect.any(Object),
                }),
            );

            // Verify response without embeddings
            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(1);
            expect(data.passages[0].text).toBe(newText);
            expect(data.passages[0].embedding).toBeUndefined();
            expect(data.passages[0].updated_at).toBe('2024-01-02T00:00:00Z');
        });

        it('should include embeddings when requested', async () => {
            const agentId = 'agent-embed';
            const memoryId = 'passage-embed';
            const newText = 'Modified text with embeddings';
            const embeddings = [0.4, 0.5, 0.6];

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1, 0.2, 0.3],
                embedding_config: { model: 'ada' },
            };

            const modifiedPassage = {
                ...existingPassage,
                text: newText,
                embedding: embeddings,
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({ data: [modifiedPassage] });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: newText },
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toEqual(embeddings);
        });

        it('should handle special characters in agent ID', async () => {
            const agentId = 'agent@special#id';
            const encodedAgentId = encodeURIComponent(agentId);
            const memoryId = 'passage-123';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({ data: [existingPassage] });

            await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated' },
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory`,
                expect.any(Object),
            );

            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory/${memoryId}`,
                expect.any(Object),
                expect.any(Object),
            );
        });

        it('should handle special characters in memory ID', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage@special#id';
            const encodedMemoryId = encodeURIComponent(memoryId);

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({ data: [existingPassage] });

            await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated' },
            });

            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${encodedMemoryId}`,
                expect.any(Object),
                expect.any(Object),
            );
        });

        it('should preserve all existing fields when updating text', async () => {
            const agentId = 'agent-preserve';
            const memoryId = 'passage-preserve';

            const existingPassage = {
                id: memoryId,
                text: 'Original text',
                embedding: [0.1, 0.2],
                embedding_config: {
                    model: 'text-embedding-ada-002',
                    dimensions: 1536,
                },
                metadata: {
                    source: 'user',
                    tags: ['important', 'reference'],
                    custom_field: 'custom_value',
                },
                created_at: '2024-01-01T00:00:00Z',
                created_by_id: 'user-123',
                organization_id: 'org-456',
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...existingPassage, text: 'Updated text' }],
            });

            await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated text' },
            });

            // Verify all fields are preserved in the PATCH payload
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    id: memoryId,
                    text: 'Updated text',
                    embedding: [0.1, 0.2],
                    embedding_config: existingPassage.embedding_config,
                    metadata: existingPassage.metadata,
                    created_at: '2024-01-01T00:00:00Z',
                    created_by_id: 'user-123',
                    organization_id: 'org-456',
                }),
                expect.any(Object),
            );
        });

        it('should handle very long text updates', async () => {
            const agentId = 'agent-long';
            const memoryId = 'passage-long';
            const longText = 'B'.repeat(10000); // 10k characters

            const existingPassage = {
                id: memoryId,
                text: 'Short original',
                embedding: new Array(1536).fill(0.1),
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...existingPassage, text: longText }],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: longText },
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(longText);
        });

        it('should handle multiple passages returned from update', async () => {
            const agentId = 'agent-multi';
            const memoryId = 'passage-multi';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            const modifiedPassages = [
                { id: memoryId, text: 'Updated part 1', embedding: [0.2] },
                { id: 'new-passage', text: 'Updated part 2', embedding: [0.3] },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({ data: modifiedPassages });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated text that gets split' },
            });

            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(2);
            expect(data.passages[0].embedding).toBeUndefined();
            expect(data.passages[1].embedding).toBeUndefined();
        });

        it('should handle empty text updates', async () => {
            const agentId = 'agent-empty';
            const memoryId = 'passage-empty';

            const existingPassage = {
                id: memoryId,
                text: 'Will be cleared',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...existingPassage, text: '' }],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: '' },
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe('');
        });

        it('should handle special characters in text', async () => {
            const agentId = 'agent-special';
            const memoryId = 'passage-special';
            const specialText = 'Line 1\nLine 2\t"Quoted"\r\n\'Apostrophes\' & symbols < > {} 🚀';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...existingPassage, text: specialText }],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: specialText },
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(specialText);
        });
    });

    describe('Error Handling', () => {
        it('should handle missing agent_id', async () => {
            await expect(
                handleModifyPassage(mockServer, {
                    memory_id: 'passage-123',
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle missing memory_id', async () => {
            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'agent-123',
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: memory_id',
            );
        });

        it('should handle missing update_data', async () => {
            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('Missing or invalid required argument: update_data'),
            );
        });

        it('should handle update_data without text field', async () => {
            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                    update_data: {},
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining("update_data must contain a 'text' field"),
            );
        });

        it('should handle non-string text in update_data', async () => {
            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                    update_data: { text: 123 },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining("update_data must contain a 'text' field (string)"),
            );
        });

        it('should handle passage not found', async () => {
            const agentId = 'agent-123';
            const memoryId = 'non-existent-passage';

            // Return passages but without the requested one
            mockServer.api.get.mockResolvedValueOnce({
                data: [
                    { id: 'other-passage-1', text: 'Other' },
                    { id: 'other-passage-2', text: 'Another' },
                ],
            });

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining(`Could not find passage ${memoryId}`),
            );
        });

        it('should handle passage missing required fields', async () => {
            const agentId = 'agent-123';
            const memoryId = 'incomplete-passage';

            const incompletePassage = {
                id: memoryId,
                text: 'Text only',
                // Missing embedding and embedding_config
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [incompletePassage] });

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('is missing required fields'),
            );
        });

        it('should handle 404 agent not found during list', async () => {
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { error: 'Agent not found' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'non-existent-agent',
                    memory_id: 'passage-123',
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Agent not found when listing passages: non-existent-agent',
            );
        });

        it('should handle 404 during PATCH update', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-123';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });

            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { error: 'Passage not found' },
            };
            mockServer.api.patch.mockRejectedValueOnce(error);

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('Agent or Passage not found during update'),
            );
        });

        it('should handle 422 validation error', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-123';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });

            const error = new Error('Validation error');
            error.response = {
                status: 422,
                data: {
                    detail: 'Text exceeds maximum length',
                    errors: { text: ['Too long'] },
                },
            };
            mockServer.api.patch.mockRejectedValueOnce(error);

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'X'.repeat(100000) },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('Validation error modifying passage'),
            );
        });

        it('should handle generic API errors', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-123';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });

            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { error: 'Database error' },
            };
            mockServer.api.patch.mockRejectedValueOnce(error);

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle network errors', async () => {
            const error = new Error('Network error: Connection refused');
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: 'agent-123',
                    memory_id: 'passage-123',
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('Failed to fetch passages'),
            );
        });
    });

    describe('Edge Cases', () => {
        it('should handle null args', async () => {
            await expect(handleModifyPassage(mockServer, null)).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle non-array response from list', async () => {
            const agentId = 'agent-123';
            const memoryId = 'passage-123';

            // API returns non-array
            mockServer.api.get.mockResolvedValueOnce({
                data: { invalid: 'response' },
            });

            await expect(
                handleModifyPassage(mockServer, {
                    agent_id: agentId,
                    memory_id: memoryId,
                    update_data: { text: 'New text' },
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining(`Could not find passage ${memoryId}`),
            );
        });

        it('should handle UUID format IDs', async () => {
            const agentId = '550e8400-e29b-41d4-a716-446655440000';
            const memoryId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

            const existingPassage = {
                id: memoryId,
                text: 'UUID passage',
                embedding: [0.1],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({ data: [existingPassage] });

            await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated UUID passage' },
            });

            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory/${memoryId}`,
                expect.any(Object),
                expect.any(Object),
            );
        });

        it('should handle passages with null embeddings', async () => {
            const agentId = 'agent-null';
            const memoryId = 'passage-null';

            const existingPassage = {
                id: memoryId,
                text: 'Original',
                embedding: null,
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: [existingPassage] });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...existingPassage, text: 'Updated' }],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated' },
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toBeNull();
        });

        it('should handle very large passage lists when searching', async () => {
            const agentId = 'agent-large';
            const memoryId = 'target-passage';

            // Create 1000 passages
            const manyPassages = Array.from({ length: 1000 }, (_, i) => ({
                id: `passage-${i}`,
                text: `Passage ${i}`,
                embedding: [i * 0.001],
                embedding_config: { model: 'ada' },
            }));

            // Add target passage in the middle
            manyPassages[500] = {
                id: memoryId,
                text: 'Target passage',
                embedding: [0.5],
                embedding_config: { model: 'ada' },
            };

            mockServer.api.get.mockResolvedValueOnce({ data: manyPassages });
            mockServer.api.patch.mockResolvedValueOnce({
                data: [{ ...manyPassages[500], text: 'Updated target' }],
            });

            const result = await handleModifyPassage(mockServer, {
                agent_id: agentId,
                memory_id: memoryId,
                update_data: { text: 'Updated target' },
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe('Updated target');
        });
    });
});
