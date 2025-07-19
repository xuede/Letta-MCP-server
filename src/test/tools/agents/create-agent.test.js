import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    handleCreateAgent,
    createAgentToolDefinition,
} from '../../../tools/agents/create-agent.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Create Agent', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(createAgentToolDefinition.name).toBe('create_agent');
            expect(createAgentToolDefinition.description).toContain('Create a new Letta agent');
            expect(createAgentToolDefinition.inputSchema.required).toEqual(['name', 'description']);
            expect(createAgentToolDefinition.inputSchema.properties).toHaveProperty('name');
            expect(createAgentToolDefinition.inputSchema.properties).toHaveProperty('description');
            expect(createAgentToolDefinition.inputSchema.properties).toHaveProperty('model');
            expect(createAgentToolDefinition.inputSchema.properties).toHaveProperty('embedding');
        });

        it('should have correct default values', () => {
            expect(createAgentToolDefinition.inputSchema.properties.model.default).toBe(
                'openai/gpt-4',
            );
            expect(createAgentToolDefinition.inputSchema.properties.embedding.default).toBe(
                'openai/text-embedding-ada-002',
            );
        });
    });

    describe('Functionality Tests', () => {
        it('should create agent successfully with minimal args', async () => {
            const createdAgent = { ...fixtures.agent.basic, id: 'new-agent-123' };
            const agentWithTools = {
                ...createdAgent,
                tools: [{ name: 'tool1' }, { name: 'tool2' }],
            };

            // Mock successful agent creation
            mockServer.api.post.mockResolvedValueOnce({ data: createdAgent });
            mockServer.api.get.mockResolvedValueOnce({ data: agentWithTools });

            const result = await handleCreateAgent(mockServer, {
                name: 'Test Agent',
                description: 'A test agent for unit tests',
            });

            // Verify API calls
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    name: 'Test Agent',
                    description: 'A test agent for unit tests',
                    agent_type: 'memgpt_agent',
                    model: 'openai/gpt-4',
                    embedding: 'openai/text-embedding-ada-002',
                }),
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/new-agent-123',
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('new-agent-123');
            expect(data.capabilities).toEqual(['tool1', 'tool2']);
        });

        it('should create agent with custom model and embedding', async () => {
            const createdAgent = { ...fixtures.agent.basic, id: 'custom-agent-123' };

            mockServer.api.post.mockResolvedValueOnce({ data: createdAgent });
            mockServer.api.get.mockResolvedValueOnce({ data: createdAgent });

            const result = await handleCreateAgent(mockServer, {
                name: 'Custom Model Agent',
                description: 'An agent with custom models',
                model: 'anthropic/claude-3',
                embedding: 'openai/text-embedding-3-large',
            });

            // Verify custom model configuration
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    model: 'anthropic/claude-3',
                    embedding: 'openai/text-embedding-3-large',
                    llm_config: expect.objectContaining({
                        model: 'claude-3',
                        model_endpoint_type: 'anthropic',
                    }),
                }),
                expect.any(Object),
            );

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('custom-agent-123');
        });

        it('should handle agent without tools', async () => {
            const agentWithoutTools = {
                ...fixtures.agent.basic,
                id: 'no-tools-agent',
                tools: undefined,
            };

            mockServer.api.post.mockResolvedValueOnce({ data: agentWithoutTools });
            mockServer.api.get.mockResolvedValueOnce({ data: agentWithoutTools });

            const result = await handleCreateAgent(mockServer, {
                name: 'No Tools Agent',
                description: 'An agent without tools',
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('no-tools-agent');
            expect(data.capabilities).toEqual([]);
        });

        it('should include user_id header when retrieving agent info', async () => {
            const createdAgent = { ...fixtures.agent.basic, id: 'header-test-agent' };

            mockServer.api.post.mockResolvedValueOnce({ data: createdAgent });
            mockServer.api.get.mockResolvedValueOnce({ data: createdAgent });

            await handleCreateAgent(mockServer, {
                name: 'Header Test Agent',
                description: 'Testing headers',
            });

            // Verify that get request includes user_id header
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/header-test-agent',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        user_id: 'header-test-agent',
                    }),
                }),
            );
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing name', async () => {
            await expect(
                handleCreateAgent(mockServer, {
                    description: 'Missing name',
                }),
            ).rejects.toThrow('Invalid arguments: name and description must be strings');
        });

        it('should throw error for missing description', async () => {
            await expect(
                handleCreateAgent(mockServer, {
                    name: 'Missing Description',
                }),
            ).rejects.toThrow('Invalid arguments: name and description must be strings');
        });

        it('should throw error for non-string name', async () => {
            await expect(
                handleCreateAgent(mockServer, {
                    name: 123,
                    description: 'Valid description',
                }),
            ).rejects.toThrow('Invalid arguments: name and description must be strings');
        });

        it('should throw error for non-string description', async () => {
            await expect(
                handleCreateAgent(mockServer, {
                    name: 'Valid name',
                    description: { invalid: 'description' },
                }),
            ).rejects.toThrow('Invalid arguments: name and description must be strings');
        });

        it('should handle API error during agent creation', async () => {
            const error = new Error('Server error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.post.mockRejectedValueOnce(error);

            await expect(
                handleCreateAgent(mockServer, {
                    name: 'Failed Agent',
                    description: 'This will fail',
                }),
            ).rejects.toThrow('Server error');
        });

        it('should handle API error when retrieving agent info', async () => {
            const createdAgent = { ...fixtures.agent.basic, id: 'error-agent' };
            mockServer.api.post.mockResolvedValueOnce({ data: createdAgent });

            const error = new Error('Failed to retrieve agent');
            error.response = { status: 404 };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(
                handleCreateAgent(mockServer, {
                    name: 'Retrieve Error Agent',
                    description: 'Will fail on retrieval',
                }),
            ).rejects.toThrow('Failed to retrieve agent');
        });
    });

    describe('Agent Configuration', () => {
        it('should create agent with correct llm_config structure', async () => {
            const createdAgent = { ...fixtures.agent.basic, id: 'config-test-agent' };

            mockServer.api.post.mockResolvedValueOnce({ data: createdAgent });
            mockServer.api.get.mockResolvedValueOnce({ data: createdAgent });

            await handleCreateAgent(mockServer, {
                name: 'Config Test Agent',
                description: 'Testing configuration',
                model: 'openai/gpt-4-turbo',
            });

            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({
                    llm_config: {
                        model: 'gpt-4-turbo',
                        model_endpoint_type: 'openai',
                        context_window: 16000,
                        max_tokens: 1000,
                        temperature: 0.7,
                        frequency_penalty: 0.5,
                        presence_penalty: 0.5,
                        functions_config: {
                            allow: true,
                            functions: [],
                        },
                    },
                    parameters: {
                        context_window: 16000,
                        max_tokens: 1000,
                        temperature: 0.7,
                        presence_penalty: 0.5,
                        frequency_penalty: 0.5,
                    },
                }),
                expect.any(Object),
            );
        });
    });
});
