import { beforeEach, afterEach, vi } from 'vitest';

// Silence logger during tests by default
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'error';

// Mock timers configuration
beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
});

afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
});

// Global test utilities
global.testUtils = {
    // Create a mock response object
    createMockResponse: (data, status = 200) => ({
        data,
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        headers: {},
        config: {},
    }),

    // Create a mock error
    createMockError: (message, code = 'UNKNOWN_ERROR', status = 500) => {
        const error = new Error(message);
        error.code = code;
        error.response = {
            status,
            data: { error: message },
        };
        return error;
    },

    // Wait for promises to resolve
    flushPromises: () => new Promise(resolve => setImmediate(resolve)),
};

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LETTA_BASE_URL = 'https://test.letta.com/v1';
process.env.LETTA_PASSWORD = 'test-password';
