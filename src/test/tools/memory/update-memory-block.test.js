import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleUpdateMemoryBlock, updateMemoryBlockToolDefinition } from '../../../tools/memory/update-memory-block.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Update Memory Block', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(updateMemoryBlockToolDefinition.name).toBe('update_memory_block');
            expect(updateMemoryBlockToolDefinition.description).toContain('Update the contents and metadata');
            expect(updateMemoryBlockToolDefinition.inputSchema.required).toEqual(['block_id']);
            expect(updateMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('block_id');
            expect(updateMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('value');
            expect(updateMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('metadata');
            expect(updateMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('agent_id');
        });
    });
    
    describe('Functionality Tests', () => {
        it('should update memory block value successfully', async () => {
            const updatedBlock = {
                id: 'block-123',
                name: 'Updated Block',
                label: 'persona',
                value: 'Updated content for the memory block',
                limit: 5000,
                metadata: { version: '1.0' },
                updated_at: '2024-01-02T00:00:00Z',
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'block-123',
                value: 'Updated content for the memory block',
            });
            
            // Verify API call
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/block-123',
                {
                    value: 'Updated content for the memory block',
                },
                expect.objectContaining({
                    headers: expect.any(Object),
                })
            );
            
            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.id).toBe('block-123');
            expect(data.value).toBe('Updated content for the memory block');
            expect(data.updated_at).toBe('2024-01-02T00:00:00Z');
        });
        
        it('should update memory block metadata successfully', async () => {
            const newMetadata = {
                version: '2.0',
                tags: ['updated', 'important'],
                last_modified_by: 'user-123',
            };
            
            const updatedBlock = {
                id: 'block-456',
                name: 'Metadata Update Block',
                label: 'system',
                value: 'Original content',
                metadata: newMetadata,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'block-456',
                metadata: newMetadata,
            });
            
            // Verify only metadata was sent
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/block-456',
                {
                    metadata: newMetadata,
                },
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.metadata).toEqual(newMetadata);
            expect(data.value).toBe('Original content'); // Value unchanged
        });
        
        it('should update both value and metadata', async () => {
            const newValue = 'Completely new content';
            const newMetadata = {
                version: '3.0',
                complete_update: true,
            };
            
            const updatedBlock = {
                id: 'block-789',
                name: 'Complete Update Block',
                label: 'human',
                value: newValue,
                metadata: newMetadata,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'block-789',
                value: newValue,
                metadata: newMetadata,
            });
            
            // Verify both fields were sent
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/block-789',
                {
                    value: newValue,
                    metadata: newMetadata,
                },
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.value).toBe(newValue);
            expect(data.metadata).toEqual(newMetadata);
        });
        
        it('should update with agent_id authorization', async () => {
            const agentId = 'agent-auth-123';
            const updatedBlock = {
                id: 'agent-block',
                value: 'Agent authorized update',
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'agent-block',
                value: 'Agent authorized update',
                agent_id: agentId,
            });
            
            // Verify user_id header was included
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/agent-block',
                expect.any(Object),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': agentId,
                    }),
                })
            );
            
            const data = expectValidToolResponse(result);
            expect(data.value).toBe('Agent authorized update');
        });
        
        it('should handle updating to empty string value', async () => {
            // Empty string is considered as falsy, so the tool will reject it
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'empty-block',
                    value: '',
                })
            ).rejects.toThrow('Either value or metadata must be provided');
        });
        
        it('should handle updating to empty metadata object', async () => {
            const updatedBlock = {
                id: 'empty-metadata-block',
                value: 'Content',
                metadata: {},
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'empty-metadata-block',
                metadata: {},
            });
            
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/empty-metadata-block',
                {
                    metadata: {},
                },
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.metadata).toEqual({});
        });
        
        it('should handle very large value updates', async () => {
            const largeValue = 'Y'.repeat(10000); // 10k characters
            const updatedBlock = {
                id: 'large-update-block',
                value: largeValue,
                limit: 10000,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'large-update-block',
                value: largeValue,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.value).toBe(largeValue);
            expect(data.value.length).toBe(10000);
        });
        
        it('should preserve undefined fields during update', async () => {
            const originalBlock = {
                id: 'preserve-block',
                name: 'Original Name',
                label: 'persona',
                value: 'New value only',
                metadata: { original: true },
                limit: 5000,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: originalBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'preserve-block',
                value: 'New value only',
                // Not updating metadata
            });
            
            // Verify only value was sent in update
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/blocks/preserve-block',
                {
                    value: 'New value only',
                    // metadata should not be included
                },
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.name).toBe('Original Name');
            expect(data.label).toBe('persona');
            expect(data.metadata).toEqual({ original: true });
        });
        
        it('should handle complex nested metadata updates', async () => {
            const complexMetadata = {
                level1: {
                    level2: {
                        level3: {
                            deep_value: 'nested content',
                            array: [1, 2, { nested: true }],
                        },
                    },
                },
                timestamps: {
                    created: '2024-01-01T00:00:00Z',
                    modified: '2024-01-02T00:00:00Z',
                },
                flags: {
                    active: true,
                    reviewed: false,
                    priority: 'high',
                },
            };
            
            const updatedBlock = {
                id: 'complex-metadata-block',
                value: 'Content',
                metadata: complexMetadata,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'complex-metadata-block',
                metadata: complexMetadata,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.metadata).toEqual(complexMetadata);
            expect(data.metadata.level1.level2.level3.deep_value).toBe('nested content');
        });
        
        it('should handle special characters in updates', async () => {
            const specialValue = 'Line 1\nLine 2\tTabbed\r\nWindows line\n\nDouble space\n"Quoted" text';
            const specialMetadata = {
                unicode: '你好世界 🌍',
                emoji: '🚀🎉🔧',
                symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
            };
            
            const updatedBlock = {
                id: 'special-chars-block',
                value: specialValue,
                metadata: specialMetadata,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'special-chars-block',
                value: specialValue,
                metadata: specialMetadata,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.value).toBe(specialValue);
            expect(data.metadata.unicode).toBe('你好世界 🌍');
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing block_id', async () => {
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    value: 'Some value',
                })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should throw error for null block_id', async () => {
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: null,
                    value: 'Some value',
                })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should throw error when neither value nor metadata provided', async () => {
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'block-123',
                })
            ).rejects.toThrow('Either value or metadata must be provided');
        });
        
        it('should throw error for undefined args', async () => {
            await expect(
                handleUpdateMemoryBlock(mockServer, undefined)
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should handle 404 error when block not found', async () => {
            const error = new Error('Not found');
            error.response = { 
                status: 404, 
                data: { error: 'Memory block not found' } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'non-existent-block',
                    value: 'New value',
                })
            ).rejects.toThrow('Not found');
        });
        
        it('should handle 403 forbidden error', async () => {
            const error = new Error('Forbidden');
            error.response = { 
                status: 403, 
                data: { error: 'Cannot update this memory block' } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'protected-block',
                    value: 'Attempted update',
                })
            ).rejects.toThrow('Forbidden');
        });
        
        it('should handle 422 validation error', async () => {
            const error = new Error('Validation failed');
            error.response = { 
                status: 422, 
                data: { 
                    error: 'Validation error',
                    details: {
                        value: 'Value exceeds maximum length of 5000 characters',
                    },
                } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    value: 'X'.repeat(6000),
                })
            ).rejects.toThrow('Validation failed');
        });
        
        it('should handle network errors', async () => {
            const error = new Error('Network error: Connection timeout');
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    value: 'Update value',
                })
            ).rejects.toThrow('Network error');
        });
        
        it('should handle server errors', async () => {
            const error = new Error('Internal server error');
            error.response = { 
                status: 500, 
                data: { error: 'Database update failed' } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    metadata: { update: 'failed' },
                })
            ).rejects.toThrow('Internal server error');
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle empty string block_id gracefully', async () => {
            await expect(
                handleUpdateMemoryBlock(mockServer, {
                    block_id: '',
                    value: 'Some value',
                })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should allow updating with null metadata values', async () => {
            const metadataWithNulls = {
                field1: null,
                field2: 'value',
                field3: null,
            };
            
            const updatedBlock = {
                id: 'null-metadata-block',
                value: 'Content',
                metadata: metadataWithNulls,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'null-metadata-block',
                metadata: metadataWithNulls,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.metadata.field1).toBeNull();
            expect(data.metadata.field2).toBe('value');
            expect(data.metadata.field3).toBeNull();
        });
        
        it('should handle UUID format block IDs in updates', async () => {
            const uuidBlockId = '550e8400-e29b-41d4-a716-446655440000';
            const updatedBlock = {
                id: uuidBlockId,
                value: 'Updated UUID block',
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: uuidBlockId,
                value: 'Updated UUID block',
            });
            
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/blocks/${uuidBlockId}`,
                expect.any(Object),
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.id).toBe(uuidBlockId);
        });
        
        it('should handle updating blocks at character limit', async () => {
            const maxValue = 'Z'.repeat(5000); // Exactly at limit
            const updatedBlock = {
                id: 'max-limit-block',
                value: maxValue,
                limit: 5000,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'max-limit-block',
                value: maxValue,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.value.length).toBe(5000);
        });
        
        it('should handle concurrent metadata updates correctly', async () => {
            // Simulate a scenario where metadata might have version conflicts
            const versionedMetadata = {
                version: 5,
                last_update_timestamp: Date.now(),
                update_count: 10,
            };
            
            const updatedBlock = {
                id: 'versioned-block',
                value: 'Content',
                metadata: versionedMetadata,
            };
            
            mockServer.api.patch.mockResolvedValueOnce({ data: updatedBlock });
            
            const result = await handleUpdateMemoryBlock(mockServer, {
                block_id: 'versioned-block',
                metadata: versionedMetadata,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.metadata.version).toBe(5);
            expect(data.metadata.update_count).toBe(10);
        });
    });
});