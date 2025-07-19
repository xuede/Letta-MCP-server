import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleGetAgentSummary, getAgentSummaryDefinition } from '../../../tools/agents/get-agent-summary.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { mockApiSuccess, mockApiError, expectValidToolResponse } from '../../utils/test-helpers.js';

// Mock the logger
vi.mock('../../../core/logger.js', () => ({
    createLogger: () => ({
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
    })
}));

describe('Get Agent Summary', () => {
    let mockServer;
    let mockApi;

    beforeEach(() => {
        mockServer = createMockLettaServer();
        mockApi = mockServer.api;
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(getAgentSummaryDefinition).toMatchObject({
                name: 'get_agent_summary',
                description: expect.stringContaining('summary of an agent\'s configuration'),
                inputSchema: {
                    type: 'object',
                    properties: {
                        agent_id: {
                            type: 'string',
                            description: expect.any(String)
                        }
                    },
                    required: ['agent_id']
                }
            });
        });
    });

    describe('Functionality Tests', () => {
        it('should get agent summary successfully with all data', async () => {
            const agentId = 'test-agent-123';
            
            // Mock successful responses for all endpoints
            const mockAgent = {
                id: agentId,
                name: 'Test Agent',
                description: 'A test agent',
                system: 'You are a helpful assistant with extensive knowledge.',
                llm_config: {
                    handle: 'gpt-4',
                    model: 'gpt-4',
                    model_endpoint_type: 'openai'
                },
                embedding_config: {
                    handle: 'text-embedding-ada-002',
                    embedding_model: 'text-embedding-ada-002',
                    embedding_endpoint_type: 'openai'
                }
            };

            const mockCoreMemory = [
                { label: 'human', value: 'The user is a software developer interested in AI.' },
                { label: 'persona', value: 'I am a helpful AI assistant with expertise in programming.' }
            ];

            const mockTools = [
                { id: 'tool-1', name: 'calculator', tool_type: 'custom' },
                { id: 'tool-2', name: 'web_search', tool_type: 'mcp' }
            ];

            const mockSources = [
                { id: 'source-1', name: 'documentation.pdf' },
                { id: 'source-2', name: 'knowledge_base.txt' }
            ];

            // Set up all the mock responses
            mockApi.get
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}`) {
                        return Promise.resolve({ status: 200, data: mockAgent });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}/core-memory/blocks`) {
                        return Promise.resolve({ status: 200, data: mockCoreMemory });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}/tools`) {
                        return Promise.resolve({ status: 200, data: mockTools });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}/sources`) {
                        return Promise.resolve({ status: 200, data: mockSources });
                    }
                });

            const result = await handleGetAgentSummary(mockServer, { agent_id: agentId });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult).toMatchObject({
                agent_id: agentId,
                name: 'Test Agent',
                description: 'A test agent',
                system_prompt_snippet: expect.stringContaining('You are a helpful assistant'),
                llm_config: 'gpt-4',
                embedding_config: 'text-embedding-ada-002',
                core_memory_blocks: [
                    { label: 'human', value_snippet: expect.stringContaining('software developer') },
                    { label: 'persona', value_snippet: expect.stringContaining('helpful AI assistant') }
                ],
                attached_tools_count: 2,
                attached_tools: mockTools.map(t => ({ id: t.id, name: t.name, type: t.tool_type })),
                attached_sources_count: 2,
                attached_sources: mockSources.map(s => ({ id: s.id, name: s.name }))
            });

            // Verify all endpoints were called
            expect(mockApi.get).toHaveBeenCalledTimes(4);
            expect(mockApi.get).toHaveBeenCalledWith(`/agents/${agentId}`, expect.any(Object));
            expect(mockApi.get).toHaveBeenCalledWith(`/agents/${agentId}/core-memory/blocks`, expect.any(Object));
            expect(mockApi.get).toHaveBeenCalledWith(`/agents/${agentId}/tools`, expect.any(Object));
            expect(mockApi.get).toHaveBeenCalledWith(`/agents/${agentId}/sources`, expect.any(Object));
        });

        it('should handle missing optional data gracefully', async () => {
            const agentId = 'test-agent-456';
            
            const mockAgent = {
                id: agentId,
                name: 'Minimal Agent',
                description: 'Agent with no extras',
                system: 'Basic system prompt',
                llm_config: {
                    model: 'gpt-3.5-turbo',
                    model_endpoint_type: 'openai'
                },
                embedding_config: {
                    embedding_model: 'text-embedding-ada-002',
                    embedding_endpoint_type: 'openai'
                }
            };

            // Mock agent response success, but failures for optional endpoints
            mockApi.get
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}`) {
                        return Promise.resolve({ status: 200, data: mockAgent });
                    }
                })
                .mockImplementationOnce(() => Promise.reject(new Error('Core memory not found')))
                .mockImplementationOnce(() => Promise.resolve({ status: 404, data: null }))
                .mockImplementationOnce(() => Promise.resolve({ status: 500, data: null }));

            const result = await handleGetAgentSummary(mockServer, { agent_id: agentId });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult).toMatchObject({
                agent_id: agentId,
                name: 'Minimal Agent',
                description: 'Agent with no extras',
                system_prompt_snippet: 'Basic system prompt',
                llm_config: 'openai/gpt-3.5-turbo',
                embedding_config: 'openai/text-embedding-ada-002',
                core_memory_blocks: [],
                attached_tools_count: 0,
                attached_tools: [],
                attached_sources_count: 0,
                attached_sources: []
            });
        });

        it('should handle long system prompts and memory values', async () => {
            const agentId = 'test-agent-789';
            const longText = 'A'.repeat(300); // 300 character string
            
            const mockAgent = {
                id: agentId,
                name: 'Long Text Agent',
                description: 'Agent with long texts',
                system: longText,
                llm_config: { handle: 'gpt-4' },
                embedding_config: { handle: 'ada-002' }
            };

            const mockCoreMemory = [
                { label: 'memory1', value: longText }
            ];

            mockApi.get
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}`) {
                        return Promise.resolve({ status: 200, data: mockAgent });
                    }
                })
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${agentId}/core-memory/blocks`) {
                        return Promise.resolve({ status: 200, data: mockCoreMemory });
                    }
                })
                .mockImplementationOnce(() => Promise.resolve({ status: 200, data: [] }))
                .mockImplementationOnce(() => Promise.resolve({ status: 200, data: [] }));

            const result = await handleGetAgentSummary(mockServer, { agent_id: agentId });
            const parsedResult = expectValidToolResponse(result);

            // System prompt should be truncated to 200 chars + ...
            expect(parsedResult.system_prompt_snippet).toHaveLength(203);
            expect(parsedResult.system_prompt_snippet.endsWith('...')).toBe(true);
            
            // Memory value should be truncated to 100 chars + ...
            expect(parsedResult.core_memory_blocks[0].value_snippet).toHaveLength(103);
            expect(parsedResult.core_memory_blocks[0].value_snippet.endsWith('...')).toBe(true);
        });

        it('should handle special characters in agent_id', async () => {
            const agentId = 'agent with spaces & symbols!';
            const encodedAgentId = encodeURIComponent(agentId);
            
            const mockAgent = {
                id: agentId,
                name: 'Special Agent',
                description: 'Agent with special ID',
                system: 'System',
                llm_config: { handle: 'gpt-4' },
                embedding_config: { handle: 'ada-002' }
            };

            mockApi.get
                .mockImplementationOnce((url) => {
                    if (url === `/agents/${encodedAgentId}`) {
                        return Promise.resolve({ status: 200, data: mockAgent });
                    }
                })
                .mockImplementation(() => Promise.resolve({ status: 200, data: [] }));

            const result = await handleGetAgentSummary(mockServer, { agent_id: agentId });
            const parsedResult = expectValidToolResponse(result);

            expect(parsedResult.agent_id).toBe(agentId);
            expect(mockApi.get).toHaveBeenCalledWith(`/agents/${encodedAgentId}`, expect.any(Object));
        });
    });

    describe('Error Handling', () => {
        it('should throw error for missing agent_id', async () => {
            await expect(handleGetAgentSummary(mockServer, {}))
                .rejects.toThrow('Missing required argument: agent_id');

            await expect(handleGetAgentSummary(mockServer, { agent_id: null }))
                .rejects.toThrow('Missing required argument: agent_id');

            await expect(handleGetAgentSummary(mockServer, { agent_id: '' }))
                .rejects.toThrow('Missing required argument: agent_id');
        });

        it('should handle agent not found (404)', async () => {
            const agentId = 'non-existent-agent';
            
            mockApi.get.mockImplementationOnce(() => 
                Promise.reject({
                    response: {
                        status: 404,
                        data: { error: 'Agent not found' }
                    }
                })
            );

            await expect(handleGetAgentSummary(mockServer, { agent_id: agentId }))
                .rejects.toThrow(`Agent not found: ${agentId}`);
        });

        it('should handle API errors for agent state', async () => {
            const agentId = 'error-agent';
            
            mockApi.get.mockImplementationOnce(() => 
                Promise.reject({
                    message: 'Network error',
                    response: {
                        data: { detail: 'Connection refused' }
                    }
                })
            );

            await expect(handleGetAgentSummary(mockServer, { agent_id: agentId }))
                .rejects.toThrow('Failed to fetch agent state');
        });

        it('should handle non-200 status for agent state', async () => {
            const agentId = 'error-agent';
            
            mockApi.get.mockImplementationOnce(() => 
                Promise.resolve({
                    status: 500,
                    data: { error: 'Internal server error' }
                })
            );

            await expect(handleGetAgentSummary(mockServer, { agent_id: agentId }))
                .rejects.toThrow('Failed to fetch agent state');
        });

        it('should handle unexpected errors during processing', async () => {
            const agentId = 'crash-agent';
            
            // Mock successful agent fetch but with invalid data structure
            mockApi.get.mockImplementationOnce(() => 
                Promise.resolve({
                    status: 200,
                    data: {
                        id: agentId,
                        // Missing required fields to cause processing error
                    }
                })
            );

            await expect(handleGetAgentSummary(mockServer, { agent_id: agentId }))
                .rejects.toThrow('Failed to get agent summary');
        });
    });
});