# Contributing to Letta MCP Server

Thank you for your interest in contributing to the Letta MCP Server! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Development Guidelines](#development-guidelines)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Style Guide](#style-guide)
- [Adding New Tools](#adding-new-tools)
- [Documentation](#documentation)

## Code of Conduct

This project follows a standard code of conduct. Please be respectful and professional in all interactions.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Letta-MCP-server.git
   cd Letta-MCP-server
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/oculairmedia/Letta-MCP-server.git
   ```

## Development Setup

### Prerequisites

- Node.js 20.x or 22.x
- npm 8.x or higher
- A Letta instance for testing (or use mock server)
- Git

### Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your Letta credentials
```

### Running Locally

```bash
# Development mode with auto-reload
npm run dev         # stdio transport
npm run dev:http    # HTTP transport
npm run dev:sse     # SSE transport

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run lint

# Format code
npm run format
```

## How to Contribute

### Reporting Issues

- Check existing issues before creating a new one
- Use issue templates when available
- Include:
  - Clear description of the problem
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment details (OS, Node version, etc.)
  - Error messages and logs

### Suggesting Features

- Open an issue with `[Feature Request]` prefix
- Describe the use case and benefits
- Consider implementation approach
- Be open to discussion and feedback

### Contributing Code

1. **Find or Create an Issue**
   - Look for issues tagged `good first issue` or `help wanted`
   - Comment on the issue to claim it
   - Create an issue if none exists for your contribution

2. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

3. **Make Your Changes**
   - Follow the coding style guide
   - Add tests for new functionality
   - Update documentation as needed

4. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run format:check
   ```

## Development Guidelines

### Project Structure

```
src/
├── core/           # Core server functionality
├── handlers/       # MCP protocol handlers
├── tools/          # Tool implementations
│   ├── agents/     # Agent management tools
│   ├── memory/     # Memory management tools
│   ├── passages/   # Passage management tools
│   ├── tools/      # Tool management tools
│   ├── mcp/        # MCP integration tools
│   └── models/     # Model listing tools
├── transports/     # Transport implementations
└── test/           # Test files
```

### Adding New Tools

1. **Create Tool File**
   ```javascript
   // src/tools/category/tool-name.js
   import { z } from 'zod';
   import { zodToJsonSchema } from 'zod-to-json-schema';

   // Define input schema
   const ToolNameArgsSchema = z.object({
       param1: z.string().describe('Description of param1'),
       param2: z.number().optional().describe('Optional param2')
   });

   // Define tool
   export const toolNameToolDefinition = {
       name: 'tool_name',
       description: 'What this tool does',
       inputSchema: zodToJsonSchema(ToolNameArgsSchema)
   };

   // Implement handler
   export async function handleToolName(server, args) {
       try {
           const validatedArgs = ToolNameArgsSchema.parse(args);
           
           // Tool implementation
           const result = await server.api.post('/endpoint', {
               // API call
           }, {
               headers: server.getApiHeaders()
           });

           return {
               content: [{
                   type: 'text',
                   text: JSON.stringify(result.data, null, 2)
               }]
           };
       } catch (error) {
           return server.createErrorResponse(error, 'Tool name error');
       }
   }
   ```

2. **Add Output Schema** (src/tools/output-schemas.js)
   ```javascript
   tool_name: {
       type: 'object',
       properties: {
           success: { type: 'boolean' },
           data: { type: 'object' }
       },
       required: ['success', 'data']
   }
   ```

3. **Add Annotations** (src/tools/annotations.js)
   ```javascript
   tool_name: {
       costLevel: 'low',    // low, medium, high
       executionTime: 'fast', // fast, medium, slow
       dangerous: false,
       requiresAuth: true,
       rateLimit: null,
       tags: ['category']
   }
   ```

4. **Register Tool** (src/tools/index.js)
   - Import the tool
   - Add to allTools array
   - Add case in switch statement

5. **Add Tests**
   ```javascript
   // src/test/tools/category/tool-name.test.js
   import { describe, it, expect, vi } from 'vitest';
   import { handleToolName, toolNameToolDefinition } from '../../../tools/category/tool-name.js';

   describe('Tool Name', () => {
       // Test implementation
   });
   ```

6. **Update Documentation**
   - Add to README.md tools table
   - Update tool count in documentation

### Error Handling

- Always validate inputs with Zod schemas
- Use `server.createErrorResponse()` for consistent error formatting
- Include helpful error messages with context
- Log errors appropriately

### Testing

#### Unit Tests
- Test each tool handler independently
- Mock server and API calls
- Test error cases and edge cases
- Aim for >90% coverage

#### Integration Tests
- Test MCP protocol compliance
- Test transport layers
- Test with real Letta API (optional)

#### Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npm test src/test/tools/agents/create-agent.test.js

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Style Guide

### JavaScript/TypeScript

- Use ES6+ features
- Async/await over promises
- Descriptive variable names
- JSDoc comments for functions
- No console.log in production code

### Formatting

- Prettier handles formatting automatically
- Run `npm run format` before committing
- 4 spaces for indentation
- Single quotes for strings
- No semicolons (Prettier config)
- Max line length: 100 characters

### Git Commits

Follow conventional commits:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(tools): add bulk update passages tool
fix(transport): handle connection timeout in HTTP transport
docs: update contributing guidelines
test(agents): add tests for clone agent tool
```

## Submitting Changes

### Pull Request Process

1. **Update Your Fork**
   ```bash
   git fetch upstream
   git checkout master
   git merge upstream/master
   ```

2. **Push Your Branch**
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Create Pull Request**
   - Use the PR template
   - Reference related issues
   - Describe changes clearly
   - Include test results
   - Add screenshots if UI changes

4. **PR Requirements**
   - All tests pass
   - Coverage maintained or improved
   - Linting passes
   - Documentation updated
   - Commit messages follow convention

### Review Process

- PRs require at least one review
- Address review feedback promptly
- Keep PRs focused and small when possible
- Be patient and respectful

## Documentation

### Code Documentation

- Add JSDoc comments to all exported functions
- Document complex logic inline
- Update README for user-facing changes
- Keep examples up to date

### API Documentation

- Document new tool parameters
- Include example requests/responses
- Note any breaking changes
- Update OpenAPI spec if applicable

## Questions?

- Open an issue for clarification
- Join discussions in existing issues
- Check the [documentation](../README.md)
- Review existing code for patterns

Thank you for contributing to Letta MCP Server! 🎉