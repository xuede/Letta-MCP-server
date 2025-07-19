import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleCreatePassage,
    createPassageDefinition,
} from '../../../tools/passages/create-passage.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Create Passage', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(createPassageDefinition.name).toBe('create_passage');
            expect(createPassageDefinition.description).toContain(
                'Insert a memory into an agent\'s archival memory',
            );
            expect(createPassageDefinition.inputSchema.required).toEqual(['agent_id', 'text']);
            expect(createPassageDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(createPassageDefinition.inputSchema.properties).toHaveProperty('text');
            expect(createPassageDefinition.inputSchema.properties).toHaveProperty(
                'include_embeddings',
            );
            expect(createPassageDefinition.inputSchema.properties.include_embeddings.default).toBe(
                false,
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should create passage successfully without embeddings', async () => {
            const agentId = 'agent-123';
            const passageText = 'This is an important memory to store in archival memory.';

            const createdPassages = [
                {
                    id: 'passage-123',
                    text: passageText,
                    embedding: [0.1, 0.2, 0.3, 0.4], // Will be removed
                    metadata: {
                        source: 'user',
                        created_at: '2024-01-01T00:00:00Z',
                    },
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            // Verify API call
            expect(mockServer.api.post).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                { text: passageText },
                expect.objectContaining({
                    headers: expect.any(Object),
                }),
            );

            // Verify response - embeddings should be removed by default
            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(1);
            expect(data.passages[0].id).toBe('passage-123');
            expect(data.passages[0].text).toBe(passageText);
            expect(data.passages[0].embedding).toBeUndefined();
            expect(data.passages[0].metadata).toEqual({
                source: 'user',
                created_at: '2024-01-01T00:00:00Z',
            });
        });

        it('should create passage with embeddings when requested', async () => {
            const agentId = 'agent-456';
            const passageText = 'Another important memory with embeddings.';
            const embeddings = [0.1, 0.2, 0.3, 0.4, 0.5];

            const createdPassages = [
                {
                    id: 'passage-456',
                    text: passageText,
                    embedding: embeddings,
                    metadata: {},
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
                include_embeddings: true,
            });

            // Verify embeddings are included
            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toEqual(embeddings);
        });

        it('should handle multiple passages returned from API', async () => {
            const agentId = 'agent-multi';
            const passageText = 'This text might be split into multiple passages.';

            const createdPassages = [
                {
                    id: 'passage-1',
                    text: 'This text might be split',
                    embedding: [0.1, 0.2],
                },
                {
                    id: 'passage-2',
                    text: 'into multiple passages.',
                    embedding: [0.3, 0.4],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(2);
            expect(data.passages[0].id).toBe('passage-1');
            expect(data.passages[1].id).toBe('passage-2');
            // Embeddings should be removed by default
            expect(data.passages[0].embedding).toBeUndefined();
            expect(data.passages[1].embedding).toBeUndefined();
        });

        it('should handle very long passage text', async () => {
            const agentId = 'agent-long';
            const longText = 'A'.repeat(10000); // 10k characters

            const createdPassages = [
                {
                    id: 'long-passage',
                    text: longText,
                    embedding: new Array(1536).fill(0.1), // Large embedding vector
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: longText,
            });

            expect(mockServer.api.post).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                { text: longText },
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(longText);
            expect(data.passages[0].embedding).toBeUndefined();
        });

        it('should handle passages with complex metadata', async () => {
            const agentId = 'agent-metadata';
            const passageText = 'Passage with rich metadata';

            const createdPassages = [
                {
                    id: 'metadata-passage',
                    text: passageText,
                    embedding: [0.1, 0.2],
                    metadata: {
                        source: 'api',
                        user_id: 'user-123',
                        tags: ['important', 'reference'],
                        context: {
                            conversation_id: 'conv-456',
                            turn_number: 5,
                        },
                        timestamp: '2024-01-01T12:00:00Z',
                    },
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].metadata).toEqual({
                source: 'api',
                user_id: 'user-123',
                tags: ['important', 'reference'],
                context: {
                    conversation_id: 'conv-456',
                    turn_number: 5,
                },
                timestamp: '2024-01-01T12:00:00Z',
            });
        });

        it('should handle special characters in passage text', async () => {
            const agentId = 'agent-special';
            const specialText = 'Special chars: \n\t"quotes" \'apostrophes\' & symbols < > {} 🚀💬';

            const createdPassages = [
                {
                    id: 'special-passage',
                    text: specialText,
                    embedding: [0.1],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: specialText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(specialText);
        });

        it('should handle passages without metadata', async () => {
            const agentId = 'agent-no-meta';
            const passageText = 'Simple passage without metadata';

            const createdPassages = [
                {
                    id: 'no-meta-passage',
                    text: passageText,
                    embedding: [0.1],
                    // No metadata field
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].metadata).toBeUndefined();
        });

        it('should handle empty passage text', async () => {
            const agentId = 'agent-empty';
            const emptyText = '';

            const createdPassages = [
                {
                    id: 'empty-passage',
                    text: emptyText,
                    embedding: [],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: emptyText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe('');
        });

        it('should explicitly handle include_embeddings false', async () => {
            const agentId = 'agent-no-embed';
            const passageText = 'Explicitly no embeddings';

            const createdPassages = [
                {
                    id: 'no-embed-passage',
                    text: passageText,
                    embedding: [0.1, 0.2, 0.3],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
                include_embeddings: false,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing agent_id', async () => {
            await expect(
                handleCreatePassage(mockServer, {
                    text: 'Some text',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle missing text', async () => {
            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: text',
            );
        });

        it('should handle null args', async () => {
            await expect(handleCreatePassage(mockServer, null)).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle 404 agent not found error', async () => {
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { error: 'Agent not found' },
            };
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'non-existent-agent',
                    text: 'Some text',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Agent not found: non-existent-agent',
            );
        });

        it('should handle 422 validation error', async () => {
            const validationDetails = {
                text: ['Text exceeds maximum length'],
                embedding_model: ['Invalid embedding model'],
            };

            const error = new Error('Validation error');
            error.response = {
                status: 422,
                data: validationDetails,
            };
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'agent-123',
                    text: 'Invalid text',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.stringContaining('Validation error creating passage'),
            );
        });

        it('should handle generic API errors', async () => {
            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { error: 'Database error' },
            };
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'agent-123',
                    text: 'Some text',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle network errors without response', async () => {
            const error = new Error('Network error: Connection refused');
            // No response property
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'agent-123',
                    text: 'Some text',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle malformed API response', async () => {
            // API returns non-array data
            mockServer.api.post.mockResolvedValueOnce({
                data: { invalid: 'response' },
            });

            await expect(
                handleCreatePassage(mockServer, {
                    agent_id: 'agent-123',
                    text: 'Some text',
                }),
            ).rejects.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle UUID format agent IDs', async () => {
            const agentId = '550e8400-e29b-41d4-a716-446655440000';
            const passageText = 'UUID agent passage';

            const createdPassages = [
                {
                    id: 'uuid-passage',
                    text: passageText,
                    embedding: [0.1],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            expect(mockServer.api.post).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                { text: passageText },
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(passageText);
        });

        it('should handle agent IDs with special characters that need encoding', async () => {
            const agentId = 'agent@special#id';
            const encodedAgentId = encodeURIComponent(agentId);
            const passageText = 'Special agent passage';

            const createdPassages = [
                {
                    id: 'encoded-passage',
                    text: passageText,
                    embedding: [0.1],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
            });

            expect(mockServer.api.post).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory`,
                { text: passageText },
                expect.any(Object),
            );
        });

        it('should handle passages with null embedding vectors', async () => {
            const agentId = 'agent-null-embed';
            const passageText = 'Passage with null embeddings';

            const createdPassages = [
                {
                    id: 'null-embed-passage',
                    text: passageText,
                    embedding: null,
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toBeNull();
        });

        it('should handle passages with very large embedding vectors', async () => {
            const agentId = 'agent-large-embed';
            const passageText = 'Passage with large embeddings';
            const largeEmbedding = new Array(3072).fill(0.1); // Very large embedding

            const createdPassages = [
                {
                    id: 'large-embed-passage',
                    text: passageText,
                    embedding: largeEmbedding,
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: passageText,
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toHaveLength(3072);
        });

        it('should handle multiline text passages', async () => {
            const agentId = 'agent-multiline';
            const multilineText = `Line 1: Introduction
Line 2: Main content
Line 3: Additional details

Line 5: After blank line
\tLine 6: With tab
  Line 7: With spaces`;

            const createdPassages = [
                {
                    id: 'multiline-passage',
                    text: multilineText,
                    embedding: [0.1],
                },
            ];

            mockServer.api.post.mockResolvedValueOnce({ data: createdPassages });

            const result = await handleCreatePassage(mockServer, {
                agent_id: agentId,
                text: multilineText,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].text).toBe(multilineText);
        });
    });
});
