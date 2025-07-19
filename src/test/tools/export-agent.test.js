import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleExportAgent, exportAgentDefinition } from '../../tools/agents/export-agent.js';
import { createMockLettaServer } from '../utils/mock-server.js';
import { fixtures } from '../utils/test-fixtures.js';
import { expectValidToolResponse } from '../utils/test-helpers.js';

// Create mock instances that will be used in tests
const mockFormDataInstance = {
    append: vi.fn(),
    getHeaders: vi.fn().mockReturnValue({ 'content-type': 'multipart/form-data' }),
};

// Mock axios globally
const mockAxios = {
    post: vi.fn(),
};

// Mock dependencies
vi.mock('axios', () => ({
    default: mockAxios,
}));

vi.mock('form-data', () => ({
    default: vi.fn(() => mockFormDataInstance),
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('Export Agent', () => {
    let mockServer;
    let originalEnv;

    beforeEach(() => {
        mockServer = createMockLettaServer();
        originalEnv = {
            XBACKBONE_URL: process.env.XBACKBONE_URL,
            XBACKBONE_TOKEN: process.env.XBACKBONE_TOKEN,
        };

        // Clear mocks
        vi.clearAllMocks();
        mockFormDataInstance.append.mockClear();
        mockFormDataInstance.getHeaders.mockReturnValue({ 'content-type': 'multipart/form-data' });
        mockAxios.post.mockClear();

        // Mock fs methods
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
        vi.spyOn(fs, 'createReadStream').mockReturnValue({
            pipe: vi.fn(),
            on: vi.fn(),
        });
    });

    afterEach(() => {
        process.env.XBACKBONE_URL = originalEnv.XBACKBONE_URL;
        process.env.XBACKBONE_TOKEN = originalEnv.XBACKBONE_TOKEN;
        vi.restoreAllMocks();
    });

    describe('Security Tests', () => {
        it('should not have hardcoded credentials in the code', async () => {
            const filePath = path.join(__dirname, '../../tools/agents/export-agent.js');
            const content = fs.readFileSync(filePath, 'utf8');

            expect(content).not.toContain('token_2ec2bee6249c1c7a9b363f7925768127');
            expect(content).not.toContain('"https://100.80.70.44"');
        });

        it('should default upload_to_xbackbone to false', () => {
            const schema = exportAgentDefinition.inputSchema;
            const uploadProp = schema.properties.upload_to_xbackbone;

            expect(uploadProp.default).toBe(false);
        });
    });

    describe('Functionality Tests', () => {
        it('should export agent successfully', async () => {
            const agentData = fixtures.agent.basic;
            mockServer.api.get.mockResolvedValue({ data: agentData });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                output_path: 'test-export.json',
            });

            const data = expectValidToolResponse(result);
            expect(data.agent_id).toBe('agent-123');
            expect(data.file_path).toContain('test-export.json');
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.stringContaining('test-export.json'),
                JSON.stringify(agentData, null, 2),
            );
        });

        it('should return base64 data when requested', async () => {
            const agentData = fixtures.agent.basic;
            mockServer.api.get.mockResolvedValue({ data: agentData });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                return_base64: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.base64_data).toBeDefined();

            const decoded = Buffer.from(data.base64_data, 'base64').toString();
            expect(JSON.parse(decoded)).toEqual(agentData);
        });

        it('should not upload to XBackbone without credentials', async () => {
            delete process.env.XBACKBONE_URL;
            delete process.env.XBACKBONE_TOKEN;

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'test-agent',
                upload_to_xbackbone: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.xbackbone_url).toBeUndefined();
            // The logger.warn is called directly in the tool, not through mockServer
        });

        it('should handle agent not found error', async () => {
            const error = new Error('Not found');
            error.response = { status: 404 };
            mockServer.api.get.mockRejectedValue(error);

            await expect(
                handleExportAgent(mockServer, { agent_id: 'nonexistent' }),
            ).rejects.toThrow('Agent not found');
        });

        it('should handle file write errors', async () => {
            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            fs.writeFileSync.mockImplementation(() => {
                throw new Error('Permission denied');
            });

            await expect(handleExportAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                /Failed to save agent export/,
            );
        });

        it('should upload to XBackbone successfully', async () => {
            process.env.XBACKBONE_URL = 'https://xbackbone.test';
            process.env.XBACKBONE_TOKEN = 'test-token';

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            mockAxios.post.mockResolvedValue({
                status: 200,
                data: { url: 'https://xbackbone.test/file/abc123' },
            });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                upload_to_xbackbone: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.xbackbone_url).toBe('https://xbackbone.test/file/abc123');
            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://xbackbone.test/upload',
                mockFormDataInstance,
                expect.any(Object),
            );
            expect(mockFormDataInstance.append).toHaveBeenCalledWith('token', 'test-token');
        });

        it('should handle XBackbone upload errors', async () => {
            process.env.XBACKBONE_URL = 'https://xbackbone.test';
            process.env.XBACKBONE_TOKEN = 'test-token';

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            mockAxios.post.mockRejectedValue(new Error('Network error'));

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                upload_to_xbackbone: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.xbackbone_url).toBeUndefined();
            expect(data.agent_id).toBe('agent-123');
            expect(data.file_path).toBeDefined();
        });

        it('should handle XBackbone non-200 status', async () => {
            process.env.XBACKBONE_URL = 'https://xbackbone.test';
            process.env.XBACKBONE_TOKEN = 'test-token';

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            mockAxios.post.mockResolvedValue({
                status: 400,
                data: { error: 'Bad request' },
            });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                upload_to_xbackbone: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.xbackbone_url).toBeUndefined();
        });

        it('should use provided XBackbone credentials over env vars', async () => {
            process.env.XBACKBONE_URL = 'https://env.xbackbone.test';
            process.env.XBACKBONE_TOKEN = 'env-token';

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            mockAxios.post.mockResolvedValue({
                status: 200,
                data: { url: 'https://custom.xbackbone.test/file/xyz789' },
            });

            await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                upload_to_xbackbone: true,
                xbackbone_url: 'https://custom.xbackbone.test',
                xbackbone_token: 'custom-token',
            });

            expect(mockAxios.post).toHaveBeenCalledWith(
                'https://custom.xbackbone.test/upload',
                mockFormDataInstance,
                expect.any(Object),
            );
            expect(mockFormDataInstance.append).toHaveBeenCalledWith('token', 'custom-token');
        });

        it('should handle empty agent data', async () => {
            mockServer.api.get.mockResolvedValue({ data: null });

            await expect(handleExportAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                'Received empty data from agent export endpoint',
            );
        });

        it('should handle API errors', async () => {
            const error = new Error('API Error');
            error.response = { status: 500, data: { detail: 'Internal server error' } };
            mockServer.api.get.mockRejectedValue(error);

            await expect(handleExportAgent(mockServer, { agent_id: 'agent-123' })).rejects.toThrow(
                /Failed to export agent/,
            );
        });

        it('should handle missing agent_id', async () => {
            await expect(handleExportAgent(mockServer, {})).rejects.toThrow();
        });

        it('should use default output path when not provided', async () => {
            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'test-agent-456',
            });

            const data = expectValidToolResponse(result);
            expect(data.file_path).toContain('agent_test-agent-456.json');
        });

        it('should handle XBackbone response without URL', async () => {
            process.env.XBACKBONE_URL = 'https://xbackbone.test';
            process.env.XBACKBONE_TOKEN = 'test-token';

            mockServer.api.get.mockResolvedValue({ data: fixtures.agent.basic });
            mockAxios.post.mockResolvedValue({
                status: 200,
                data: { message: 'Success but no URL' }, // No url field
            });

            const result = await handleExportAgent(mockServer, {
                agent_id: 'agent-123',
                upload_to_xbackbone: true,
            });

            const data = expectValidToolResponse(result);
            expect(data.xbackbone_url).toBeUndefined();
        });
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(exportAgentDefinition.name).toBe('export_agent');
            expect(exportAgentDefinition.description).toContain('Export an agent');
            expect(exportAgentDefinition.inputSchema.required).toEqual(['agent_id']);
            expect(exportAgentDefinition.inputSchema.properties).toHaveProperty('agent_id');
            expect(exportAgentDefinition.inputSchema.properties).toHaveProperty('output_path');
            expect(exportAgentDefinition.inputSchema.properties).toHaveProperty('return_base64');
            expect(exportAgentDefinition.inputSchema.properties).toHaveProperty(
                'upload_to_xbackbone',
            );
        });
    });
});
