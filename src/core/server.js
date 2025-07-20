#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { createLogger } from './logger.js';

/**
 * Core LettaServer class that handles initialization and API communication
 */
export class LettaServer {
    /**
     * Initialize the Letta MCP server
     */
    constructor() {
        // Create logger for this module
        this.logger = createLogger('LettaServer');

        // Initialize MCP server
        this.server = new Server(
            {
                name: 'letta-server',
                version: '0.1.0',
            },
            {
                capabilities: {
                    tools: {
                        listChanged: true,
                    },
                    prompts: {
                        listChanged: true,
                    },
                    resources: {
                        subscribe: true,
                        listChanged: true,
                    },
                },
            },
        );

        // Set up error handler
        this.server.onerror = (error) => this.logger.error('MCP Error', { error });

        // Flag to track if handlers have been registered
        this.handlersRegistered = false;

        // Validate environment variables
        this.apiBase = process.env.LETTA_BASE_URL ?? '';
        this.password = process.env.LETTA_PASSWORD ?? '';
        if (!this.apiBase) {
            throw new Error('Missing required environment variable: LETTA_BASE_URL');
        }

        // Initialize axios instance
        this.apiBase = `${this.apiBase}/v1`;
        this.api = axios.create({
            baseURL: this.apiBase,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
    }

    /**
     * Get standard headers for API requests
     * @returns {Object} Headers object
     */
    getApiHeaders() {
        return {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'X-BARE-PASSWORD': `password ${this.password}`,
            Authorization: `Bearer ${this.password}`,
        };
    }

    /**
     * Create a standard error response
     * @param {Error|string} error - The error object or message
     * @param {string} [context] - Additional context for the error
     * @throws {McpError} Always throws an McpError for proper JSON-RPC handling
     */
    createErrorResponse(error, context) {
        let errorMessage = '';
        let errorCode = ErrorCode.InternalError;

        if (typeof error === 'string') {
            errorMessage = error;
        } else if (error instanceof Error) {
            errorMessage = error.message;

            // Handle specific HTTP error codes
            if (error.response?.status === 404) {
                errorCode = ErrorCode.InvalidRequest;
                errorMessage = `Resource not found: ${error.message}`;
            } else if (error.response?.status === 422) {
                errorCode = ErrorCode.InvalidParams;
                errorMessage = `Validation error: ${error.message}`;
            } else if (error.response?.status === 401 || error.response?.status === 403) {
                errorCode = ErrorCode.InvalidRequest;
                errorMessage = `Authentication/Authorization error: ${error.message}`;
            }
        } else {
            errorMessage = 'Unknown error occurred';
        }

        // Add context if provided
        if (context) {
            errorMessage = `${context}: ${errorMessage}`;
        }

        // Add additional details if available
        if (error?.response?.data) {
            errorMessage += ` Details: ${JSON.stringify(error.response.data)}`;
        }

        throw new McpError(errorCode, errorMessage);
    }
}
