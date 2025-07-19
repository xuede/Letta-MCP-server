import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleAttachTool, attachToolToolDefinition } from '../../../tools/tools/attach-tool.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Attach Tool', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(attachToolToolDefinition.name).toBe('attach_tool');
            expect(attachToolToolDefinition.description).toContain('Attach one or more tools');
            expect(attachToolToolDefinition.inputSchema.required).toEqual(['agent_id']);
            expect(attachToolToolDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(attachToolToolDefinition.inputSchema.properties).toHaveProperty('tool_id');
            expect(attachToolToolDefinition.inputSchema.properties).toHaveProperty('tool_ids');
            expect(attachToolToolDefinition.inputSchema.properties).toHaveProperty('tool_names');
        });
    });
    
    describe('Functionality Tests', () => {
        it('should attach tool by ID successfully', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockTool = { id: 'tool-456', name: 'Test Tool' };
            const mockUpdatedAgent = { ...mockAgent, tools: [mockTool] };
            
            // Mock agent info
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/tool-456') {
                    return Promise.resolve({ data: mockTool });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            // Mock tool attachment
            mockServer.api.patch.mockResolvedValueOnce({ 
                data: mockUpdatedAgent 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_id: 'tool-456'
            });
            
            // Verify API calls
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/agent-123',
                expect.objectContaining({ headers: expect.any(Object) })
            );
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/tool-456',
                expect.objectContaining({ headers: expect.any(Object) })
            );
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-123/tools/attach/tool-456',
                {},
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent-123');
            expect(data.agent_name).toBe('Test Agent');
            expect(data.attachment_summary[0].success).toBe(true);
            expect(data.attachment_summary[0].tool_id).toBe('tool-456');
        });
        
        it('should attach multiple tools by IDs', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockTool1 = { id: 'tool-1', name: 'Tool 1' };
            const mockTool2 = { id: 'tool-2', name: 'Tool 2' };
            
            // Mock responses
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/tool-1') {
                    return Promise.resolve({ data: mockTool1 });
                }
                if (url === '/tools/tool-2') {
                    return Promise.resolve({ data: mockTool2 });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.patch.mockImplementation((url) => {
                if (url.includes('tool-1')) {
                    return Promise.resolve({ data: { tools: [mockTool1] } });
                }
                if (url.includes('tool-2')) {
                    return Promise.resolve({ data: { tools: [mockTool1, mockTool2] } });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_ids: ['tool-1', 'tool-2']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.attachment_summary).toHaveLength(2);
            expect(data.attachment_summary[0].success).toBe(true);
            expect(data.attachment_summary[1].success).toBe(true);
        });
        
        it('should attach tool by name when it exists in Letta', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockLettaTool = { id: 'letta-tool-1', name: 'my-tool' };
            
            // Mock responses
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [mockLettaTool] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: {} });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.patch.mockResolvedValueOnce({ 
                data: { tools: [mockLettaTool] } 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_names: ['my-tool']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].status).toBe('found_letta');
            expect(data.attachment_summary[0].success).toBe(true);
            expect(data.attachment_summary[0].tool_id).toBe('letta-tool-1');
        });
        
        it('should register and attach MCP tool by name', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockMcpTool = { name: 'mcp-tool', description: 'MCP Tool' };
            const mockRegisteredTool = { id: 'registered-tool-1', name: 'mcp-tool' };
            
            // Mock responses
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [] }); // No existing Letta tools
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: { 'test-server': {} } });
                }
                if (url === '/tools/mcp/servers/test-server/tools') {
                    return Promise.resolve({ data: [mockMcpTool] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            // Mock registration
            mockServer.api.post.mockResolvedValueOnce({ 
                data: mockRegisteredTool 
            });
            
            // Mock attachment
            mockServer.api.patch.mockResolvedValueOnce({ 
                data: { tools: [mockRegisteredTool] } 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_names: ['mcp-tool']
            });
            
            // Verify registration was called
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/mcp/servers/test-server/mcp-tool',
                {},
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].status).toBe('registered_mcp');
            expect(data.attachment_summary[0].success).toBe(true);
            expect(data.attachment_summary[0].tool_id).toBe('registered-tool-1');
        });
        
        it('should handle mixed tool IDs and names', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockToolById = { id: 'tool-456', name: 'Tool By ID' };
            const mockToolByName = { id: 'tool-789', name: 'Tool By Name' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/tool-456') {
                    return Promise.resolve({ data: mockToolById });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [mockToolByName] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: {} });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.patch.mockResolvedValue({ 
                data: { tools: [mockToolById, mockToolByName] } 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_ids: ['tool-456'],
                tool_names: ['Tool By Name']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.attachment_summary).toHaveLength(2);
            expect(data.attachment_summary.every(r => r.success)).toBe(true);
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing agent_id', async () => {
            await expect(
                handleAttachTool(mockServer, {
                    tool_id: 'tool-123'
                })
            ).rejects.toThrow('Missing required argument: agent_id');
        });
        
        it('should throw error when no tools provided', async () => {
            await expect(
                handleAttachTool(mockServer, {
                    agent_id: 'agent-123'
                })
            ).rejects.toThrow('either tool_id(s) or tool_names must be provided');
        });
        
        it('should throw error for invalid tool_ids type', async () => {
            await expect(
                handleAttachTool(mockServer, {
                    agent_id: 'agent-123',
                    tool_ids: 'not-an-array'
                })
            ).rejects.toThrow('tool_ids must be an array');
        });
        
        it('should throw error for invalid tool_names type', async () => {
            await expect(
                handleAttachTool(mockServer, {
                    agent_id: 'agent-123',
                    tool_names: 'not-an-array'
                })
            ).rejects.toThrow('tool_names must be an array');
        });
        
        it('should handle tool not found by ID', async () => {
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: { id: 'agent-123', name: 'Test Agent' } });
                }
                if (url === '/tools/invalid-tool') {
                    return Promise.reject(new Error('Tool not found'));
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_ids: ['invalid-tool']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].success).toBe(false);
            expect(data.processing_summary[0].status).toBe('error');
            expect(data.attachment_summary).toHaveLength(0);
        });
        
        it('should handle tool not found by name', async () => {
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: { id: 'agent-123', name: 'Test Agent' } });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: {} });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_names: ['non-existent-tool']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].success).toBe(false);
            expect(data.processing_summary[0].status).toBe('not_found');
        });
        
        it('should handle MCP registration failure', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockMcpTool = { name: 'mcp-tool', description: 'MCP Tool' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: { 'test-server': {} } });
                }
                if (url === '/tools/mcp/servers/test-server/tools') {
                    return Promise.resolve({ data: [mockMcpTool] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            // Mock registration failure
            mockServer.api.post.mockRejectedValueOnce(new Error('Registration failed'));
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_names: ['mcp-tool']
            });
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].success).toBe(false);
            expect(data.processing_summary[0].status).toBe('error_registration');
        });
        
        it('should handle attachment failure', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockTool = { id: 'tool-456', name: 'Test Tool' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/tool-456') {
                    return Promise.resolve({ data: mockTool });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            // Mock attachment failure
            mockServer.api.patch.mockRejectedValueOnce(new Error('Attachment failed'));
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_id: 'tool-456'
            });
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].success).toBe(true);
            expect(data.attachment_summary[0].success).toBe(false);
            expect(data.attachment_summary[0].error).toContain('Failed to attach tool');
        });
    });
    
    describe('Edge Cases', () => {
        it('should handle duplicate tool names in MCP servers', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockTool = { name: 'duplicate-tool', description: 'Tool' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: { 
                        'server1': {}, 
                        'server2': {} 
                    } });
                }
                if (url.includes('server1/tools')) {
                    return Promise.resolve({ data: [mockTool] });
                }
                if (url.includes('server2/tools')) {
                    return Promise.resolve({ data: [mockTool] });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'registered-1', name: 'duplicate-tool' } 
            });
            
            mockServer.api.patch.mockResolvedValueOnce({ 
                data: { tools: [{ id: 'registered-1' }] } 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_names: ['duplicate-tool']
            });
            
            // Should use first found server
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/mcp/servers/server1/duplicate-tool',
                {},
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.processing_summary[0].success).toBe(true);
        });
        
        it('should avoid duplicate attachments', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            const mockTool = { id: 'tool-456', name: 'Test Tool' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                if (url === '/tools/tool-456') {
                    return Promise.resolve({ data: mockTool });
                }
                if (url === '/tools/') {
                    return Promise.resolve({ data: [mockTool] });
                }
                if (url === '/tools/mcp/servers') {
                    return Promise.resolve({ data: {} });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.patch.mockResolvedValue({ 
                data: { tools: [mockTool] } 
            });
            
            // Same tool by ID and name
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_ids: ['tool-456'],
                tool_names: ['Test Tool']
            });
            
            // Should only attach once
            expect(mockServer.api.patch).toHaveBeenCalledTimes(1);
            
            const data = expectValidToolResponse(result);
            expect(data.attachment_summary).toHaveLength(1);
        });
        
        it('should handle agent info fetch failure gracefully', async () => {
            const mockTool = { id: 'tool-456', name: 'Test Tool' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/agents/agent-123') {
                    return Promise.reject(new Error('Agent not found'));
                }
                if (url === '/tools/tool-456') {
                    return Promise.resolve({ data: mockTool });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.patch.mockResolvedValueOnce({ 
                data: { tools: [mockTool] } 
            });
            
            const result = await handleAttachTool(mockServer, {
                agent_id: 'agent-123',
                tool_id: 'tool-456'
            });
            
            const data = expectValidToolResponse(result);
            expect(data.agent_name).toBe('agent-123'); // Falls back to ID
            expect(data.attachment_summary[0].success).toBe(true);
        });
    });
});