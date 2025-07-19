import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleReadMemoryBlock, readMemoryBlockToolDefinition } from '../../../tools/memory/read-memory-block.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Read Memory Block', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(readMemoryBlockToolDefinition.name).toBe('read_memory_block');
            expect(readMemoryBlockToolDefinition.description).toContain('Get full details of a specific memory block');
            expect(readMemoryBlockToolDefinition.inputSchema.required).toEqual(['block_id']);
            expect(readMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('block_id');
            expect(readMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('agent_id');
        });
    });
    
    describe('Functionality Tests', () => {
        it('should read memory block successfully', async () => {
            const mockBlock = {
                id: 'block-123',
                name: 'Test Block',
                label: 'persona',
                value: 'I am a helpful AI assistant with extensive knowledge and capabilities',
                limit: 5000,
                is_template: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-02T00:00:00Z',
                metadata: {
                    type: 'persona',
                    version: '1.0',
                    tags: ['ai', 'assistant'],
                },
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'block-123',
            });
            
            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks/block-123',
                expect.objectContaining({
                    headers: expect.any(Object),
                })
            );
            
            // Verify response contains all block data
            const data = expectValidToolResponse(result);
            expect(data.id).toBe('block-123');
            expect(data.name).toBe('Test Block');
            expect(data.label).toBe('persona');
            expect(data.value).toBe('I am a helpful AI assistant with extensive knowledge and capabilities');
            expect(data.limit).toBe(5000);
            expect(data.is_template).toBe(false);
            expect(data.metadata).toEqual({
                type: 'persona',
                version: '1.0',
                tags: ['ai', 'assistant'],
            });
        });
        
        it('should read memory block with agent_id authorization', async () => {
            const agentId = 'agent-456';
            const mockBlock = {
                id: 'agent-block-123',
                name: 'Agent Specific Block',
                label: 'human',
                value: 'User preferences for this agent',
                limit: 2000,
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'agent-block-123',
                agent_id: agentId,
            });
            
            // Verify user_id header was included
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/blocks/agent-block-123',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': agentId,
                    }),
                })
            );
            
            const data = expectValidToolResponse(result);
            expect(data.id).toBe('agent-block-123');
        });
        
        it('should handle blocks with minimal data', async () => {
            const minimalBlock = {
                id: 'minimal-block',
                value: 'Minimal content',
                // Only required fields
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: minimalBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'minimal-block',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.id).toBe('minimal-block');
            expect(data.value).toBe('Minimal content');
        });
        
        it('should handle template blocks', async () => {
            const templateBlock = {
                id: 'template-123',
                name: 'Template Block',
                label: 'system',
                value: 'This is a template for system prompts',
                is_template: true,
                template_variables: ['user_name', 'system_role'],
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: templateBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'template-123',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.is_template).toBe(true);
            expect(data.template_variables).toEqual(['user_name', 'system_role']);
        });
        
        it('should handle blocks with complex metadata', async () => {
            const complexBlock = {
                id: 'complex-123',
                name: 'Complex Block',
                label: 'custom',
                value: 'Complex content',
                metadata: {
                    nested: {
                        level1: {
                            level2: 'deep value',
                        },
                    },
                    array_data: [1, 2, 3, 'text'],
                    boolean_flag: true,
                    null_value: null,
                },
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: complexBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'complex-123',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.metadata.nested.level1.level2).toBe('deep value');
            expect(data.metadata.array_data).toEqual([1, 2, 3, 'text']);
            expect(data.metadata.boolean_flag).toBe(true);
            expect(data.metadata.null_value).toBeNull();
        });
        
        it('should handle very large memory blocks', async () => {
            const largeValue = 'X'.repeat(10000); // 10k characters
            const largeBlock = {
                id: 'large-block',
                name: 'Large Block',
                label: 'data',
                value: largeValue,
                limit: 10000,
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: largeBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'large-block',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.value).toBe(largeValue);
            expect(data.value.length).toBe(10000);
        });
        
        it('should handle blocks with special characters', async () => {
            const specialBlock = {
                id: 'special-block',
                name: 'Special "Characters" Block',
                label: 'test',
                value: 'Content with special chars: \n\t"quotes" \'apostrophes\' & symbols < > {}',
                metadata: {
                    emoji: '🤖💬🔧',
                    unicode: 'こんにちは世界',
                },
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: specialBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'special-block',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.value).toContain('\n\t"quotes"');
            expect(data.metadata.emoji).toBe('🤖💬🔧');
            expect(data.metadata.unicode).toBe('こんにちは世界');
        });
        
        it('should handle blocks associated with multiple agents', async () => {
            const sharedBlock = {
                id: 'shared-block',
                name: 'Shared Configuration',
                label: 'system',
                value: 'Shared system configuration',
                agents: [
                    { id: 'agent-1', name: 'Agent One' },
                    { id: 'agent-2', name: 'Agent Two' },
                    { id: 'agent-3', name: 'Agent Three' },
                ],
                shared: true,
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: sharedBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'shared-block',
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agents).toHaveLength(3);
            expect(data.shared).toBe(true);
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing block_id', async () => {
            await expect(
                handleReadMemoryBlock(mockServer, {})
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should throw error for null block_id', async () => {
            await expect(
                handleReadMemoryBlock(mockServer, { block_id: null })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should throw error for undefined args', async () => {
            await expect(
                handleReadMemoryBlock(mockServer, undefined)
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should handle 404 error when block not found', async () => {
            const error = new Error('Not found');
            error.response = { 
                status: 404, 
                data: { error: 'Memory block not found' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'non-existent-block',
                })
            ).rejects.toThrow('Not found');
        });
        
        it('should handle 401 unauthorized error', async () => {
            const error = new Error('Unauthorized');
            error.response = { 
                status: 401, 
                data: { error: 'Unauthorized access to memory block' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'protected-block',
                })
            ).rejects.toThrow('Unauthorized');
        });
        
        it('should handle 403 forbidden error with agent_id', async () => {
            const error = new Error('Forbidden');
            error.response = { 
                status: 403, 
                data: { error: 'Agent does not have access to this block' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'forbidden-block',
                    agent_id: 'agent-no-access',
                })
            ).rejects.toThrow('Forbidden');
        });
        
        it('should handle network errors', async () => {
            const error = new Error('Network error: Connection refused');
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'block-123',
                })
            ).rejects.toThrow('Network error');
        });
        
        it('should handle server errors', async () => {
            const error = new Error('Internal server error');
            error.response = { 
                status: 500, 
                data: { error: 'Database connection failed' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'block-123',
                })
            ).rejects.toThrow('Internal server error');
        });
        
        it('should handle malformed response', async () => {
            // API returns null data
            mockServer.api.get.mockResolvedValueOnce({ data: null });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: 'null-block',
            });
            
            // Should still return the null as valid response
            const content = result.content[0];
            expect(content.text).toBe('null');
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle empty string block_id gracefully', async () => {
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: '',
                })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should handle blocks with circular references in metadata', async () => {
            const blockData = {
                id: 'circular-block',
                name: 'Circular Block',
                label: 'test',
                value: 'Content',
                metadata: {
                    ref: null,
                },
            };
            // Create circular reference
            blockData.metadata.ref = blockData.metadata;
            
            // Mock will throw when trying to serialize circular structure
            mockServer.api.get.mockResolvedValueOnce({ data: blockData });
            
            await expect(
                handleReadMemoryBlock(mockServer, {
                    block_id: 'circular-block',
                })
            ).rejects.toThrow();
        });
        
        it('should handle UUID format block IDs', async () => {
            const uuidBlockId = '550e8400-e29b-41d4-a716-446655440000';
            const mockBlock = {
                id: uuidBlockId,
                name: 'UUID Block',
                label: 'test',
                value: 'Content with UUID',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            
            const result = await handleReadMemoryBlock(mockServer, {
                block_id: uuidBlockId,
            });
            
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/blocks/${uuidBlockId}`,
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.id).toBe(uuidBlockId);
        });
    });
});