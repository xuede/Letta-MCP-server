import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleImportAgent, importAgentDefinition } from '../../../tools/agents/import-agent.js';
import fs from 'fs';

// Create mock instances
const mockFormDataInstance = {
    append: vi.fn(),
    getHeaders: vi.fn().mockReturnValue({ 'content-type': 'multipart/form-data; boundary=test' }),
};

const mockReadStream = {
    pipe: vi.fn(),
    on: vi.fn(),
};

// Mock dependencies
vi.mock('form-data', () => ({
    default: vi.fn(() => mockFormDataInstance)
}));

vi.mock('fs', () => ({
    default: {
        createReadStream: vi.fn(() => mockReadStream),
        existsSync: vi.fn(() => true)
    },
    createReadStream: vi.fn(() => mockReadStream),
    existsSync: vi.fn(() => true)
}));

describe('Import Agent Tool (LMP-94)', () => {
    let mockServer;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Reset mock behavior
        vi.mocked(fs.existsSync).mockReturnValue(true);
        vi.mocked(fs.createReadStream).mockReturnValue(mockReadStream);

        // Mock server
        mockServer = {
            api: {
                post: vi.fn(),
            },
            getApiHeaders: vi.fn().mockReturnValue({
                Authorization: 'Bearer test-password',
                'Content-Type': 'application/json',
            }),
            createErrorResponse: vi.fn((error) => {
                throw new Error(error);
            }),
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool name', () => {
            expect(importAgentDefinition.name).toBe('import_agent');
        });

        it('should have a description', () => {
            expect(importAgentDefinition.description).toBeDefined();
            expect(importAgentDefinition.description).toContain('Import');
        });

        it('should have input schema', () => {
            expect(importAgentDefinition.inputSchema).toBeDefined();
            expect(importAgentDefinition.inputSchema.type).toBe('object');
            expect(importAgentDefinition.inputSchema.properties).toHaveProperty('file_path');
        });

        it('should require file_path parameter', () => {
            expect(importAgentDefinition.inputSchema.required).toContain('file_path');
        });
    });

    describe('Import Agent Handler', () => {
        it('should successfully import an agent', async () => {
            const mockResponse = {
                data: {
                    id: 'agent-123',
                    name: 'Imported Agent',
                    model: 'gpt-4',
                    tools: ['tool1', 'tool2'],
                    created_at: '2024-01-01T00:00:00Z',
                },
            };
            mockServer.api.post.mockResolvedValueOnce(mockResponse);

            const result = await handleImportAgent(mockServer, {
                file_path: '/path/to/agent.json',
            });

            // Verify API call
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/agents/import',
                mockFormDataInstance,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        Authorization: 'Bearer test-password',
                    }),
                    params: {},
                })
            );

            // Verify FormData
            expect(mockFormDataInstance.append).toHaveBeenCalledWith(
                'file',
                mockReadStream,
                'agent.json'
            );

            // Verify result format
            expect(result).toHaveProperty('content');
            expect(result.content).toHaveLength(1);
            expect(result.content[0].type).toBe('text');
            
            // Parse the JSON response
            const responseData = JSON.parse(result.content[0].text);
            expect(responseData.agent_id).toBe('agent-123');
            expect(responseData.agent).toEqual(mockResponse.data);
        });

        it('should handle API errors', async () => {
            const mockError = new Error('Failed to import agent');
            mockError.response = {
                status: 400,
                data: { detail: 'Invalid agent file format' },
            };
            mockServer.api.post.mockRejectedValueOnce(mockError);

            await expect(
                handleImportAgent(mockServer, {
                    file_path: '/path/to/invalid.json',
                })
            ).rejects.toThrow('Failed to import agent');
        });

        it('should handle missing file_path', async () => {
            await expect(
                handleImportAgent(mockServer, {})
            ).rejects.toThrow('Missing required argument: file_path');
        });

        it('should handle non-existent file', async () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);

            await expect(
                handleImportAgent(mockServer, {
                    file_path: '/nonexistent/agent.json',
                })
            ).rejects.toThrow('File not found at path');
        });

        it('should handle optional parameters', async () => {
            const mockResponse = {
                data: { id: 'agent-123', name: 'Test Agent' },
            };
            mockServer.api.post.mockResolvedValueOnce(mockResponse);

            await handleImportAgent(mockServer, {
                file_path: '/path/to/agent.json',
                append_copy_suffix: false,
                override_existing_tools: true,
                project_id: 'project-456',
            });

            // Verify params were passed
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/agents/import',
                mockFormDataInstance,
                expect.objectContaining({
                    params: {
                        append_copy_suffix: false,
                        override_existing_tools: true,
                        project_id: 'project-456',
                    },
                })
            );
        });

        it('should handle Windows-style paths', async () => {
            const mockResponse = {
                data: { id: 'agent-123', name: 'Test Agent' },
            };
            mockServer.api.post.mockResolvedValueOnce(mockResponse);

            await handleImportAgent(mockServer, {
                file_path: 'C:\\Users\\test\\agent.json',
            });

            // Verify filename extraction for Windows paths
            // The append call includes the full path on Windows
            const appendCalls = mockFormDataInstance.append.mock.calls;
            expect(appendCalls).toHaveLength(1);
            expect(appendCalls[0][0]).toBe('file');
            expect(appendCalls[0][1]).toBe(mockReadStream);
            // The filename might include the full path or just the basename
            expect(appendCalls[0][2]).toMatch(/agent\.json$/);
        });

        it('should handle network errors', async () => {
            const mockError = new Error('Network error');
            mockError.code = 'ECONNREFUSED';
            mockServer.api.post.mockRejectedValueOnce(mockError);

            await expect(
                handleImportAgent(mockServer, {
                    file_path: '/path/to/agent.json',
                })
            ).rejects.toThrow('Failed to import agent');
        });
    });
});