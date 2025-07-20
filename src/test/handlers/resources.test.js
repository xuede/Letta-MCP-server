import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerResourceHandlers } from '../../handlers/resources.js';
import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    SubscribeRequestSchema,
    ListResourceTemplatesRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

describe('Resource Handlers', () => {
    let mockServer;
    let handlers;

    beforeEach(() => {
        handlers = new Map();
        mockServer = {
            server: {
                setRequestHandler: vi.fn((schema, handler) => {
                    // Map schema to handler for testing
                    if (schema === ListResourcesRequestSchema) {
                        handlers.set('resources/list', handler);
                    } else if (schema === ReadResourceRequestSchema) {
                        handlers.set('resources/read', handler);
                    } else if (schema === SubscribeRequestSchema) {
                        handlers.set('resources/subscribe', handler);
                    } else if (schema === ListResourceTemplatesRequestSchema) {
                        handlers.set('resources/templates/list', handler);
                    }
                }),
            },
            api: {
                get: vi.fn(),
            },
            getApiHeaders: vi.fn().mockReturnValue({
                'Authorization': 'Bearer test-token',
                'Content-Type': 'application/json',
            }),
            createErrorResponse: vi.fn((error) => {
                throw error;
            }),
        };
    });

    describe('registerResourceHandlers', () => {
        it('should register all resource handlers', () => {
            registerResourceHandlers(mockServer);

            expect(mockServer.server.setRequestHandler).toHaveBeenCalledTimes(4);
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                ListResourcesRequestSchema,
                expect.any(Function)
            );
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                ReadResourceRequestSchema,
                expect.any(Function)
            );
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                SubscribeRequestSchema,
                expect.any(Function)
            );
            expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
                ListResourceTemplatesRequestSchema,
                expect.any(Function)
            );
        });

        it('should have registered handlers that are functions', () => {
            registerResourceHandlers(mockServer);

            expect(handlers.get('resources/list')).toBeInstanceOf(Function);
            expect(handlers.get('resources/read')).toBeInstanceOf(Function);
            expect(handlers.get('resources/subscribe')).toBeInstanceOf(Function);
            expect(handlers.get('resources/templates/list')).toBeInstanceOf(Function);
        });
    });

    describe('resources/list handler', () => {
        beforeEach(() => {
            registerResourceHandlers(mockServer);
        });

        it('should handle resources/list request', async () => {
            const listHandler = handlers.get('resources/list');

            // Since we can't manipulate the internal registry, we'll test that
            // the handler at least returns the expected structure
            const result = await listHandler({ params: {} });

            expect(result).toHaveProperty('resources');
            expect(result.resources).toBeInstanceOf(Array);
        });

        it('should support pagination', async () => {
            const listHandler = handlers.get('resources/list');

            const result = await listHandler({ params: { cursor: '10' } });

            expect(result).toHaveProperty('resources');
            expect(result.resources).toBeInstanceOf(Array);
        });
    });

    describe('resources/read handler', () => {
        beforeEach(() => {
            registerResourceHandlers(mockServer);
        });

        it('should validate URI parameter', async () => {
            const readHandler = handlers.get('resources/read');

            await expect(
                readHandler({ params: {} })
            ).rejects.toThrow('Missing required parameter: uri');
        });

        it('should handle non-existent resources', async () => {
            const readHandler = handlers.get('resources/read');

            await expect(
                readHandler({ params: { uri: 'letta://non/existent' } })
            ).rejects.toThrow('Resource not found');
        });
    });

    describe('resources/subscribe handler', () => {
        beforeEach(() => {
            registerResourceHandlers(mockServer);
        });

        it('should validate URI parameter', async () => {
            const subscribeHandler = handlers.get('resources/subscribe');

            await expect(
                subscribeHandler({ params: {} })
            ).rejects.toThrow('Missing required parameter: uri');
        });

        it('should validate subscription ID', async () => {
            const subscribeHandler = handlers.get('resources/subscribe');

            await expect(
                subscribeHandler({
                    params: { uri: 'letta://test' },
                    meta: {}
                })
            ).rejects.toThrow('Resource not found');
        });
    });

    describe('resources/templates/list handler', () => {
        beforeEach(() => {
            registerResourceHandlers(mockServer);
        });

        it('should handle templates list request', async () => {
            const listTemplatesHandler = handlers.get('resources/templates/list');

            const result = await listTemplatesHandler({ params: {} });

            expect(result).toHaveProperty('resourceTemplates');
            expect(result.resourceTemplates).toBeInstanceOf(Array);
        });
    });
});