import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleExportAgent, exportAgentDefinition } from '../../tools/agents/export-agent.js';
import { createMockLettaServer } from '../utils/mock-server.js';
import { fixtures } from '../utils/test-fixtures.js';
import { expectValidToolResponse } from '../utils/test-helpers.js';

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

        // Mock fs.writeFileSync
        vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
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
