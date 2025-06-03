import fs from 'fs';
import path from 'path';
import axios from 'axios'; // Assuming axios is available
import FormData from 'form-data'; // Assuming form-data is available
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Tool handler for exporting an agent's configuration
 */
export async function handleExportAgent(server, args) {
    if (!args?.agent_id) {
        server.createErrorResponse("Missing required argument: agent_id");
    }

    const agentId = args.agent_id;
    const outputPath = args.output_path || `agent_${agentId}.json`;
    const returnBase64 = args.return_base64 ?? false;
    const uploadToXBackbone = args.upload_to_xbackbone ?? true; // Defaulting to true as per example
    const xbackboneUrl = args.xbackbone_url || process.env.XBACKBONE_URL || "https://100.80.70.44"; // Example default, use env var if available
    const xbackboneToken = args.xbackbone_token || process.env.XBACKBONE_TOKEN || "token_2ec2bee6249c1c7a9b363f7925768127"; // Example default, use env var if available

    try {
        const headers = server.getApiHeaders();
        const encodedAgentId = encodeURIComponent(agentId);

        // Step 1: Fetch agent export data
        const response = await server.api.get(`/agents/${encodedAgentId}/export`, { headers });
        const agentData = response.data; // Assuming response.data is the AgentSchema JSON

        if (!agentData) {
            throw new Error("Received empty data from agent export endpoint.");
        }

        const agentJsonString = JSON.stringify(agentData, null, 2);

        // Step 2: Save locally
        const absoluteOutputPath = path.resolve(outputPath);
        try {
            fs.writeFileSync(absoluteOutputPath, agentJsonString);
        } catch (writeError) {
            console.error(`Error writing agent export to ${absoluteOutputPath}:`, writeError);
            server.createErrorResponse(`Failed to save agent export to ${absoluteOutputPath}: ${writeError.message}`);
        }

        // Step 3: Upload to XBackbone if requested
        let xbackboneResult = null;
        if (uploadToXBackbone) {
            if (!xbackboneUrl || !xbackboneToken) {
                 console.warn("XBackbone URL or Token not configured, skipping upload.");
            } else {
                try {
                    const form = new FormData();
                    form.append('upload', fs.createReadStream(absoluteOutputPath), path.basename(absoluteOutputPath));
                    form.append('token', xbackboneToken);

                    const uploadResponse = await axios.post(`${xbackboneUrl}/upload`, form, {
                        headers: {
                            ...form.getHeaders(),
                            // Add any other necessary headers for XBackbone if needed
                        },
                        // If XBackbone uses self-signed certs, might need:
                        // httpsAgent: new https.Agent({ rejectUnauthorized: false })
                    });

                    if (uploadResponse.status >= 200 && uploadResponse.status < 300 && uploadResponse.data?.url) {
                        xbackboneResult = {
                            url: uploadResponse.data.url,
                            raw_url: `${uploadResponse.data.url}/raw`,
                            // Assuming XBackbone provides a delete URL structure like this
                            delete_url: `${uploadResponse.data.url}/delete/${xbackboneToken}`
                        };
                        console.log(`Successfully uploaded ${absoluteOutputPath} to XBackbone: ${xbackboneResult.url}`);
                    } else {
                        console.error(`XBackbone upload failed with status ${uploadResponse.status}:`, uploadResponse.data);
                        // Don't fail the whole tool, just report the upload issue
                        xbackboneResult = { error: `Upload failed with status ${uploadResponse.status}` };
                    }
                } catch (uploadError) {
                    console.error(`Error uploading to XBackbone:`, uploadError);
                    xbackboneResult = { error: `Upload failed: ${uploadError.message}` };
                }
            }
        }

        // Step 4: Prepare and return result
        const resultPayload = {
            success: true,
            message: `Agent ${agentId} exported successfully to ${absoluteOutputPath}.`,
            file_path: absoluteOutputPath,
        };

        if (xbackboneResult) {
            resultPayload.xbackbone = xbackboneResult;
            if (!xbackboneResult.error) {
                 resultPayload.message += ` Uploaded to XBackbone: ${xbackboneResult.url}`;
            } else {
                 resultPayload.message += ` XBackbone upload failed: ${xbackboneResult.error}`;
            }
        }

        if (returnBase64) {
            resultPayload.base64_data = Buffer.from(agentJsonString).toString('base64');
            resultPayload.mime_type = 'application/json';
        }

        return {
            content: [{
                type: 'text',
                text: JSON.stringify(resultPayload, null, 2),
            }],
        };

    } catch (error) {
        // Handle potential 404 if agent not found, or other API errors
        if (error.response && error.response.status === 404) {
             server.createErrorResponse(`Agent not found: ${agentId}`);
        }
        console.error(`[export_agent] Error:`, error.response?.data || error.message);
        server.createErrorResponse(`Failed to export agent ${agentId}: ${error.message}`);
    }
}

/**
 * Tool definition for export_agent
 */
export const exportAgentDefinition = {
    name: 'export_agent',
    description: "Export an agent's configuration to a JSON file and optionally upload it.",
    inputSchema: {
        type: 'object',
        properties: {
            agent_id: {
                type: 'string',
                description: 'The ID of the agent to export.',
            },
            output_path: {
                type: 'string',
                description: 'Optional: Path to save the exported JSON file (e.g., my_agent.json). Defaults to agent_{agent_id}.json.',
            },
            return_base64: {
                type: 'boolean',
                description: 'Optional: If true, return the JSON content as base64 string in the response. Defaults to false.',
                default: false,
            },
            upload_to_xbackbone: {
                type: 'boolean',
                description: 'Optional: If true, upload the exported file to XBackbone. Defaults to true.',
                default: true,
            },
            xbackbone_url: {
                type: 'string',
                description: 'Optional: URL of the XBackbone instance. Defaults to environment variable or a hardcoded value.',
            },
            xbackbone_token: {
                type: 'string',
                description: 'Optional: Token for XBackbone authentication. Defaults to environment variable or a hardcoded value.',
            },
        },
        required: ['agent_id'],
    },
};