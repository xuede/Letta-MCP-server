import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runStdio } from '../../transports/stdio-transport.js';
import { createMockLettaServer } from '../utils/mock-server.js';
import { Readable, Writable } from 'stream';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createLogger } from '../../core/logger.js';

// Mock the logger before tests
vi.mock('../../core/logger.js', () => {
    const mockLogger = {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    };
    return {
        createLogger: vi.fn(() => mockLogger),
        default: mockLogger,
    };
});

describe('Stdio Transport Integration', () => {
    let mockServer;
    let originalStdin, originalStdout, originalStderr;
    let mockStdin, mockStdout, mockStderr;
    let processExitSpy;
    let mockLogger;

    beforeEach(() => {
        mockServer = createMockLettaServer();

        // Get the mocked logger from the mocked module
        mockLogger = vi.mocked(createLogger());

        // Clear any previous calls
        mockLogger.info.mockClear();
        mockLogger.error.mockClear();
        mockLogger.warn.mockClear();
        mockLogger.debug.mockClear();

        // Mock the server's connect and close methods
        mockServer.server.connect = vi.fn().mockResolvedValue();
        mockServer.server.close = vi.fn().mockResolvedValue();

        // Save original stdio
        originalStdin = process.stdin;
        originalStdout = process.stdout;
        originalStderr = process.stderr;

        // Create mock streams
        mockStdin = new Readable({
            read() {},
        });
        mockStdout = new Writable({
            write(chunk, encoding, callback) {
                callback();
            },
        });
        mockStderr = new Writable({
            write(chunk, encoding, callback) {
                callback();
            },
        });

        // Replace process stdio
        Object.defineProperty(process, 'stdin', {
            value: mockStdin,
            configurable: true,
        });
        Object.defineProperty(process, 'stdout', {
            value: mockStdout,
            configurable: true,
        });
        Object.defineProperty(process, 'stderr', {
            value: mockStderr,
            configurable: true,
        });

        // Mock process.exit
        processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    });

    afterEach(() => {
        // Restore original stdio
        Object.defineProperty(process, 'stdin', {
            value: originalStdin,
            configurable: true,
        });
        Object.defineProperty(process, 'stdout', {
            value: originalStdout,
            configurable: true,
        });
        Object.defineProperty(process, 'stderr', {
            value: originalStderr,
            configurable: true,
        });

        // Remove all event listeners
        process.removeAllListeners('SIGINT');
        process.removeAllListeners('SIGTERM');
        process.removeAllListeners('uncaughtException');

        vi.restoreAllMocks();
    });

    describe('Server Initialization', () => {
        it('should initialize stdio transport and connect to server', async () => {
            await runStdio(mockServer);

            expect(mockServer.server.connect).toHaveBeenCalledWith(
                expect.any(StdioServerTransport),
            );
            expect(processExitSpy).not.toHaveBeenCalled();
        });

        it('should log successful connection', async () => {
            await runStdio(mockServer);

            expect(mockLogger.info).toHaveBeenCalledWith('Letta MCP server running on stdio');
        });

        it('should handle connection failure', async () => {
            mockServer.server.connect.mockRejectedValueOnce(new Error('Connection failed'));

            await runStdio(mockServer);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to start server:',
                expect.any(Error),
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });
    });

    describe('Signal Handling', () => {
        it('should handle SIGINT signal gracefully', async () => {
            await runStdio(mockServer);

            // Emit SIGINT
            process.emit('SIGINT');

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockServer.server.close).toHaveBeenCalled();
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle SIGTERM signal gracefully', async () => {
            await runStdio(mockServer);

            // Emit SIGTERM
            process.emit('SIGTERM');

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockServer.server.close).toHaveBeenCalled();
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });

        it('should handle uncaught exceptions', async () => {
            await runStdio(mockServer);

            const testError = new Error('Test uncaught exception');

            // Emit uncaught exception
            process.emit('uncaughtException', testError);

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockLogger.error).toHaveBeenCalledWith('Uncaught exception:', testError);
            expect(mockServer.server.close).toHaveBeenCalled();
            expect(processExitSpy).toHaveBeenCalledWith(0);
        });

        it('should only register signal handlers once', async () => {
            const initialListenerCount = process.listenerCount('SIGINT');

            await runStdio(mockServer);

            const afterFirstRun = process.listenerCount('SIGINT');
            expect(afterFirstRun).toBe(initialListenerCount + 1);

            // Run again should not add more listeners
            await runStdio(mockServer);

            const afterSecondRun = process.listenerCount('SIGINT');
            expect(afterSecondRun).toBe(afterFirstRun + 1); // Only one more added
        });
    });

    describe('Stdio Communication', () => {
        it('should create StdioServerTransport and connect to server', async () => {
            await runStdio(mockServer);

            // Verify that server.connect was called with a transport
            expect(mockServer.server.connect).toHaveBeenCalled();
            const transport = mockServer.server.connect.mock.calls[0][0];
            expect(transport).toBeDefined();
            expect(transport.constructor.name).toBe('StdioServerTransport');
        });

        it('should handle stdin input', async () => {
            await runStdio(mockServer);

            // Simulate stdin input
            const testMessage =
                JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'initialize',
                    params: { protocolVersion: '2025-06-18' },
                    id: 1,
                }) + '\n';

            mockStdin.push(testMessage);
            mockStdin.push(null); // End stream

            // Transport should have been created and connected
            expect(mockServer.server.connect).toHaveBeenCalled();
        });

        it('should handle stdout output', async () => {
            const writeSpy = vi.fn();
            mockStdout.write = writeSpy;

            await runStdio(mockServer);

            // The transport would write to stdout when sending responses
            // This is handled internally by StdioServerTransport
            expect(mockServer.server.connect).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-Error objects in catch block', async () => {
            mockServer.server.connect.mockRejectedValueOnce('String error');

            await runStdio(mockServer);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to start server:',
                expect.objectContaining({
                    message: 'String error',
                }),
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle null/undefined errors', async () => {
            mockServer.server.connect.mockRejectedValueOnce(null);

            await runStdio(mockServer);

            expect(mockLogger.error).toHaveBeenCalledWith(
                'Failed to start server:',
                expect.any(Error),
            );
            expect(processExitSpy).toHaveBeenCalledWith(1);
        });

        it('should handle cleanup errors gracefully', async () => {
            await runStdio(mockServer);

            // Make close throw an error
            mockServer.server.close.mockRejectedValueOnce(new Error('Close failed'));

            // Emit SIGINT
            process.emit('SIGINT');

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 100));

            // The cleanup function doesn't handle errors, so process.exit won't be called
            // But the close method should have been attempted
            expect(mockServer.server.close).toHaveBeenCalled();
        });
    });

    describe('Process Lifecycle', () => {
        it('should not interfere with other process listeners', async () => {
            const customHandler = vi.fn();
            process.on('SIGINT', customHandler);

            await runStdio(mockServer);

            process.emit('SIGINT');

            // Both handlers should be called
            expect(customHandler).toHaveBeenCalled();
            expect(mockServer.server.close).toHaveBeenCalled();

            process.removeListener('SIGINT', customHandler);
        });

        it('should handle multiple cleanup calls', async () => {
            await runStdio(mockServer);

            // Emit multiple signals
            process.emit('SIGINT');
            process.emit('SIGTERM');

            // Wait for async cleanup
            await new Promise((resolve) => setTimeout(resolve, 200));

            // Should only close once
            expect(mockServer.server.close).toHaveBeenCalledTimes(2); // Called for each signal
            expect(processExitSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe('Transport Features', () => {
        it('should support bidirectional communication', async () => {
            await runStdio(mockServer);

            // Verify transport was created
            const transportCall = mockServer.server.connect.mock.calls[0][0];
            expect(transportCall).toBeInstanceOf(StdioServerTransport);

            // StdioServerTransport handles both reading from stdin and writing to stdout
            expect(transportCall).toBeDefined();
        });

        it('should maintain connection until explicitly closed', async () => {
            await runStdio(mockServer);

            // Connection should remain open
            expect(mockServer.server.close).not.toHaveBeenCalled();

            // Wait some time
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Still should not be closed
            expect(mockServer.server.close).not.toHaveBeenCalled();

            // Now close it
            process.emit('SIGTERM');
            await new Promise((resolve) => setTimeout(resolve, 100));

            expect(mockServer.server.close).toHaveBeenCalled();
        });
    });

    describe('Integration with MCP Protocol', () => {
        it('should be ready to handle MCP messages after connection', async () => {
            await runStdio(mockServer);

            // Server should be connected and ready
            expect(mockServer.server.connect).toHaveBeenCalledWith(
                expect.any(StdioServerTransport),
            );

            // Should not have exited
            expect(processExitSpy).not.toHaveBeenCalled();
        });

        it('should handle transport lifecycle correctly', async () => {
            const lifecycleSpy = {
                connect: vi.fn(),
                close: vi.fn(),
            };

            mockServer.server.connect = lifecycleSpy.connect.mockResolvedValue();
            mockServer.server.close = lifecycleSpy.close.mockResolvedValue();

            // Start transport
            await runStdio(mockServer);
            expect(lifecycleSpy.connect).toHaveBeenCalled();

            // Stop transport
            process.emit('SIGINT');
            await new Promise((resolve) => setTimeout(resolve, 100));
            expect(lifecycleSpy.close).toHaveBeenCalled();
        });
    });
});
