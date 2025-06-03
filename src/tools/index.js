import { handleListAgents, listAgentsToolDefinition } from './list-agents.js';
import { handlePromptAgent, promptAgentToolDefinition } from './prompt-agent.js';
import { handleListAgentTools, listAgentToolsDefinition } from './list-agent-tools.js';
import { handleCreateAgent, createAgentToolDefinition } from './create-agent.js';
import { handleAttachTool, attachToolToolDefinition } from './attach-tool.js'; // Enhanced version
import { handleListMemoryBlocks, listMemoryBlocksToolDefinition } from './list-memory-blocks.js';
import { handleReadMemoryBlock, readMemoryBlockToolDefinition } from './read-memory-block.js';
import { handleUpdateMemoryBlock, updateMemoryBlockToolDefinition } from './update-memory-block.js';
import { handleAttachMemoryBlock, attachMemoryBlockToolDefinition } from './attach-memory-block.js';
import { handleCreateMemoryBlock, createMemoryBlockToolDefinition } from './create-memory-block.js';
import { handleUploadTool, uploadToolToolDefinition } from './upload-tool.js';
import { handleListMcpToolsByServer, listMcpToolsByServerDefinition } from './list-mcp-tools-by-server.js';
import { handleListMcpServers, listMcpServersDefinition } from './list-mcp-servers.js';
import { handleRetrieveAgent, retrieveAgentDefinition } from './retrieve-agent.js';
import { handleModifyAgent, modifyAgentDefinition } from './modify-agent.js';
import { handleDeleteAgent, deleteAgentDefinition } from './delete-agent.js';
import { handleListLlmModels, listLlmModelsDefinition } from './list-llm-models.js';
import { handleListEmbeddingModels, listEmbeddingModelsDefinition } from './list-embedding-models.js';
import { handleListPassages, listPassagesDefinition } from './list-passages.js';
import { handleCreatePassage, createPassageDefinition } from './create-passage.js';
import { handleModifyPassage, modifyPassageDefinition } from './modify-passage.js';
import { handleDeletePassage, deletePassageDefinition } from './delete-passage.js';
import { handleExportAgent, exportAgentDefinition } from './export-agent.js';
import { handleImportAgent, importAgentDefinition } from './import-agent.js';
import { handleCloneAgent, cloneAgentDefinition } from './clone-agent.js';
import { handleBulkAttachToolToAgents, bulkAttachToolDefinition } from './bulk-attach-tool.js';
import { handleGetAgentSummary, getAgentSummaryDefinition } from './get-agent-summary.js';
import { handleBulkDeleteAgents, bulkDeleteAgentsDefinition } from './bulk-delete-agents.js';
// Removed import for add-mcp-tool-to-letta.js
import { CallToolRequestSchema, ListToolsRequestSchema, McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Register all tool handlers with the server
 * @param {Object} server - The LettaServer instance (should likely be typed more specifically if possible)
 */
export function registerToolHandlers(server) {
    // Register tool definitions
    server.server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            // Original Tools
            listAgentsToolDefinition,
            promptAgentToolDefinition,
            listAgentToolsDefinition,
            createAgentToolDefinition,
            attachToolToolDefinition, // Enhanced version
            listMemoryBlocksToolDefinition,
            readMemoryBlockToolDefinition,
            updateMemoryBlockToolDefinition,
            attachMemoryBlockToolDefinition,
            createMemoryBlockToolDefinition,
            uploadToolToolDefinition,
            // Added Tools
            listMcpToolsByServerDefinition,
            listMcpServersDefinition,
            retrieveAgentDefinition,
            modifyAgentDefinition,
            deleteAgentDefinition,
            listLlmModelsDefinition,
            listEmbeddingModelsDefinition,
            listPassagesDefinition,
            createPassageDefinition,
            modifyPassageDefinition,
            deletePassageDefinition,
            exportAgentDefinition,
            importAgentDefinition,
            cloneAgentDefinition,
            bulkAttachToolDefinition,
            getAgentSummaryDefinition,
            bulkDeleteAgentsDefinition,
            // Removed addMcpToolToLettaDefinition from list
        ],
    }));

    // Register tool call handler
    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        switch (request.params.name) {
            // Original Tools
            case 'list_agents':
                return handleListAgents(server, request.params.arguments);
            case 'prompt_agent':
                return handlePromptAgent(server, request.params.arguments);
            case 'list_agent_tools':
                return handleListAgentTools(server, request.params.arguments);
            case 'create_agent':
                return handleCreateAgent(server, request.params.arguments);
            case 'attach_tool': // Enhanced version
                return handleAttachTool(server, request.params.arguments);
            case 'list_memory_blocks':
                return handleListMemoryBlocks(server, request.params.arguments);
            case 'read_memory_block':
                return handleReadMemoryBlock(server, request.params.arguments);
            case 'update_memory_block':
                return handleUpdateMemoryBlock(server, request.params.arguments);
            case 'attach_memory_block':
                return handleAttachMemoryBlock(server, request.params.arguments);
            case 'create_memory_block':
                return handleCreateMemoryBlock(server, request.params.arguments);
            case 'upload_tool':
                return handleUploadTool(server, request.params.arguments);
            // Added Tools
            case 'list_mcp_tools_by_server':
                return handleListMcpToolsByServer(server, request.params.arguments);
            case 'list_mcp_servers':
                return handleListMcpServers(server, request.params.arguments);
            case 'retrieve_agent':
                return handleRetrieveAgent(server, request.params.arguments);
            case 'modify_agent':
                return handleModifyAgent(server, request.params.arguments);
            case 'delete_agent':
                return handleDeleteAgent(server, request.params.arguments);
            case 'list_llm_models':
                return handleListLlmModels(server, request.params.arguments);
            case 'list_embedding_models':
                return handleListEmbeddingModels(server, request.params.arguments);
            case 'list_passages':
                return handleListPassages(server, request.params.arguments);
            case 'create_passage':
                return handleCreatePassage(server, request.params.arguments);
            case 'modify_passage':
                return handleModifyPassage(server, request.params.arguments);
            case 'delete_passage':
                return handleDeletePassage(server, request.params.arguments);
            case 'export_agent':
                return handleExportAgent(server, request.params.arguments);
            case 'import_agent':
                return handleImportAgent(server, request.params.arguments);
            case 'clone_agent':
                return handleCloneAgent(server, request.params.arguments);
            case 'bulk_attach_tool_to_agents':
                return handleBulkAttachToolToAgents(server, request.params.arguments);
            case 'get_agent_summary':
                return handleGetAgentSummary(server, request.params.arguments);
            case 'bulk_delete_agents':
                return handleBulkDeleteAgents(server, request.params.arguments);
            // Removed case 'add_mcp_tool_to_letta'
            default:
                throw new McpError(
                    ErrorCode.MethodNotFound,
                    `Unknown tool: ${request.params.name}`
                );
        }
    });
}

// Export all tool definitions
export const toolDefinitions = [
    listAgentsToolDefinition,
    promptAgentToolDefinition,
    listAgentToolsDefinition,
    createAgentToolDefinition,
    attachToolToolDefinition, // Enhanced version
    listMemoryBlocksToolDefinition,
    readMemoryBlockToolDefinition,
    updateMemoryBlockToolDefinition,
    attachMemoryBlockToolDefinition,
    createMemoryBlockToolDefinition,
    uploadToolToolDefinition,
    listMcpToolsByServerDefinition,
    listMcpServersDefinition,
    retrieveAgentDefinition,
    modifyAgentDefinition,
    deleteAgentDefinition,
    listLlmModelsDefinition,
    listEmbeddingModelsDefinition,
    listPassagesDefinition,
    createPassageDefinition,
    modifyPassageDefinition,
    deletePassageDefinition,
    exportAgentDefinition,
    importAgentDefinition,
    cloneAgentDefinition,
    bulkAttachToolDefinition,
    getAgentSummaryDefinition,
    bulkDeleteAgentsDefinition,
    // Removed addMcpToolToLettaDefinition from export
];

// Export all tool handlers
export const toolHandlers = {
    handleListAgents,
    handlePromptAgent,
    handleListAgentTools,
    handleCreateAgent,
    handleAttachTool, // Enhanced version
    handleListMemoryBlocks,
    handleReadMemoryBlock,
    handleUpdateMemoryBlock,
    handleAttachMemoryBlock,
    handleCreateMemoryBlock,
    handleUploadTool,
    handleListMcpToolsByServer,
    handleListMcpServers,
    handleRetrieveAgent,
    handleModifyAgent,
    handleDeleteAgent,
    handleListLlmModels,
    handleListEmbeddingModels,
    handleListPassages,
    handleCreatePassage,
    handleModifyPassage,
    handleDeletePassage,
    handleExportAgent,
    handleImportAgent,
    handleCloneAgent,
    handleBulkAttachToolToAgents,
    handleGetAgentSummary,
    handleBulkDeleteAgents,
    // Removed handleAddMcpToolToLetta from export
};