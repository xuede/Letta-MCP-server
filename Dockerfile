FROM docker.io/node:24-slim

# Set working directory
WORKDIR /app

# Add metadata labels
LABEL maintainer="Letta Team"
LABEL description="Letta MCP Server running over HTTP"
LABEL version="1.1.0"

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY src ./src

# Create a non-root user and switch to it
RUN groupadd -r letta && useradd -r -g letta letta
RUN chown -R letta:letta /app
USER letta

# Expose the port
EXPOSE 3001

# Default environment variables
ENV PORT=3001
ENV NODE_ENV=production

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Run the server over HTTP
CMD ["node", "./src/index.js", "--http"]
