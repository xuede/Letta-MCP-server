import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleModifyAgent, modifyAgentDefinition } from '../../../tools/agents/modify-agent.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Modify Agent', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(modifyAgentDefinition.name).toBe('modify_agent');
            expect(modifyAgentDefinition.description).toContain('Update an existing agent');
            expect(modifyAgentDefinition.inputSchema.required).toEqual(['agent_id', 'update_data']);
            expect(modifyAgentDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(modifyAgentDefinition.inputSchema.properties).toHaveProperty('update_data');
        });
        
        it('should have proper update_data schema', () => {
            const updateDataProp = modifyAgentDefinition.inputSchema.properties.update_data;
            expect(updateDataProp.type).toBe('object');
            expect(updateDataProp.properties).toHaveProperty('name');
            expect(updateDataProp.properties).toHaveProperty('system');
            expect(updateDataProp.properties).toHaveProperty('description');
            expect(updateDataProp.additionalProperties).toBe(true);
        });
    });
    
    describe('Functionality Tests', () => {
        it('should modify agent name successfully', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                name: 'Updated Agent Name',
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    name: 'Updated Agent Name',
                },
            });
            
            // Verify API call
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-123',
                { name: 'Updated Agent Name' },
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.agent).toEqual(updatedAgent);
            expect(data.agent.name).toBe('Updated Agent Name');
        });
        
        it('should modify multiple fields at once', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                name: 'New Name',
                description: 'New Description',
                system: 'You are an updated assistant',
                tags: ['updated', 'modified'],
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    name: 'New Name',
                    description: 'New Description',
                    system: 'You are an updated assistant',
                    tags: ['updated', 'modified'],
                },
            });
            
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-123',
                {
                    name: 'New Name',
                    description: 'New Description',
                    system: 'You are an updated assistant',
                    tags: ['updated', 'modified'],
                },
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.agent.name).toBe('New Name');
            expect(data.agent.description).toBe('New Description');
            expect(data.agent.system).toBe('You are an updated assistant');
            expect(data.agent.tags).toEqual(['updated', 'modified']);
        });
        
        it('should handle special characters in agent_id', async () => {
            const updatedAgent = fixtures.agent.basic;
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent@special#123',
                update_data: { name: 'Updated' },
            });
            
            // Verify URL encoding
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent%40special%23123',
                expect.any(Object),
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.agent).toEqual(updatedAgent);
        });
        
        it('should modify agent configuration fields', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                llm_config: {
                    model: 'gpt-4-turbo',
                    temperature: 0.9,
                    max_tokens: 3000,
                },
                embedding_config: {
                    model: 'text-embedding-3-large',
                },
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    llm_config: {
                        model: 'gpt-4-turbo',
                        temperature: 0.9,
                        max_tokens: 3000,
                    },
                    embedding_config: {
                        model: 'text-embedding-3-large',
                    },
                },
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent.llm_config.model).toBe('gpt-4-turbo');
            expect(data.agent.llm_config.temperature).toBe(0.9);
            expect(data.agent.embedding_config.model).toBe('text-embedding-3-large');
        });
        
        it('should handle empty update_data gracefully', async () => {
            const unchangedAgent = fixtures.agent.basic;
            mockServer.api.patch.mockResolvedValueOnce({ data: unchangedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {},
            });
            
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-123',
                {},
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.agent).toEqual(unchangedAgent);
        });
        
        it('should update tool_ids array', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                tool_ids: ['new-tool-1', 'new-tool-2', 'new-tool-3'],
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    tool_ids: ['new-tool-1', 'new-tool-2', 'new-tool-3'],
                },
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent.tool_ids).toEqual(['new-tool-1', 'new-tool-2', 'new-tool-3']);
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing agent_id', async () => {
            await expect(
                handleModifyAgent(mockServer, {
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should throw error for missing update_data', async () => {
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Missing required argument: update_data');
        });
        
        it('should throw error for null agent_id', async () => {
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: null,
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should throw error for null update_data', async () => {
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'agent-123',
                    update_data: null,
                })
            ).rejects.toThrow('Missing required argument: update_data');
        });
        
        it('should handle agent not found (404)', async () => {
            const error = new Error('Not found');
            error.response = { status: 404 };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'nonexistent',
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Agent not found: nonexistent');
        });
        
        it('should handle validation errors (422)', async () => {
            const error = new Error('Validation failed');
            error.response = {
                status: 422,
                data: {
                    detail: [
                        { loc: ['body', 'name'], msg: 'Name too long' },
                        { loc: ['body', 'temperature'], msg: 'Must be between 0 and 1' },
                    ],
                },
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'agent-123',
                    update_data: {
                        name: 'A'.repeat(1000),
                        temperature: 2.0,
                    },
                })
            ).rejects.toThrow(/Validation error updating agent agent-123/);
        });
        
        it('should handle server errors (500)', async () => {
            const error = new Error('Internal server error');
            error.response = { status: 500, data: { error: 'Database error' } };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'agent-123',
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Internal server error');
        });
        
        it('should handle network errors', async () => {
            const error = new Error('Network error');
            // No response property for network errors
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: 'agent-123',
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Network error');
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle empty agent_id string', async () => {
            await expect(
                handleModifyAgent(mockServer, {
                    agent_id: '',
                    update_data: { name: 'New Name' },
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should handle updating with null values', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                description: null,
                tags: null,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    description: null,
                    tags: null,
                },
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent.description).toBeNull();
            expect(data.agent.tags).toBeNull();
        });
        
        it('should handle deeply nested update data', async () => {
            const updatedAgent = {
                ...fixtures.agent.basic,
                metadata: {
                    custom: {
                        nested: {
                            value: 'deep update',
                        },
                    },
                },
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    metadata: {
                        custom: {
                            nested: {
                                value: 'deep update',
                            },
                        },
                    },
                },
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent.metadata.custom.nested.value).toBe('deep update');
        });
        
        it('should preserve fields not included in update_data', async () => {
            const originalAgent = {
                ...fixtures.agent.basic,
                field1: 'original1',
                field2: 'original2',
                field3: 'original3',
            };
            
            const updatedAgent = {
                ...originalAgent,
                field2: 'updated2',
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedAgent });
            
            const result = await handleModifyAgent(mockServer, {
                agent_id: 'agent-123',
                update_data: {
                    field2: 'updated2',
                },
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent.field1).toBe('original1');
            expect(data.agent.field2).toBe('updated2');
            expect(data.agent.field3).toBe('original3');
        });
    });
});