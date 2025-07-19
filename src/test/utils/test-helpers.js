import { vi } from 'vitest';

/**
 * Helper function to test error handling in tool handlers
 */
export async function expectErrorResponse(fn, expectedError) {
    try {
        await fn();
        throw new Error('Expected function to throw');
    } catch (error) {
        if (expectedError.message) {
            expect(error.message).toContain(expectedError.message);
        }
        if (expectedError.code) {
            expect(error.code).toBe(expectedError.code);
        }
    }
}

/**
 * Helper to create a successful API response mock
 */
export function mockApiSuccess(mockApi, method, endpoint, responseData) {
    mockApi[method].mockImplementation((url) => {
        if (url === endpoint || url.includes(endpoint)) {
            return Promise.resolve({
                data: responseData,
                status: 200,
                statusText: 'OK',
            });
        }
        return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });
}

/**
 * Helper to create an API error response mock
 */
export function mockApiError(mockApi, method, endpoint, error) {
    mockApi[method].mockImplementation((url) => {
        if (url === endpoint || url.includes(endpoint)) {
            return Promise.reject(error);
        }
        return Promise.reject(new Error(`Unexpected endpoint: ${url}`));
    });
}

/**
 * Helper to verify tool response format
 */
export function expectValidToolResponse(response) {
    expect(response).toBeDefined();
    expect(response.content).toBeDefined();
    expect(Array.isArray(response.content)).toBe(true);
    expect(response.content.length).toBeGreaterThan(0);
    
    const content = response.content[0];
    expect(content.type).toBe('text');
    expect(content.text).toBeDefined();
    
    return JSON.parse(content.text);
}

/**
 * Helper to create a mock request/response for transport tests
 */
export function createMockHttpContext() {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        write: vi.fn().mockReturnThis(),
        end: vi.fn().mockReturnThis(),
        setHeader: vi.fn().mockReturnThis(),
        writeHead: vi.fn().mockReturnThis(),
        finished: false,
    };
    
    const req = {
        body: {},
        headers: {},
        method: 'POST',
        url: '/',
    };
    
    return { req, res };
}

/**
 * Helper to wait for async operations
 */
export function waitFor(condition, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const interval = 100;
        let elapsed = 0;
        
        const check = () => {
            if (condition()) {
                resolve();
            } else if (elapsed >= timeout) {
                reject(new Error('Timeout waiting for condition'));
            } else {
                elapsed += interval;
                setTimeout(check, interval);
            }
        };
        
        check();
    });
}

/**
 * Helper to capture console output during tests
 */
export function captureConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const captured = {
        log: [],
        error: [],
        warn: [],
    };
    
    console.log = (...args) => captured.log.push(args.join(' '));
    console.error = (...args) => captured.error.push(args.join(' '));
    console.warn = (...args) => captured.warn.push(args.join(' '));
    
    return {
        captured,
        restore: () => {
            console.log = originalLog;
            console.error = originalError;
            console.warn = originalWarn;
        },
    };
}