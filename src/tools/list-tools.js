/**
 * Tool handler for listing all available tools on the Letta server, including native and MCP tools.
 */
export async function handleListTools(server, args) {
    try {
        const headers = server.getApiHeaders();
        let allTools = [];

        // 1. Fetch Native Tools
        try {
            const nativeToolsResponse = await server.api.get('/tools', { headers });
            // Ensure response.data is an array before mapping
            const nativeToolsData = Array.isArray(nativeToolsResponse.data) ? nativeToolsResponse.data : [];
            const nativeTools = nativeToolsData.map(tool => ({
                ...tool,
                source_type: tool.source_type || 'letta', // Ensure source_type
                // Ensure other potential missing fields have defaults if needed
                description: tool.description || '',
                tags: tool.tags || [],
            }));
            allTools = allTools.concat(nativeTools);
        } catch (error) {
            console.error("Failed to fetch native Letta tools:", error.message);
            // Proceeding without native tools if fetch fails, but logging the error.
        }

        // 2. Fetch MCP Servers
        let mcpServerNames = [];
        try {
            // Use the correct endpoint from list-mcp-servers.js
            const mcpServersResponse = await server.api.get('/tools/mcp/servers', { headers });
            // Extract server names from the keys of the response object
            const mcpServersData = mcpServersResponse.data || {};
            mcpServerNames = Object.keys(mcpServersData);
        } catch (error) {
            console.error("Failed to fetch MCP servers:", error.message);
            // Proceed without MCP tools if fetching servers fails
        }

        // 3. Fetch MCP Tools for each server
        if (mcpServerNames.length > 0) {
            const mcpToolPromises = mcpServerNames.map(async (serverName) => {
                try {
                    // Use the correct endpoint from list-mcp-tools-by-server.js
                    const encodedServerName = encodeURIComponent(serverName);
                    const api_path = `/tools/mcp/servers/${encodedServerName}/tools`;
                    const mcpToolsResponse = await server.api.get(api_path, {
                        headers,
                        timeout: 60000 // Keep timeout from list-mcp-tools-by-server.js
                    });

                    // Ensure response.data is an array
                    const toolsFromServer = Array.isArray(mcpToolsResponse.data) ? mcpToolsResponse.data : [];

                    // Add server name and standardize structure
                    return toolsFromServer.map(tool => ({
                        ...tool, // Spread original tool properties
                        id: `${serverName}__${tool.name}`, // Create a unique composite ID
                        name: tool.name,
                        description: tool.description || '', // Ensure description exists
                        mcp_server_name: serverName,
                        source_type: 'mcp', // Mark as MCP tool source
                        tool_type: 'mcp', // Mark as MCP tool type
                        tags: tool.tags || [], // Ensure tags exist
                        // Add other fields if needed for consistency
                    }));
                } catch (err) {
                    // Log specific errors for fetching tools from a server, but don't stop the whole process
                    console.error(`Failed to fetch tools for MCP server '${serverName}':`, err.message);
                    if (err.response && err.response.status === 404) {
                        console.warn(`MCP Server '${serverName}' not found or has no tools endpoint.`);
                    }
                    return []; // Return empty array on error for this server
                }
            });

            const results = await Promise.all(mcpToolPromises);
            const mcpTools = results.flat(); // Flatten the array of arrays from promises
            allTools = allTools.concat(mcpTools);
        }

        // 5. Apply Filtering to the combined list
        let filteredTools = allTools;
        if (args?.filter) {
            const filterLower = args.filter.toLowerCase();
            filteredTools = allTools.filter(tool =>
                (tool.name && tool.name.toLowerCase().includes(filterLower)) ||
                (tool.description && tool.description.toLowerCase().includes(filterLower)) ||
                (tool.mcp_server_name && tool.mcp_server_name.toLowerCase().includes(filterLower)) // Optional: filter by server name too
            );
        }

        // Calculate total *after* filtering
        const totalTools = filteredTools.length;

        // 6. Apply Pagination conditionally
        let page, pageSize, totalPages, paginatedTools, hasNextPage, hasPreviousPage;

        // Check if pagination is explicitly requested by providing page or pageSize
        if (args?.page !== undefined || args?.pageSize !== undefined) {
            // Pagination requested: Use existing logic or defaults if one is missing
            page = args?.page || 1;
            // Ensure pageSize is within bounds, default to 10 if only page is given or if pageSize is invalid
            pageSize = Math.max(1, Math.min(100, args?.pageSize || 10));
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            totalPages = Math.ceil(totalTools / pageSize);
            // Ensure page is within valid range
            page = Math.max(1, Math.min(page, totalPages || 1)); // Adjust page if out of bounds
            paginatedTools = filteredTools.slice(startIndex, endIndex);
            hasNextPage = page < totalPages;
            hasPreviousPage = page > 1;
        } else {
            // No pagination requested: Return all filtered tools
            paginatedTools = filteredTools; // Assign the full filtered list
            page = 1;
            pageSize = totalTools > 0 ? totalTools : 1; // Page size is the total number of tools (or 1 if empty)
            totalPages = totalTools > 0 ? 1 : 0; // Only one page if there are tools, zero if none
            hasNextPage = false;
            hasPreviousPage = false;
        }


        // 7. Summarize Tools (using the paginated or full list)
        const summarizedTools = paginatedTools.map(tool => {
            // Basic summary structure, only including required fields
            const summary = {
                id: tool.id, // Use the potentially composite ID for MCP tools
                name: tool.name,
                description: tool.description,
            };
            // Add MCP server name if applicable
            if (tool.mcp_server_name) {
                summary.mcp_server_name = tool.mcp_server_name;
            }
            return summary;
        });

        // 8. Return Combined Output
        return {
            content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    pagination: {
                        page, // Use the calculated page
                        pageSize, // Use the calculated pageSize
                        totalTools, // Total count *after* filtering remains the same
                        totalPages, // Use the calculated totalPages
                        hasNextPage, // Use the calculated value
                        hasPreviousPage // Use the calculated value
                    },
                    tool_count: summarizedTools.length, // Count of tools in the result (paginated or full)
                    tools: summarizedTools // Paginated or full summarized list
                }, null, 2),
            }],
        };
    } catch (error) {
        // Log the detailed error for debugging
        console.error("Error in handleListTools:", error);
        // Return a structured error response
        return server.createErrorResponse(error, "Failed to list tools");
    }
}

/**
 * Tool definition for list_tools
 */
export const listToolsDefinition = {
    name: 'list_tools',
    description: 'List all available tools on the Letta server, including native and MCP tools.', // Updated description
    inputSchema: {
        type: 'object',
        properties: {
            filter: {
                type: 'string',
                description: 'Optional filter to search for specific tools by name, description, or MCP server name.', // Updated description
            },
            page: {
                type: 'number',
                description: 'Page number for pagination (starts at 1)',
                // Default removed - presence indicates pagination request
            },
            pageSize: {
                type: 'number',
                description: 'Number of tools per page (1-100, default: 10 if paginating)',
                // Default removed - presence indicates pagination request
                minimum: 1,
                maximum: 100,
            },
        },
        required: [],
    },
};