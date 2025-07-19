import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleListPassages,
    listPassagesDefinition,
} from '../../../tools/passages/list-passages.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('List Passages', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(listPassagesDefinition.name).toBe('list_passages');
            expect(listPassagesDefinition.description).toContain(
                'Retrieve the memories in an agent\'s archival memory',
            );
            expect(listPassagesDefinition.inputSchema.required).toEqual(['agent_id']);
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('after');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('before');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('limit');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('search');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty('ascending');
            expect(listPassagesDefinition.inputSchema.properties).toHaveProperty(
                'include_embeddings',
            );
            expect(listPassagesDefinition.inputSchema.properties.ascending.default).toBe(true);
            expect(listPassagesDefinition.inputSchema.properties.include_embeddings.default).toBe(
                false,
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should list passages without embeddings by default', async () => {
            const agentId = 'agent-123';
            const mockPassages = [
                {
                    id: 'passage-1',
                    text: 'First memory in archival storage',
                    embedding: [0.1, 0.2, 0.3],
                    metadata: { created_at: '2024-01-01T00:00:00Z' },
                },
                {
                    id: 'passage-2',
                    text: 'Second memory in archival storage',
                    embedding: [0.4, 0.5, 0.6],
                    metadata: { created_at: '2024-01-02T00:00:00Z' },
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    headers: expect.any(Object),
                    params: {},
                }),
            );

            // Verify embeddings are removed by default
            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(2);
            expect(data.passages[0].id).toBe('passage-1');
            expect(data.passages[0].text).toBe('First memory in archival storage');
            expect(data.passages[0].embedding).toBeUndefined();
            expect(data.passages[0].metadata).toEqual({ created_at: '2024-01-01T00:00:00Z' });
            expect(data.passages[1].embedding).toBeUndefined();
        });

        it('should include embeddings when requested', async () => {
            const agentId = 'agent-456';
            const mockPassages = [
                {
                    id: 'passage-embed',
                    text: 'Memory with embeddings',
                    embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
                    metadata: {},
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
        });

        it('should handle pagination with after parameter', async () => {
            const agentId = 'agent-page';
            const afterId = 'passage-100';
            const mockPassages = [
                { id: 'passage-101', text: 'After passage 100' },
                { id: 'passage-102', text: 'After passage 101' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                after: afterId,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { after: afterId },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].id).toBe('passage-101');
        });

        it('should handle pagination with before parameter', async () => {
            const agentId = 'agent-before';
            const beforeId = 'passage-50';
            const mockPassages = [
                { id: 'passage-48', text: 'Before passage 50' },
                { id: 'passage-49', text: 'Before passage 50' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                before: beforeId,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { before: beforeId },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(2);
        });

        it('should handle limit parameter', async () => {
            const agentId = 'agent-limit';
            const limit = 5;
            const mockPassages = Array.from({ length: 5 }, (_, i) => ({
                id: `passage-${i}`,
                text: `Memory ${i}`,
                embedding: [i * 0.1],
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                limit: limit,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { limit: limit },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(5);
        });

        it('should handle search parameter', async () => {
            const agentId = 'agent-search';
            const searchQuery = 'important memory';
            const mockPassages = [
                { id: 'passage-match-1', text: 'This is an important memory' },
                { id: 'passage-match-2', text: 'Another important memory here' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                search: searchQuery,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { search: searchQuery },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages).toHaveLength(2);
            expect(data.passages[0].text).toContain('important memory');
        });

        it('should handle ascending parameter true', async () => {
            const agentId = 'agent-asc';
            const mockPassages = [
                { id: 'passage-old', text: 'Oldest memory', created_at: '2024-01-01' },
                { id: 'passage-new', text: 'Newest memory', created_at: '2024-01-10' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                ascending: true,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { ascending: true },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].id).toBe('passage-old');
        });

        it('should handle ascending parameter false', async () => {
            const agentId = 'agent-desc';
            const mockPassages = [
                { id: 'passage-new', text: 'Newest memory', created_at: '2024-01-10' },
                { id: 'passage-old', text: 'Oldest memory', created_at: '2024-01-01' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                ascending: false,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { ascending: false },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].id).toBe('passage-new');
        });

        it('should handle all parameters combined', async () => {
            const agentId = 'agent-all';
            const params = {
                after: 'passage-10',
                before: 'passage-20',
                limit: 5,
                search: 'test',
                ascending: false,
                include_embeddings: true,
            };

            const mockPassages = [
                {
                    id: 'passage-15',
                    text: 'Test passage in range',
                    embedding: [0.1, 0.2],
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                ...params,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: {
                        after: params.after,
                        before: params.before,
                        limit: params.limit,
                        search: params.search,
                        ascending: params.ascending,
                    },
                }),
            );

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toEqual([0.1, 0.2]);
        });

        it('should handle empty passage list', async () => {
            const agentId = 'agent-empty';
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages).toEqual([]);
        });

        it('should handle passages without metadata', async () => {
            const agentId = 'agent-no-meta';
            const mockPassages = [
                {
                    id: 'no-meta-passage',
                    text: 'Passage without metadata',
                    embedding: [0.1],
                    // No metadata field
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].metadata).toBeUndefined();
        });

        it('should handle special characters in agent ID', async () => {
            const agentId = 'agent@special#id';
            const encodedAgentId = encodeURIComponent(agentId);

            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${encodedAgentId}/archival-memory`,
                expect.any(Object),
            );
        });

        it('should handle very large embedding vectors', async () => {
            const agentId = 'agent-large-embed';
            const largeEmbedding = new Array(3072).fill(0.1);
            const mockPassages = [
                {
                    id: 'large-embed-passage',
                    text: 'Passage with large embedding',
                    embedding: largeEmbedding,
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toHaveLength(3072);
        });

        it('should explicitly handle include_embeddings false', async () => {
            const agentId = 'agent-no-embed';
            const mockPassages = [
                {
                    id: 'no-embed-passage',
                    text: 'Explicitly no embeddings',
                    embedding: [0.1, 0.2, 0.3],
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                include_embeddings: false,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing agent_id', async () => {
            await expect(handleListPassages(mockServer, {})).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle null args', async () => {
            await expect(handleListPassages(mockServer, null)).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                'Missing required argument: agent_id',
            );
        });

        it('should handle 404 agent not found error', async () => {
            const agentId = 'non-existent-agent';
            const error = new Error('Not found');
            error.response = {
                status: 404,
                data: { error: 'Agent not found' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListPassages(mockServer, {
                    agent_id: agentId,
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                `Agent not found: ${agentId}`,
            );
        });

        it('should handle generic API errors', async () => {
            const error = new Error('Internal server error');
            error.response = {
                status: 500,
                data: { error: 'Database error' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListPassages(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle network errors without response', async () => {
            const error = new Error('Network error: Connection refused');
            // No response property
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListPassages(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle malformed API response', async () => {
            // API returns non-array data
            mockServer.api.get.mockResolvedValueOnce({
                data: { invalid: 'response' },
            });

            await expect(
                handleListPassages(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();
        });

        it('should handle unauthorized access', async () => {
            const error = new Error('Unauthorized');
            error.response = {
                status: 401,
                data: { error: 'Invalid authentication' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListPassages(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });

        it('should handle forbidden access', async () => {
            const error = new Error('Forbidden');
            error.response = {
                status: 403,
                data: { error: 'Access denied to agent passages' },
            };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleListPassages(mockServer, {
                    agent_id: 'agent-123',
                }),
            ).rejects.toThrow();

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(error);
        });
    });

    describe('Edge Cases', () => {
        it('should handle UUID format agent IDs', async () => {
            const agentId = '550e8400-e29b-41d4-a716-446655440000';
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.any(Object),
            );
        });

        it('should handle passages with null embeddings', async () => {
            const agentId = 'agent-null-embed';
            const mockPassages = [
                {
                    id: 'null-embed-passage',
                    text: 'Passage with null embedding',
                    embedding: null,
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
                include_embeddings: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].embedding).toBeNull();
        });

        it('should handle very long search queries', async () => {
            const agentId = 'agent-long-search';
            const longSearch = 'A'.repeat(1000);

            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListPassages(mockServer, {
                agent_id: agentId,
                search: longSearch,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { search: longSearch },
                }),
            );
        });

        it('should handle passages with complex metadata structures', async () => {
            const agentId = 'agent-complex-meta';
            const mockPassages = [
                {
                    id: 'complex-meta-passage',
                    text: 'Passage with complex metadata',
                    embedding: [0.1],
                    metadata: {
                        nested: {
                            level1: {
                                level2: 'deep value',
                            },
                        },
                        arrays: [1, 2, { obj: true }],
                        special_chars: 'Text with "quotes" & symbols',
                        unicode: '🚀 Unicode text 中文',
                    },
                },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: mockPassages });

            const result = await handleListPassages(mockServer, {
                agent_id: agentId,
            });

            const data = expectValidToolResponse(result);
            expect(data.passages[0].metadata.nested.level1.level2).toBe('deep value');
            expect(data.passages[0].metadata.unicode).toBe('🚀 Unicode text 中文');
        });

        it('should handle invalid limit values gracefully', async () => {
            const agentId = 'agent-invalid-limit';

            // Negative limit
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListPassages(mockServer, {
                agent_id: agentId,
                limit: -5,
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: { limit: -5 }, // API should handle validation
                }),
            );
        });

        it('should not include undefined parameters in API call', async () => {
            const agentId = 'agent-undefined';
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            await handleListPassages(mockServer, {
                agent_id: agentId,
                after: undefined,
                before: undefined,
                limit: undefined,
                search: undefined,
                // ascending is undefined, not false
            });

            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}/archival-memory`,
                expect.objectContaining({
                    params: {}, // Empty params object
                }),
            );
        });
    });
});
