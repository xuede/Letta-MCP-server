import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAttachMemoryBlock, attachMemoryBlockToolDefinition } from '../../../tools/memory/attach-memory-block.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Attach Memory Block', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(attachMemoryBlockToolDefinition.name).toBe('attach_memory_block');
            expect(attachMemoryBlockToolDefinition.description).toContain('Attach a memory block to an agent');
            expect(attachMemoryBlockToolDefinition.inputSchema.required).toEqual(['block_id', 'agent_id']);
            expect(attachMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('block_id');
            expect(attachMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(attachMemoryBlockToolDefinition.inputSchema.properties).toHaveProperty('label');
        });
    });
    
    describe('Functionality Tests', () => {
        it('should attach memory block successfully with minimal args', async () => {
            const blockId = 'block-123';
            const agentId = 'agent-456';
            
            const mockBlock = {
                id: blockId,
                name: 'Test Memory Block',
                label: 'persona',
                value: 'I am a helpful assistant',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Test Agent',
            };
            
            // Mock block verification
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            
            // Mock attachment (patch returns empty)
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            
            // Mock agent info retrieval
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            // Verify block verification call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/blocks/${blockId}`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': agentId,
                    }),
                })
            );
            
            // Verify attachment call
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/core-memory/blocks/attach/${blockId}`,
                {},
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': agentId,
                    }),
                })
            );
            
            // Verify agent info call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                `/agents/${agentId}`,
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': agentId,
                    }),
                })
            );
            
            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe(agentId);
            expect(data.agent_name).toBe('Test Agent');
            expect(data.block_id).toBe(blockId);
            expect(data.block_name).toBe('Test Memory Block');
            expect(data.label).toBe('persona'); // Uses block's label
        });
        
        it('should attach with custom label override', async () => {
            const blockId = 'block-custom';
            const agentId = 'agent-custom';
            
            const mockBlock = {
                id: blockId,
                name: 'Original Label Block',
                label: 'persona', // Original label
                value: 'Content',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Custom Label Agent',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
                label: 'human', // Override label
            });
            
            const data = expectValidToolResponse(result);
            expect(data.label).toBe('human'); // Should use provided label
        });
        
        it('should handle block without name', async () => {
            const blockId = 'nameless-block';
            const agentId = 'agent-nameless';
            
            const mockBlock = {
                id: blockId,
                // No name field
                label: 'system',
                value: 'System content',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Agent for Nameless',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.block_name).toBe('Unnamed Block');
        });
        
        it('should handle agent without name', async () => {
            const blockId = 'block-noagent';
            const agentId = 'nameless-agent';
            
            const mockBlock = {
                id: blockId,
                name: 'Block for Nameless Agent',
                label: 'persona',
            };
            
            const mockAgent = {
                id: agentId,
                // No name field
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent_name).toBe('Unknown');
        });
        
        it('should use default label when block has no label', async () => {
            const blockId = 'no-label-block';
            const agentId = 'agent-default-label';
            
            const mockBlock = {
                id: blockId,
                name: 'No Label Block',
                // No label field
                value: 'Content without label',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Default Label Agent',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.label).toBe('custom'); // Default when no label
        });
        
        it('should attach different types of memory blocks', async () => {
            const labels = ['persona', 'human', 'system', 'custom_type'];
            
            for (const label of labels) {
                const blockId = `block-${label}`;
                const agentId = `agent-${label}`;
                
                const mockBlock = {
                    id: blockId,
                    name: `${label} Block`,
                    label: label,
                    value: `Content for ${label}`,
                };
                
                const mockAgent = {
                    id: agentId,
                    name: `${label} Agent`,
                };
                
                mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
                mockServer.api.patch.mockResolvedValueOnce({ data: {} });
                mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
                
                const result = await handleAttachMemoryBlock(mockServer, {
                    block_id: blockId,
                    agent_id: agentId,
                });
                
                const data = expectValidToolResponse(result);
                expect(data.label).toBe(label);
            }
        });
        
        it('should include user_id header in all API calls', async () => {
            const blockId = 'auth-block';
            const agentId = 'auth-agent';
            
            mockServer.api.get.mockResolvedValueOnce({ data: { id: blockId } });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: { id: agentId } });
            
            await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            // Verify all calls included user_id header
            expect(mockServer.api.get).toHaveBeenCalledTimes(2);
            expect(mockServer.api.patch).toHaveBeenCalledTimes(1);
            
            // All calls should have user_id header
            const allCalls = [
                ...mockServer.api.get.mock.calls,
                ...mockServer.api.patch.mock.calls,
            ];
            
            allCalls.forEach(call => {
                const headers = call[1]?.headers || call[2]?.headers;
                expect(headers).toHaveProperty('user_id', agentId);
            });
        });
        
        it('should handle attaching template blocks', async () => {
            const blockId = 'template-block';
            const agentId = 'template-agent';
            
            const mockBlock = {
                id: blockId,
                name: 'Template Block',
                label: 'system',
                value: 'Template with {{variable}}',
                is_template: true,
                template_variables: ['variable'],
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Template Using Agent',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe(blockId);
            expect(data.agent_id).toBe(agentId);
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing block_id', async () => {
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should throw error for missing agent_id', async () => {
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: 'block-123',
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should throw error for missing both required args', async () => {
            await expect(
                handleAttachMemoryBlock(mockServer, {})
            ).rejects.toThrow('Missing required argument: block_id');
        });
        
        it('should handle block not found error', async () => {
            const error = new Error('Block not found');
            error.response = { 
                status: 404, 
                data: { error: 'Memory block not found' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: 'non-existent-block',
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Block not found');
        });
        
        it('should handle agent not found error during attachment', async () => {
            const blockId = 'block-123';
            const agentId = 'non-existent-agent';
            
            // Block exists
            mockServer.api.get.mockResolvedValueOnce({ 
                data: { id: blockId, name: 'Test Block' } 
            });
            
            // Attachment fails - agent not found
            const error = new Error('Agent not found');
            error.response = { 
                status: 404, 
                data: { error: 'Agent not found' } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: blockId,
                    agent_id: agentId,
                })
            ).rejects.toThrow('Agent not found');
        });
        
        it('should handle attachment conflict error', async () => {
            const blockId = 'conflict-block';
            const agentId = 'conflict-agent';
            
            // Block exists
            mockServer.api.get.mockResolvedValueOnce({ 
                data: { id: blockId, name: 'Conflict Block' } 
            });
            
            // Attachment fails - already attached
            const error = new Error('Conflict');
            error.response = { 
                status: 409, 
                data: { error: 'Memory block already attached to agent' } 
            };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: blockId,
                    agent_id: agentId,
                })
            ).rejects.toThrow('Conflict');
        });
        
        it('should handle forbidden access error', async () => {
            const blockId = 'forbidden-block';
            const agentId = 'forbidden-agent';
            
            const error = new Error('Forbidden');
            error.response = { 
                status: 403, 
                data: { error: 'Not authorized to access this block' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: blockId,
                    agent_id: agentId,
                })
            ).rejects.toThrow('Forbidden');
        });
        
        it('should handle error when retrieving agent info after attachment', async () => {
            const blockId = 'block-123';
            const agentId = 'agent-error';
            
            // Block verification succeeds
            mockServer.api.get.mockResolvedValueOnce({ 
                data: { id: blockId, name: 'Test Block' } 
            });
            
            // Attachment succeeds
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            
            // Agent info retrieval fails
            const error = new Error('Failed to get agent');
            error.response = { status: 500 };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: blockId,
                    agent_id: agentId,
                })
            ).rejects.toThrow('Failed to get agent');
        });
        
        it('should handle network errors', async () => {
            const error = new Error('Network error: Connection refused');
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Network error');
        });
        
        it('should handle server errors', async () => {
            const error = new Error('Internal server error');
            error.response = { 
                status: 500, 
                data: { error: 'Database error' } 
            };
            mockServer.api.get.mockRejectedValueOnce(error);
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Internal server error');
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle empty string IDs gracefully', async () => {
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: '',
                    agent_id: 'agent-123',
                })
            ).rejects.toThrow('Missing required argument: block_id');
            
            await expect(
                handleAttachMemoryBlock(mockServer, {
                    block_id: 'block-123',
                    agent_id: '',
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should handle UUID format IDs', async () => {
            const blockId = '550e8400-e29b-41d4-a716-446655440000';
            const agentId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
            
            const mockBlock = {
                id: blockId,
                name: 'UUID Block',
                label: 'system',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'UUID Agent',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                `/agents/${agentId}/core-memory/blocks/attach/${blockId}`,
                {},
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe(blockId);
            expect(data.agent_id).toBe(agentId);
        });
        
        it('should handle special characters in names', async () => {
            const blockId = 'special-block';
            const agentId = 'special-agent';
            
            const mockBlock = {
                id: blockId,
                name: 'Block with "quotes" & symbols <tag>',
                label: 'persona',
            };
            
            const mockAgent = {
                id: agentId,
                name: 'Agent: Special édition 🚀',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.block_name).toBe('Block with "quotes" & symbols <tag>');
            expect(data.agent_name).toBe('Agent: Special édition 🚀');
        });
        
        it('should handle attaching shared blocks', async () => {
            const blockId = 'shared-block';
            const agentId = 'new-agent';
            
            const mockBlock = {
                id: blockId,
                name: 'Shared System Config',
                label: 'system',
                value: 'Shared configuration',
                shared: true,
                agents: [
                    { id: 'agent-1', name: 'Agent One' },
                    { id: 'agent-2', name: 'Agent Two' },
                ],
            };
            
            const mockAgent = {
                id: agentId,
                name: 'New Agent',
            };
            
            mockServer.api.get.mockResolvedValueOnce({ data: mockBlock });
            mockServer.api.patch.mockResolvedValueOnce({ data: {} });
            mockServer.api.get.mockResolvedValueOnce({ data: mockAgent });
            
            const result = await handleAttachMemoryBlock(mockServer, {
                block_id: blockId,
                agent_id: agentId,
            });
            
            const data = expectValidToolResponse(result);
            expect(data.block_id).toBe(blockId);
            expect(data.agent_id).toBe(agentId);
        });
    });
});