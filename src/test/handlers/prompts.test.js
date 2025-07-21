import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerPromptHandlers, promptRegistry } from '../../handlers/prompts.js';
import {
    ListPromptsRequestSchema,
    GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('Prompt Handlers', () => {
    let mockServer;
    let handlers;

    beforeEach(() => {
        // Clear the prompt registry before each test
        promptRegistry.clear();

        handlers = new Map();
        mockServer = {
            server: {
                setRequestHandler: vi.fn((schema, handler) => {
                    // Store handler by schema type for testing
                    if (schema === ListPromptsRequestSchema) {
                        handlers.set('prompts/list', handler);
                    } else if (schema === GetPromptRequestSchema) {
                        handlers.set('prompts/get', handler);
                    }
                }),
            },
        };
    });

    describe('registerPromptHandlers', () => {
        it('should register prompts/list and prompts/get handlers', () => {
            registerPromptHandlers(mockServer);

            expect(mockServer.server.setRequestHandler).toHaveBeenCalledTimes(2);
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                ListPromptsRequestSchema,
                expect.any(Function),
            );
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                GetPromptRequestSchema,
                expect.any(Function),
            );
        });
    });

    describe('prompts/list handler', () => {
        beforeEach(() => {
            registerPromptHandlers(mockServer);
        });

        it('should return empty list when no prompts are registered', async () => {
            const listHandler = handlers.get('prompts/list');
            const result = await listHandler({});

            expect(result).toEqual({
                prompts: [],
            });
        });

        it('should return registered prompts with all fields', async () => {
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
                title: 'Test Prompt 2',
                description: 'Second test prompt',
                arguments: [],
                handler: async () => [],
            });

            const listHandler = handlers.get('prompts/list');
            const result = await listHandler({});

            expect(result.prompts).toHaveLength(2);
            expect(result.prompts[0]).toEqual({
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
            expect(result.prompts[1]).toEqual({
                name: 'test_prompt_2',
                title: 'Test Prompt 2',
                description: 'Second test prompt',
                arguments: [],
            });
        });

        it('should not include handler function in response', async () => {
            promptRegistry.set('test_prompt', {
                name: 'test_prompt',
                title: 'Test',
                description: 'Test',
                arguments: [],
                handler: async () => [],
            });

            const listHandler = handlers.get('prompts/list');
            const result = await listHandler({});

            expect(result.prompts[0]).not.toHaveProperty('handler');
        });
    });

    describe('prompts/get handler', () => {
        beforeEach(() => {
            registerPromptHandlers(mockServer);
        });

        it('should throw error when prompt name is missing', async () => {
            const getHandler = handlers.get('prompts/get');

            await expect(getHandler({ params: {} })).rejects.toThrow(
                'Missing required parameter: name',
            );
        });

        it('should throw error when prompt is not found', async () => {
            const getHandler = handlers.get('prompts/get');

            await expect(getHandler({ params: { name: 'non_existent' } })).rejects.toThrow(
                'Unknown prompt: non_existent',
            );
        });

        it('should return prompt result from handler', async () => {
            const mockMessages = [
                {
                    role: 'user',
                    content: {
                        type: 'text',
                        text: 'Test message content',
                    },
                },
            ];

            promptRegistry.set('test_prompt', {
                name: 'test_prompt',
                title: 'Test Prompt',
                description: 'Test prompt description',
                arguments: [],
                handler: vi.fn().mockResolvedValue(mockMessages),
            });

            const getHandler = handlers.get('prompts/get');
            const result = await getHandler({
                params: {
                    name: 'test_prompt',
                    arguments: { test: 'value' },
                },
            });

            expect(result).toEqual({
                description: 'Test prompt description',
                messages: mockMessages,
            });

            // Verify handler was called with correct arguments
            expect(promptRegistry.get('test_prompt').handler).toHaveBeenCalledWith({
                test: 'value',
            });
        });

        it('should handle prompts with no arguments provided', async () => {
            promptRegistry.set('test_prompt', {
                name: 'test_prompt',
                title: 'Test',
                description: 'Test description',
                arguments: [],
                handler: vi.fn().mockResolvedValue([]),
            });

            const getHandler = handlers.get('prompts/get');
            const result = await getHandler({
                params: { name: 'test_prompt' },
            });

            expect(result).toEqual({
                description: 'Test description',
                messages: [],
            });

            // Verify handler was called with empty object when no arguments
            expect(promptRegistry.get('test_prompt').handler).toHaveBeenCalledWith({});
        });

        it('should handle handler errors gracefully', async () => {
            promptRegistry.set('error_prompt', {
                name: 'error_prompt',
                title: 'Error Prompt',
                description: 'Prompt that throws error',
                arguments: [],
                handler: vi.fn().mockRejectedValue(new Error('Handler error')),
            });

            const getHandler = handlers.get('prompts/get');

            await expect(getHandler({ params: { name: 'error_prompt' } })).rejects.toThrow(
                'Handler error',
            );
        });
    });

    describe('promptRegistry', () => {
        it('should allow registering and retrieving prompts', () => {
            const prompt = {
                name: 'test',
                title: 'Test',
                description: 'Test prompt',
                arguments: [],
                handler: async () => [],
            };

            promptRegistry.set('test', prompt);
            expect(promptRegistry.get('test')).toBe(prompt);
            expect(promptRegistry.has('test')).toBe(true);
        });

        it('should allow clearing all prompts', () => {
            promptRegistry.set('test1', { name: 'test1' });
            promptRegistry.set('test2', { name: 'test2' });

            expect(promptRegistry.size).toBe(2);

            promptRegistry.clear();

            expect(promptRegistry.size).toBe(0);
            expect(promptRegistry.has('test1')).toBe(false);
            expect(promptRegistry.has('test2')).toBe(false);
        });
    });
});
