import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleUploadTool, uploadToolToolDefinition } from '../../../tools/tools/upload-tool.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('Upload Tool', () => {
    let mockServer;
    
    beforeEach(() => {
        mockServer = createMockLettaServer();
    });
    
    afterEach(() => {
        vi.restoreAllMocks();
    });
    
    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(uploadToolToolDefinition.name).toBe('upload_tool');
            expect(uploadToolToolDefinition.description).toContain('Upload a new tool to the Letta system');
            expect(uploadToolToolDefinition.inputSchema.required).toEqual(['name', 'description', 'source_code']);
            expect(uploadToolToolDefinition.inputSchema.properties).toHaveProperty('name');
            expect(uploadToolToolDefinition.inputSchema.properties).toHaveProperty('description');
            expect(uploadToolToolDefinition.inputSchema.properties).toHaveProperty('source_code');
            expect(uploadToolToolDefinition.inputSchema.properties).toHaveProperty('category');
            expect(uploadToolToolDefinition.inputSchema.properties).toHaveProperty('agent_id');
        });
        
        it('should have correct default values', () => {
            expect(uploadToolToolDefinition.inputSchema.properties.category.default).toBe('custom');
        });
    });
    
    describe('Functionality Tests', () => {
        const validPythonCode = `def my_tool(param1: str, param2: int = 5) -> str:
    """A simple tool function"""
    return f"Result: {param1} - {param2}"`;
        
        it('should upload a new tool successfully', async () => {
            // Mock no existing tools
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            
            // Mock tool creation
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'new-tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'my_custom_tool',
                description: 'A custom tool for testing',
                source_code: validPythonCode
            });
            
            // Verify API calls
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/tools/',
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/',
                {
                    source_code: validPythonCode,
                    description: 'A custom tool for testing',
                    tags: ['custom'],
                    source_type: 'python'
                },
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('new-tool-123');
            expect(data.tool_name).toBe('my_custom_tool');
            expect(data.category).toBe('custom');
            expect(data.agent_id).toBeUndefined();
        });
        
        it('should upload tool with custom category', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-456' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'api_tool',
                description: 'API integration tool',
                source_code: validPythonCode,
                category: 'plane_api'
            });
            
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/',
                expect.objectContaining({
                    tags: ['plane_api']
                }),
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.category).toBe('plane_api');
        });
        
        it('should replace existing tool with same name', async () => {
            const existingTool = { id: 'existing-tool-789', name: 'my_tool' };
            
            // Mock existing tool found
            mockServer.api.get.mockResolvedValueOnce({ data: [existingTool] });
            
            // Mock successful deletion
            mockServer.api.delete.mockResolvedValueOnce({});
            
            // Mock new tool creation
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'new-tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'my_tool',
                description: 'Updated tool',
                source_code: validPythonCode
            });
            
            // Verify deletion was called
            expect(mockServer.api.delete).toHaveBeenCalledWith(
                '/tools/existing-tool-789',
                expect.objectContaining({ headers: expect.any(Object) })
            );
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('new-tool-123');
        });
        
        it('should continue even if deletion of existing tool fails', async () => {
            const existingTool = { id: 'existing-tool-789', name: 'my_tool' };
            
            mockServer.api.get.mockResolvedValueOnce({ data: [existingTool] });
            
            // Mock failed deletion
            mockServer.api.delete.mockRejectedValueOnce(new Error('Permission denied'));
            
            // Mock successful creation
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'new-tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'my_tool',
                description: 'Tool to replace',
                source_code: validPythonCode
            });
            
            // Should still create the new tool
            expect(mockServer.api.post).toHaveBeenCalled();
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('new-tool-123');
        });
        
        it('should upload and attach tool to agent', async () => {
            const mockAgent = { id: 'agent-123', name: 'Test Agent' };
            
            mockServer.api.get.mockImplementation((url) => {
                if (url === '/tools/') {
                    return Promise.resolve({ data: [] });
                }
                if (url === '/agents/agent-123') {
                    return Promise.resolve({ data: mockAgent });
                }
                return Promise.reject(new Error(`Unexpected URL: ${url}`));
            });
            
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'new-tool-456' } 
            });
            
            mockServer.api.patch.mockResolvedValueOnce({});
            
            const result = await handleUploadTool(mockServer, {
                name: 'agent_tool',
                description: 'Tool for agent',
                source_code: validPythonCode,
                agent_id: 'agent-123'
            });
            
            // Verify attachment was called
            expect(mockServer.api.patch).toHaveBeenCalledWith(
                '/agents/agent-123/tools/attach/new-tool-456',
                {},
                expect.objectContaining({ 
                    headers: expect.objectContaining({
                        'user_id': 'agent-123'
                    })
                })
            );
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('new-tool-456');
            expect(data.agent_id).toBe('agent-123');
            expect(data.agent_name).toBe('Test Agent');
        });
        
        it('should set user_id header when agent_id provided', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            mockServer.api.patch.mockResolvedValueOnce({});
            mockServer.api.get.mockResolvedValueOnce({ 
                data: { id: 'agent-456', name: 'Agent' } 
            });
            
            await handleUploadTool(mockServer, {
                name: 'tool',
                description: 'Test tool',
                source_code: validPythonCode,
                agent_id: 'agent-456'
            });
            
            // All API calls should have user_id header
            expect(mockServer.api.get).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'user_id': 'agent-456'
                    })
                })
            );
        });
    });
    
    describe('Python Code Validation', () => {
        it('should accept valid Python function', async () => {
            const validCode = `def process_data(data: list) -> dict:
    """Process input data"""
    return {"count": len(data), "items": data}`;
            
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'data_processor',
                description: 'Process data',
                source_code: validCode
            });
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('tool-123');
        });
        
        it('should accept Python class-based tool', async () => {
            const classCode = `class MyTool:
    def __init__(self):
        self.config = {}
    
    def execute(self, param: str) -> str:
        return f"Executed: {param}"`;
            
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'class_tool',
                description: 'Class-based tool',
                source_code: classCode
            });
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('tool-123');
        });
        
        it('should accept multi-line Python code with imports', async () => {
            const complexCode = `import json
import requests
from typing import Dict, List

def fetch_data(url: str, headers: Dict[str, str] = None) -> Dict:
    """Fetch data from URL"""
    response = requests.get(url, headers=headers or {})
    return response.json()`;
            
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'fetch_tool',
                description: 'Fetch data from URLs',
                source_code: complexCode
            });
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('tool-123');
        });
    });
    
    describe('Error Handling', () => {
        it('should throw error for missing name', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    description: 'No name',
                    source_code: 'def test(): pass'
                })
            ).rejects.toThrow('Missing required argument: name');
        });
        
        it('should throw error for non-string name', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 123,
                    description: 'Invalid name type',
                    source_code: 'def test(): pass'
                })
            ).rejects.toThrow('name (must be a string)');
        });
        
        it('should throw error for missing description', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 'test_tool',
                    source_code: 'def test(): pass'
                })
            ).rejects.toThrow('Missing required argument: description');
        });
        
        it('should throw error for non-string description', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 'test_tool',
                    description: { invalid: 'type' },
                    source_code: 'def test(): pass'
                })
            ).rejects.toThrow('description (must be a string)');
        });
        
        it('should throw error for missing source_code', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 'test_tool',
                    description: 'No code'
                })
            ).rejects.toThrow('Missing required argument: source_code');
        });
        
        it('should throw error for non-string source_code', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 'test_tool',
                    description: 'Invalid code type',
                    source_code: ['not', 'a', 'string']
                })
            ).rejects.toThrow('source_code (must be a string)');
        });
        
        it('should handle API error during tool creation', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            
            const error = new Error('Creation failed');
            error.response = { status: 400, data: { error: 'Invalid Python syntax' } };
            mockServer.api.post.mockRejectedValueOnce(error);
            
            await expect(
                handleUploadTool(mockServer, {
                    name: 'bad_tool',
                    description: 'Tool with bad code',
                    source_code: 'invalid python code {'
                })
            ).rejects.toThrow('Creation failed');
        });
        
        it('should handle API error during agent attachment', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const error = new Error('Attachment failed');
            error.response = { status: 404, data: { error: 'Agent not found' } };
            mockServer.api.patch.mockRejectedValueOnce(error);
            
            await expect(
                handleUploadTool(mockServer, {
                    name: 'tool',
                    description: 'Test tool',
                    source_code: 'def test(): pass',
                    agent_id: 'non-existent-agent'
                })
            ).rejects.toThrow('Attachment failed');
        });
    });
    
    describe('Edge Cases', () => {
        it('should reject empty source code', async () => {
            await expect(
                handleUploadTool(mockServer, {
                    name: 'empty_tool',
                    description: 'Tool with empty code',
                    source_code: ''
                })
            ).rejects.toThrow('Missing required argument: source_code');
        });
        
        it('should handle tool names with special characters', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'my-tool_v2.0',
                description: 'Tool with special chars',
                source_code: 'def test(): pass'
            });
            
            const data = expectValidToolResponse(result);
            expect(data.tool_name).toBe('my-tool_v2.0');
        });
        
        it('should handle very long source code', async () => {
            const longCode = 'def test():\n' + '    pass\n'.repeat(1000);
            
            mockServer.api.get.mockResolvedValueOnce({ data: [] });
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'tool-123' } 
            });
            
            const result = await handleUploadTool(mockServer, {
                name: 'long_tool',
                description: 'Tool with long code',
                source_code: longCode
            });
            
            expect(mockServer.api.post).toHaveBeenCalledWith(
                '/tools/',
                expect.objectContaining({
                    source_code: longCode
                }),
                expect.any(Object)
            );
            
            const data = expectValidToolResponse(result);
            expect(data.tool_id).toBe('tool-123');
        });
        
        it('should handle multiple tools with same name in list', async () => {
            const existingTools = [
                { id: 'tool-1', name: 'duplicate' },
                { id: 'tool-2', name: 'other' },
                { id: 'tool-3', name: 'duplicate' }
            ];
            
            mockServer.api.get.mockResolvedValueOnce({ data: existingTools });
            mockServer.api.delete.mockResolvedValueOnce({});
            mockServer.api.post.mockResolvedValueOnce({ 
                data: { id: 'new-tool' } 
            });
            
            await handleUploadTool(mockServer, {
                name: 'duplicate',
                description: 'Replace duplicate',
                source_code: 'def test(): pass'
            });
            
            // Should only delete the first found
            expect(mockServer.api.delete).toHaveBeenCalledTimes(1);
            expect(mockServer.api.delete).toHaveBeenCalledWith('/tools/tool-1', expect.any(Object));
        });
    });
});