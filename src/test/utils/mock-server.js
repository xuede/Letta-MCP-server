import { vi } from 'vitest';

/**
 * Creates a mock LettaServer instance for testing
 */
export function createMockLettaServer(overrides = {}) {
    const mockApi = {
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        patch: vi.fn(),
        delete: vi.fn(),
        request: vi.fn(),
    };

    const mockServer = {
        api: mockApi,
        server: createMockMCPServer(),
        logger: createMockLogger(),
        getApiHeaders: vi.fn().mockReturnValue({
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json',
        }),
        createErrorResponse: vi.fn((errorOrMessage, context) => {
            let message = typeof errorOrMessage === 'string'
                ? errorOrMessage
                : errorOrMessage.message || 'Unknown error';
            if (context) {
                message = `${context}: ${message}`;
            }
            throw new Error(message);
        }),
        ...overrides,
    };

    return mockServer;
}

/**
 * Creates a mock MCP Server instance
 */
export function createMockMCPServer() {
    const mockMCPServer = {
        setRequestHandler: vi.fn(),
        onerror: vi.fn(),
        connect: vi.fn(),
        close: vi.fn(),
        _handlers: new Map(),
    };

    // Mock the setRequestHandler to store handlers
    mockMCPServer.setRequestHandler.mockImplementation((type, handler) => {
        mockMCPServer._handlers.set(type, handler);
    });

    // Helper to trigger a handler
    mockMCPServer.triggerHandler = async (type, args) => {
        const handler = mockMCPServer._handlers.get(type);
        if (!handler) {
            throw new Error(`No handler registered for ${type}`);
        }
        return await handler(args);
    };

    return mockMCPServer;
}

/**
 * Creates a mock logger
 */
export function createMockLogger() {
    return {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        child: vi.fn().mockReturnThis(),
    };
}

/**
 * Creates a mock transport
 */
export function createMockTransport() {
    return {
        start: vi.fn(),
        close: vi.fn(),
        send: vi.fn(),
    };
}
