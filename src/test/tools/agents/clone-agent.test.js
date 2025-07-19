import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleCloneAgent, cloneAgentDefinition } from '../../../tools/agents/clone-agent.js';
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

// Mock path module to mimic actual path.join behavior
vi.mock('path', () => ({
    default: {
        join: vi.fn((...args) => {
            // Simply join all arguments with /
            return args.filter(Boolean).join('/');
        }),
        basename: vi.fn((p) => p.split('/').pop()),
    },
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
    default: {
        writeFile: vi.fn().mockResolvedValue(undefined),
        readFile: vi.fn().mockResolvedValue(Buffer.from('{"test": "data"}')),
        unlink: vi.fn().mockResolvedValue(undefined),
    },
}));

// Mock os
vi.mock('os', () => ({
    default: {
        tmpdir: vi.fn(() => '/tmp'),
    },
}));

// Create a mock FormData instance
const mockFormDataInstance = {
    append: vi.fn(),
    getHeaders: vi.fn().mockReturnValue({ 'content-type': 'multipart/form-data; boundary=test' }),
};

// Mock form-data
vi.mock('form-data', () => ({
    default: vi.fn(() => mockFormDataInstance),
}));

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import FormData from 'form-data';

describe('Clone Agent', () => {
    let mockServer;
    let mockApi;

    beforeEach(() => {
        mockServer = createMockLettaServer();
        mockApi = mockServer.api;

        // Clear all mocks
        vi.clearAllMocks();
        mockFormDataInstance.append.mockClear();
        mockFormDataInstance.getHeaders.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(cloneAgentDefinition).toMatchObject({
                name: 'clone_agent',
                description: expect.stringContaining('Creates a new agent by cloning'),
                inputSchema: {
                    type: 'object',
                    properties: {
                        source_agent_id: {
                            type: 'string',
                            description: expect.any(String),
                        },
                        new_agent_name: {
                            type: 'string',
                            description: expect.any(String),
                        },
                        override_existing_tools: {
                            type: 'boolean',
                            description: expect.any(String),
                            default: true,
                        },
                        project_id: {
                            type: 'string',
                            description: expect.any(String),
                        },
                    },
                    required: ['source_agent_id', 'new_agent_name'],
                },
            });
        });
    });

    describe('Functionality Tests', () => {
        it('should clone agent successfully', async () => {
            const sourceAgentId = 'agent-123';
            const newAgentName = 'Cloned Agent';

            // Mock export response
            const exportedConfig = {
                name: 'Original Agent',
                system: 'You are a helpful assistant',
                llm_config: { model: 'gpt-4' },
                tools: ['tool1', 'tool2'],
            };

            mockApi.get.mockImplementationOnce((url) => {
                if (url === `/agents/${sourceAgentId}/export`) {
                    return Promise.resolve({ status: 200, data: exportedConfig });
                }
            });

            // Mock import response
            const importedAgent = {
                id: 'new-agent-456',
                name: newAgentName,
                system: 'You are a helpful assistant',
                llm_config: { model: 'gpt-4' },
            };

            mockApi.post.mockImplementationOnce((url, data, config) => {
                if (url === '/agents/import') {
                    // Verify FormData was used
                    expect(data).toBe(mockFormDataInstance);
                    expect(config.params.append_copy_suffix).toBe(false);
                    expect(config.params.override_existing_tools).toBe(true);
                    return Promise.resolve({ status: 200, data: importedAgent });
                }
            });

            const result = await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
            });

            const parsedResult = expectValidToolResponse(result);
            expect(parsedResult.new_agent).toMatchObject({
                id: 'new-agent-456',
                name: newAgentName,
            });

            // Verify file operations
            expect(fs.writeFile).toHaveBeenCalled();
            expect(fs.readFile).toHaveBeenCalled();
            expect(fs.unlink).toHaveBeenCalledTimes(1); // Cleanup called once

            // Verify API calls
            expect(mockApi.get).toHaveBeenCalledWith(
                `/agents/${sourceAgentId}/export`,
                expect.any(Object),
            );
            expect(mockApi.post).toHaveBeenCalledWith(
                '/agents/import',
                mockFormDataInstance,
                expect.any(Object),
            );
        });

        it('should clone agent with project ID', async () => {
            const sourceAgentId = 'agent-123';
            const newAgentName = 'Cloned Agent';
            const projectId = 'proj-456';

            // Mock export response
            const exportedConfig = {
                name: 'Original Agent',
                system: 'You are a helpful assistant',
            };

            mockApi.get.mockResolvedValueOnce({ status: 200, data: exportedConfig });

            // Mock import response
            const importedAgent = {
                id: 'new-agent-789',
                name: newAgentName,
                project_id: projectId,
            };

            mockApi.post.mockImplementationOnce((url, data, config) => {
                if (url === '/agents/import') {
                    // Verify project_id was passed
                    expect(config.params.project_id).toBe(projectId);
                    return Promise.resolve({ status: 200, data: importedAgent });
                }
            });

            const result = await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
                project_id: projectId,
            });

            const parsedResult = expectValidToolResponse(result);
            expect(parsedResult.new_agent.project_id).toBe(projectId);
        });

        it('should clone agent with override_existing_tools=false', async () => {
            const sourceAgentId = 'agent-123';
            const newAgentName = 'Cloned Agent';

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { name: 'Original' },
            });

            mockApi.post.mockImplementationOnce((url, data, config) => {
                if (url === '/agents/import') {
                    // Verify override_existing_tools was set to false
                    expect(config.params.override_existing_tools).toBe(false);
                    return Promise.resolve({
                        status: 200,
                        data: { id: 'new-agent', name: newAgentName },
                    });
                }
            });

            await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
                override_existing_tools: false,
            });
        });

        it('should handle special characters in agent ID', async () => {
            const sourceAgentId = 'agent with spaces & symbols';
            const encodedId = encodeURIComponent(sourceAgentId);
            const newAgentName = 'Cloned Agent';

            mockApi.get.mockImplementationOnce((url) => {
                if (url === `/agents/${encodedId}/export`) {
                    return Promise.resolve({
                        status: 200,
                        data: { name: 'Original' },
                    });
                }
            });

            mockApi.post.mockResolvedValueOnce({
                status: 200,
                data: { id: 'new-agent', name: newAgentName },
            });

            await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
            });

            // Verify URL was properly encoded
            expect(mockApi.get).toHaveBeenCalledWith(
                `/agents/${encodedId}/export`,
                expect.any(Object),
            );
        });

        it('should handle temporary file with timestamp', async () => {
            const sourceAgentId = 'agent-123';
            const newAgentName = 'Cloned Agent';

            // Mock Date.now to verify timestamp in filename
            const mockTimestamp = 1234567890;
            vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { name: 'Original' },
            });

            mockApi.post.mockResolvedValueOnce({
                status: 200,
                data: { id: 'new-agent', name: newAgentName },
            });

            await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
            });

            // Get the actual path used
            const actualPath = fs.writeFile.mock.calls[0][0];

            // Verify it contains the timestamp
            expect(actualPath).toContain(`agent_clone_temp_${mockTimestamp}.json`);
            expect(fs.unlink).toHaveBeenCalledWith(actualPath);
        });

        it('should save formatted JSON config', async () => {
            const sourceAgentId = 'agent-123';
            const newAgentName = 'Cloned Agent';
            const exportedConfig = {
                name: 'Original Agent',
                system: 'Test system',
            };

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: exportedConfig,
            });

            mockApi.post.mockResolvedValueOnce({
                status: 200,
                data: { id: 'new-agent', name: newAgentName },
            });

            await handleCloneAgent(mockServer, {
                source_agent_id: sourceAgentId,
                new_agent_name: newAgentName,
            });

            // Verify JSON was formatted with 2-space indentation
            const expectedJson = JSON.stringify({ ...exportedConfig, name: newAgentName }, null, 2);
            expect(fs.writeFile).toHaveBeenCalledWith(expect.any(String), expectedJson);
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing source_agent_id', async () => {
            await expect(handleCloneAgent(mockServer, { new_agent_name: 'Test' })).rejects.toThrow(
                'Missing required argument: source_agent_id',
            );

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: '',
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Missing required argument: source_agent_id');
        });

        it('should throw error for missing new_agent_name', async () => {
            await expect(
                handleCloneAgent(mockServer, { source_agent_id: 'agent-123' }),
            ).rejects.toThrow('Missing required argument: new_agent_name');

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: 'agent-123',
                    new_agent_name: '',
                }),
            ).rejects.toThrow('Missing required argument: new_agent_name');
        });

        it('should handle 404 error on export', async () => {
            const sourceAgentId = 'non-existent';

            mockApi.get.mockRejectedValueOnce({
                response: {
                    status: 404,
                    data: { error: 'Agent not found' },
                },
                config: { url: '/agents/non-existent/export' },
            });

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow(`Source agent not found: ${sourceAgentId}`);

            // No cleanup needed - temp file was never created
            expect(fs.unlink).not.toHaveBeenCalled();
        });

        it('should handle validation error on import', async () => {
            const sourceAgentId = 'agent-123';

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { name: 'Original' },
            });

            const validationError = {
                error: 'Invalid agent configuration',
                details: ['missing required field'],
            };

            mockApi.post.mockRejectedValueOnce({
                response: {
                    status: 422,
                    data: validationError,
                },
                config: { url: '/agents/import' },
            });

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow(
                `Validation error importing cloned agent: ${JSON.stringify(validationError)}`,
            );

            // Verify cleanup was called
            expect(fs.unlink).toHaveBeenCalled();
        });

        it('should handle invalid export data', async () => {
            const sourceAgentId = 'agent-123';

            // Mock export returning invalid data
            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: null, // Invalid response
            });

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Received invalid data from agent export endpoint.');
        });

        it('should handle file write errors', async () => {
            const sourceAgentId = 'agent-123';

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { name: 'Original' },
            });

            // Mock file write failure
            fs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Failed to clone agent agent-123: Disk full');
        });

        it('should handle cleanup errors gracefully', async () => {
            const sourceAgentId = 'agent-123';

            mockApi.get.mockRejectedValueOnce(new Error('Export failed'));

            // Mock cleanup failure
            fs.unlink.mockRejectedValueOnce(new Error('File not found'));

            // Should still throw the original error, not the cleanup error
            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Failed to clone agent agent-123: Export failed');
        });

        it('should handle network errors', async () => {
            const sourceAgentId = 'agent-123';

            mockApi.get.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Failed to clone agent agent-123: Network timeout');

            // No cleanup needed - temp file was never created
            expect(fs.unlink).not.toHaveBeenCalled();
        });

        it('should clean up temp file even after import error', async () => {
            const sourceAgentId = 'agent-123';
            const mockTimestamp = 1234567890;
            vi.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

            mockApi.get.mockResolvedValueOnce({
                status: 200,
                data: { name: 'Original' },
            });

            // Mock import failure
            mockApi.post.mockRejectedValueOnce(new Error('Import failed'));

            await expect(
                handleCloneAgent(mockServer, {
                    source_agent_id: sourceAgentId,
                    new_agent_name: 'Test',
                }),
            ).rejects.toThrow('Failed to clone agent agent-123: Import failed');

            // Verify cleanup was called
            const actualPath = fs.unlink.mock.calls[0][0];
            expect(actualPath).toContain(`agent_clone_temp_${mockTimestamp}.json`);
        });
    });
});
