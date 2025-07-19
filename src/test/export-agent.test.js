import { describe, it } from 'node:test';
import assert from 'node:assert';
import { handleExportAgent, exportAgentDefinition } from '../tools/agents/export-agent.js';

describe('Export Agent Security', () => {
    it('should not have hardcoded credentials in the code', async () => {
        // Read the source file to check for hardcoded credentials
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'src/tools/agents/export-agent.js');
        const content = fs.readFileSync(filePath, 'utf8');

        // Check for the specific hardcoded token
        assert.ok(
            !content.includes('token_2ec2bee6249c1c7a9b363f7925768127'),
            'Hardcoded token found in export-agent.js',
        );

        // Check for the specific hardcoded URL
        assert.ok(
            !content.includes('"https://100.80.70.44"'),
            'Hardcoded XBackbone URL found in export-agent.js',
        );
    });

    it('should default upload_to_xbackbone to false', () => {
        const schema = exportAgentDefinition.inputSchema;
        const uploadProp = schema.properties.upload_to_xbackbone;

        assert.strictEqual(
            uploadProp.default,
            false,
            'upload_to_xbackbone should default to false for security',
        );
    });

    it('should not upload to XBackbone without credentials', async () => {
        // Mock server object
        const mockServer = {
            getApiHeaders: () => ({ Authorization: 'Bearer test' }),
            api: {
                get: async () => ({ data: { test: 'agent data' } }),
            },
            createErrorResponse: (msg) => {
                throw new Error(msg);
            },
        };

        // Clear XBackbone env vars
        const originalUrl = process.env.XBACKBONE_URL;
        const originalToken = process.env.XBACKBONE_TOKEN;
        delete process.env.XBACKBONE_URL;
        delete process.env.XBACKBONE_TOKEN;

        const args = {
            agent_id: 'test-agent',
            upload_to_xbackbone: true,
        };

        // Should succeed without uploading
        const result = await handleExportAgent(mockServer, args);
        assert.ok(result);

        // Result should not contain xbackbone_url
        const resultText = result.content[0].text;
        const resultData = JSON.parse(resultText);
        assert.ok(
            !resultData.xbackbone_url,
            'Should not have xbackbone_url when credentials are missing',
        );

        // Restore env vars
        if (originalUrl) process.env.XBACKBONE_URL = originalUrl;
        if (originalToken) process.env.XBACKBONE_TOKEN = originalToken;
    });
});
