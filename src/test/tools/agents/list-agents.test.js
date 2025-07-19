import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { handleListAgents, listAgentsToolDefinition } from '../../../tools/agents/list-agents.js';
import { createMockLettaServer } from '../../utils/mock-server.js';
import { fixtures } from '../../utils/test-fixtures.js';
import { expectValidToolResponse } from '../../utils/test-helpers.js';

describe('List Agents', () => {
    let mockServer;

    beforeEach(() => {
        mockServer = createMockLettaServer();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Tool Definition', () => {
        it('should have correct tool definition', () => {
            expect(listAgentsToolDefinition.name).toBe('list_agents');
            expect(listAgentsToolDefinition.description).toContain('List all available agents');
            expect(listAgentsToolDefinition.inputSchema.required).toEqual([]);
            expect(listAgentsToolDefinition.inputSchema.properties).toHaveProperty('filter');
        });

        it('should have optional filter parameter', () => {
            const filterProp = listAgentsToolDefinition.inputSchema.properties.filter;
            expect(filterProp.type).toBe('string');
            expect(filterProp.description).toContain('Optional filter');
        });
    });

    describe('Functionality Tests', () => {
        it('should list all agents without filter', async () => {
            const agents = [
                fixtures.agent.basic,
                fixtures.agent.minimal,
                { id: 'agent-789', name: 'Third Agent', description: 'Another test agent' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, {});

            // Verify API call
            expect(mockServer.api.get).toHaveBeenCalledWith(
                '/agents/',
                expect.objectContaining({ headers: expect.any(Object) }),
            );

            // Verify response
            const data = expectValidToolResponse(result);
            expect(data.count).toBe(3);
            expect(data.agents).toHaveLength(3);

            // Verify summarized agent structure
            data.agents.forEach((agent, index) => {
                expect(agent).toHaveProperty('id');
                expect(agent).toHaveProperty('name');
                // The description property may or may not exist in the response
                // depending on whether the source agent had it
                if (index === 1) {
                    // The minimal agent fixture might not have description property
                    // in the response even though tool maps it
                    expect(Object.keys(agent).sort()).toEqual(['id', 'name']);
                } else {
                    expect(agent).toHaveProperty('description');
                    expect(agent.description).toBe(agents[index].description);
                    expect(Object.keys(agent).sort()).toEqual(['description', 'id', 'name']);
                }
                // Verify values match
                expect(agent.id).toBe(agents[index].id);
                expect(agent.name).toBe(agents[index].name);
            });
        });

        it('should handle empty agent list', async () => {
            mockServer.api.get.mockResolvedValueOnce({ data: [] });

            const result = await handleListAgents(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(0);
            expect(data.agents).toEqual([]);
        });

        it('should filter agents by name', async () => {
            const agents = [
                { id: 'agent-1', name: 'Production Agent', description: 'Production system' },
                { id: 'agent-2', name: 'Test Agent', description: 'Testing system' },
                { id: 'agent-3', name: 'Development Agent', description: 'Dev system' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'test' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(1);
            expect(data.agents).toHaveLength(1);
            expect(data.agents[0].name).toBe('Test Agent');
        });

        it('should filter agents by description', async () => {
            const agents = [
                { id: 'agent-1', name: 'Agent One', description: 'Production deployment' },
                { id: 'agent-2', name: 'Agent Two', description: 'Development environment' },
                { id: 'agent-3', name: 'Agent Three', description: 'Testing framework' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'development' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(1);
            expect(data.agents).toHaveLength(1);
            expect(data.agents[0].name).toBe('Agent Two');
        });

        it('should perform case-insensitive filtering', async () => {
            const agents = [
                { id: 'agent-1', name: 'UPPERCASE Agent', description: 'System ONE' },
                { id: 'agent-2', name: 'lowercase agent', description: 'system two' },
                { id: 'agent-3', name: 'MixedCase Agent', description: 'System Three' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'AGENT' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(3); // All agents match
            expect(data.agents).toHaveLength(3);
        });

        it('should handle agents without descriptions', async () => {
            const agents = [
                { id: 'agent-1', name: 'With Description', description: 'Has description' },
                { id: 'agent-2', name: 'Without Description', description: null },
                { id: 'agent-3', name: 'Undefined Description' }, // No description field
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'description' });

            const data = expectValidToolResponse(result);
            // All three agents match because they all have "Description" in their name
            expect(data.count).toBe(3);
            expect(data.agents.map((a) => a.name).sort()).toEqual([
                'Undefined Description',
                'With Description',
                'Without Description',
            ]);
        });

        it('should return multiple matches when filter matches multiple agents', async () => {
            const agents = [
                {
                    id: 'agent-1',
                    name: 'Customer Support Agent',
                    description: 'Handles customer queries',
                },
                { id: 'agent-2', name: 'Sales Agent', description: 'Manages customer sales' },
                { id: 'agent-3', name: 'Admin Agent', description: 'System administration' },
            ];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'customer' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(2);
            expect(data.agents).toHaveLength(2);
            expect(data.agents.map((a) => a.id).sort()).toEqual(['agent-1', 'agent-2']);
        });

        it('should handle undefined args gracefully', async () => {
            const agents = [fixtures.agent.basic];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, undefined);

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(1);
            expect(data.agents).toHaveLength(1);
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors', async () => {
            const error = new Error('Network error');
            error.response = { status: 500, data: { error: 'Internal server error' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListAgents(mockServer, {})).rejects.toThrow('Network error');
        });

        it('should handle authentication errors', async () => {
            const error = new Error('Unauthorized');
            error.response = { status: 401, data: { error: 'Invalid credentials' } };
            mockServer.api.get.mockRejectedValueOnce(error);

            await expect(handleListAgents(mockServer, {})).rejects.toThrow('Unauthorized');
        });

        it('should handle malformed API response', async () => {
            // API returns non-array data
            mockServer.api.get.mockResolvedValueOnce({ data: { invalid: 'response' } });

            await expect(handleListAgents(mockServer, {})).rejects.toThrow();
        });
    });

    describe('Edge Cases', () => {
        it('should handle very large agent lists', async () => {
            // Create 1000 agents
            const agents = Array.from({ length: 1000 }, (_, i) => ({
                id: `agent-${i}`,
                name: `Agent ${i}`,
                description: `Description for agent ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, {});

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(1000);
            expect(data.agents).toHaveLength(1000);
        });

        it('should filter efficiently on large lists', async () => {
            const agents = Array.from({ length: 1000 }, (_, i) => ({
                id: `agent-${i}`,
                name: i % 10 === 0 ? `Special Agent ${i}` : `Regular Agent ${i}`,
                description: `Description ${i}`,
            }));

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: 'special' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(100); // Every 10th agent is special
            expect(data.agents).toHaveLength(100);
            data.agents.forEach((agent) => {
                expect(agent.name).toContain('Special');
            });
        });

        it('should handle empty filter string', async () => {
            const agents = [fixtures.agent.basic, fixtures.agent.minimal];

            mockServer.api.get.mockResolvedValueOnce({ data: agents });

            const result = await handleListAgents(mockServer, { filter: '' });

            const data = expectValidToolResponse(result);
            expect(data.count).toBe(2); // Empty filter matches all
            expect(data.agents).toHaveLength(2);
        });
    });
});
