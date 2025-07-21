import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleUsePrompt, usePromptToolDefinition } from '../../../tools/prompts/use-prompt.js';
import { promptRegistry } from '../../../handlers/prompts.js';

describe('Use Prompt Tool', () => {
    let mockServer;

    beforeEach(() => {
        // Clear registry before each test
        promptRegistry.clear();

        // Mock server
        mockServer = {
            createErrorResponse: vi.fn((error, context) => {
                throw new Error(`${context}: ${error.message}`);
            }),
        };
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(usePromptToolDefinition).toMatchObject({
                name: 'use_prompt',
                description: expect.stringContaining('Execute a registered prompt template'),
                inputSchema: {
                    type: 'object',
                    properties: {
                        prompt_name: {
                            type: 'string',
                            description: expect.stringContaining('prompt to execute'),
                        },
                        arguments: {
                            type: 'object',
                            description: expect.stringContaining('Arguments to pass'),
                        },
                    },
                    required: ['prompt_name'],
                },
            });
        });
    });

    describe('Functionality', () => {
        it('should execute prompt with no arguments', async () => {
            const mockMessages = [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: 'Test message',
                    },
                },
            ];

            promptRegistry.set('simple_prompt', {
                name: 'simple_prompt',
                title: 'Simple Prompt',
                description: 'A simple test prompt',
                arguments: [],
                handler: vi.fn().mockResolvedValue(mockMessages),
            });

            const result = await handleUsePrompt(mockServer, {
                prompt_name: 'simple_prompt',
            });

            expect(result).toHaveProperty('content');
            expect(result.content[0].type).toBe('text');

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent).toHaveProperty('prompt_name', 'simple_prompt');
            expect(parsedContent).toHaveProperty('description', 'A simple test prompt');
            expect(parsedContent).toHaveProperty('messages', 1);
            expect(parsedContent).toHaveProperty('preview');

            // Verify handler was called with empty object
            expect(promptRegistry.get('simple_prompt').handler).toHaveBeenCalledWith({});
        });

        it('should execute prompt with arguments', async () => {
            const mockMessages = [
                {
                    role: 'system',
                    content: {
                        type: 'text',
                        text: 'Generated prompt for agent-123',
                    },
                },
            ];

            promptRegistry.set('agent_prompt', {
                name: 'agent_prompt',
                title: 'Agent Prompt',
                description: 'Prompt with parameters',
                arguments: [
                    { name: 'agent_id', required: true },
                    { name: 'message', required: false },
                ],
                handler: vi.fn().mockResolvedValue(mockMessages),
            });

            const args = {
                agent_id: 'agent-123',
                message: 'Hello',
            };

            const result = await handleUsePrompt(mockServer, {
                prompt_name: 'agent_prompt',
                arguments: args,
            });

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.messages).toBe(1);

            // Verify handler was called with correct arguments
            expect(promptRegistry.get('agent_prompt').handler).toHaveBeenCalledWith(args);
        });

        it('should handle prompts returning multiple messages', async () => {
            const multipleMessages = [
                {
                    role: 'system',
                    content: { type: 'text', text: 'System prompt' },
                },
                {
                    role: 'user',
                    content: { type: 'text', text: 'User message' },
                },
                {
                    role: 'assistant',
                    content: { type: 'text', text: 'Assistant response' },
                },
            ];

            promptRegistry.set('multi_message', {
                name: 'multi_message',
                description: 'Multi-message prompt',
                handler: vi.fn().mockResolvedValue(multipleMessages),
            });

            const result = await handleUsePrompt(mockServer, {
                prompt_name: 'multi_message',
            });

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.messages).toBe(3);
        });

        it('should include structuredContent in response', async () => {
            const messages = [{ role: 'user', content: { type: 'text', text: 'Test' } }];

            promptRegistry.set('test', {
                name: 'test',
                description: 'Test prompt',
                handler: vi.fn().mockResolvedValue(messages),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'test' });

            expect(result.structuredContent).toEqual({
                prompt_name: 'test',
                description: 'Test prompt',
                messages,
            });
        });

        it('should handle preview of long messages', async () => {
            const longText = 'A'.repeat(300);
            const messages = [{
                role: 'user',
                content: { type: 'text', text: longText },
            }];

            promptRegistry.set('long_prompt', {
                name: 'long_prompt',
                description: 'Long prompt',
                handler: vi.fn().mockResolvedValue(messages),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'long_prompt' });
            const parsedContent = JSON.parse(result.content[0].text);

            expect(parsedContent.preview.endsWith('...')).toBe(true);
            expect(parsedContent.preview.length).toBeLessThan(210);
        });
    });

    describe('Error Handling', () => {
        it('should throw error when prompt_name is missing', async () => {
            await expect(handleUsePrompt(mockServer, {}))
                .rejects.toThrow('Failed to execute prompt: Missing required parameter: prompt_name');
        });

        it('should throw error when prompt not found', async () => {
            await expect(handleUsePrompt(mockServer, { prompt_name: 'non_existent' }))
                .rejects.toThrow('Failed to execute prompt: Prompt not found: non_existent');
        });

        it('should include available prompts in error message', async () => {
            promptRegistry.set('prompt1', { name: 'prompt1', handler: async () => [] });
            promptRegistry.set('prompt2', { name: 'prompt2', handler: async () => [] });

            await expect(handleUsePrompt(mockServer, { prompt_name: 'non_existent' }))
                .rejects.toThrow('Available prompts: prompt1, prompt2');
        });

        it('should handle prompt handler errors', async () => {
            promptRegistry.set('error_prompt', {
                name: 'error_prompt',
                description: 'Error prompt',
                handler: vi.fn().mockRejectedValue(new Error('Handler failed')),
            });

            await expect(handleUsePrompt(mockServer, { prompt_name: 'error_prompt' }))
                .rejects.toThrow('Failed to execute prompt: Handler failed');
        });

        it('should handle invalid prompt return value', async () => {
            promptRegistry.set('invalid_prompt', {
                name: 'invalid_prompt',
                description: 'Invalid prompt',
                handler: vi.fn().mockResolvedValue(null), // Invalid return
            });

            // Should throw error due to null.length
            await expect(handleUsePrompt(mockServer, { prompt_name: 'invalid_prompt' }))
                .rejects.toThrow('Failed to execute prompt: Cannot read properties of null');
        });

        it('should handle prompt without description', async () => {
            promptRegistry.set('no_desc', {
                name: 'no_desc',
                // No description
                handler: vi.fn().mockResolvedValue([]),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'no_desc' });

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.description).toBeUndefined();
        });
    });

    describe('MCP Protocol Integration', () => {
        it('should call handler through MCP protocol', async () => {
            const mockHandler = vi.fn().mockResolvedValue([
                { role: 'user', content: { type: 'text', text: 'Test' } },
            ]);

            promptRegistry.set('mcp_test', {
                name: 'mcp_test',
                description: 'MCP test prompt',
                handler: mockHandler,
            });

            // Simulate MCP protocol call
            const mcpRequest = {
                method: 'prompts/get',
                params: {
                    prompt_name: 'mcp_test',
                    arguments: { key: 'value' },
                },
            };

            await handleUsePrompt(mockServer, mcpRequest.params);

            expect(mockHandler).toHaveBeenCalledWith({ key: 'value' });
        });

        it('should handle undefined arguments as empty object', async () => {
            const mockHandler = vi.fn().mockResolvedValue([]);

            promptRegistry.set('test', {
                name: 'test',
                handler: mockHandler,
            });

            await handleUsePrompt(mockServer, { prompt_name: 'test' });

            expect(mockHandler).toHaveBeenCalledWith({});
        });
    });

    describe('Output Format', () => {
        it('should format JSON output with proper indentation', async () => {
            promptRegistry.set('format_test', {
                name: 'format_test',
                description: 'Format test',
                handler: vi.fn().mockResolvedValue([
                    { role: 'user', content: { type: 'text', text: 'Test' } },
                ]),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'format_test' });

            // Check for pretty printing
            expect(result.content[0].text).toContain('\n  ');
            expect(result.content[0].text).toContain('"prompt_name": "format_test"');
        });

        it('should handle complex message structures', async () => {
            const complexMessages = [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: 'Complex message',
                        metadata: {
                            timestamp: '2024-01-01',
                            source: 'test',
                        },
                    },
                },
                {
                    role: 'assistant',
                    content: {
                        type: 'resource',
                        resource: {
                            uri: 'file:///test.txt',
                            text: 'File content',
                            mimeType: 'text/plain',
                        },
                    },
                },
            ];

            promptRegistry.set('complex', {
                name: 'complex',
                description: 'Complex prompt',
                handler: vi.fn().mockResolvedValue(complexMessages),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'complex' });

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.messages).toBe(2);
        });

        it('should handle empty messages array', async () => {
            promptRegistry.set('empty', {
                name: 'empty',
                description: 'Empty prompt',
                handler: vi.fn().mockResolvedValue([]),
            });

            const result = await handleUsePrompt(mockServer, { prompt_name: 'empty' });

            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.messages).toBe(0);
            expect(parsedContent.preview).toBe('undefined...');
        });
    });
});