import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleListPrompts, listPromptsToolDefinition } from '../../../tools/prompts/list-prompts.js';
import { promptRegistry } from '../../../handlers/prompts.js';

describe('List Prompts Tool', () => {
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
            expect(listPromptsToolDefinition).toMatchObject({
                name: 'list_prompts',
                description: expect.stringContaining('List all available prompt templates'),
                inputSchema: {
                    type: 'object',
                    properties: {},
                },
                outputSchema: {
                    type: 'object',
                    properties: {
                        total_prompts: { type: 'integer' },
                        prompts: { type: 'array' },
                    },
                    required: ['total_prompts', 'prompts'],
                },
            });
        });
    });

    describe('Functionality', () => {
        it('should return empty list when no prompts registered', async () => {
            const result = await handleListPrompts(mockServer);

            expect(result).toHaveProperty('content');
            expect(result.content[0].type).toBe('text');
            
            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent).toEqual({
                total_prompts: 0,
                prompts: [],
            });

            expect(result.structuredContent).toEqual({
                total_prompts: 0,
                prompts: [],
            });
        });

        it('should list all registered prompts', async () => {
            // Register test prompts
            promptRegistry.set('test_prompt_1', {
                name: 'test_prompt_1',
                title: 'Test Prompt 1',
                description: 'First test prompt',
                arguments: [
                    {
                        name: 'arg1',
                        title: 'Argument 1',
                        description: 'First argument',
                        required: true,
                    },
                ],
                handler: async () => [],
            });

            promptRegistry.set('test_prompt_2', {
                name: 'test_prompt_2',
                description: 'Second test prompt',
                // No title - should use name
                arguments: [],
                handler: async () => [],
            });

            const result = await handleListPrompts(mockServer);

            expect(result).toHaveProperty('content');
            expect(result.content[0].type).toBe('text');
            
            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent.total_prompts).toBe(2);
            expect(parsedContent.prompts).toHaveLength(2);
            
            // Check first prompt
            expect(parsedContent.prompts[0]).toEqual({
                name: 'test_prompt_1',
                title: 'Test Prompt 1',
                description: 'First test prompt',
                arguments: [
                    {
                        name: 'arg1',
                        title: 'Argument 1',
                        description: 'First argument',
                        required: true,
                    },
                ],
            });

            // Check second prompt uses name as title
            expect(parsedContent.prompts[1]).toEqual({
                name: 'test_prompt_2',
                title: 'test_prompt_2',
                description: 'Second test prompt',
                arguments: [],
            });
        });

        it('should handle prompts without arguments field', async () => {
            promptRegistry.set('minimal_prompt', {
                name: 'minimal_prompt',
                description: 'Minimal prompt',
                handler: async () => [],
                // No arguments field
            });

            const result = await handleListPrompts(mockServer);
            const parsedContent = JSON.parse(result.content[0].text);
            
            expect(parsedContent.prompts[0].arguments).toEqual([]);
        });

        it('should format output as pretty JSON', async () => {
            promptRegistry.set('test', {
                name: 'test',
                title: 'Test',
                description: 'Test prompt',
                arguments: [],
                handler: async () => [],
            });

            const result = await handleListPrompts(mockServer);
            const text = result.content[0].text;
            
            // Check for indentation (pretty printed)
            expect(text).toContain('\n  ');
            expect(text).toContain('"total_prompts": 1');
        });
    });

    describe('Error Handling', () => {
        it('should handle errors during prompt listing', async () => {
            // Mock Map.values to throw error
            const originalValues = Map.prototype.values;
            Map.prototype.values = vi.fn(() => {
                throw new Error('Map iteration failed');
            });

            await expect(handleListPrompts(mockServer))
                .rejects.toThrow('Failed to list prompts: Map iteration failed');

            expect(mockServer.createErrorResponse).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Map iteration failed' }),
                'Failed to list prompts'
            );

            // Restore
            Map.prototype.values = originalValues;
        });

        it('should handle errors during JSON stringification', async () => {
            // Mock JSON.stringify to throw error
            const originalStringify = JSON.stringify;
            JSON.stringify = vi.fn(() => {
                throw new TypeError('Converting circular structure to JSON');
            });

            promptRegistry.set('test', {
                name: 'test',
                description: 'Test prompt',
                handler: async () => [],
            });

            await expect(handleListPrompts(mockServer))
                .rejects.toThrow('Failed to list prompts');

            // Restore
            JSON.stringify = originalStringify;
        });
    });

    describe('Output Format', () => {
        it('should include both content and structuredContent', async () => {
            promptRegistry.set('test', {
                name: 'test',
                title: 'Test',
                description: 'Test prompt',
                arguments: [],
                handler: async () => [],
            });

            const result = await handleListPrompts(mockServer);

            // Check content format
            expect(result.content).toBeInstanceOf(Array);
            expect(result.content[0]).toHaveProperty('type', 'text');
            expect(result.content[0]).toHaveProperty('text');

            // Check structuredContent
            expect(result.structuredContent).toEqual({
                total_prompts: 1,
                prompts: [{
                    name: 'test',
                    title: 'Test',
                    description: 'Test prompt',
                    arguments: [],
                }],
            });
        });

        it('should not include handler function in output', async () => {
            const handler = async () => [];
            promptRegistry.set('test', {
                name: 'test',
                title: 'Test',
                description: 'Test prompt',
                arguments: [],
                handler,
            });

            const result = await handleListPrompts(mockServer);
            
            // Handler should not be in output
            expect(result.content[0].text).not.toContain('handler');
            expect(result.structuredContent.prompts[0]).not.toHaveProperty('handler');
        });
    });
});