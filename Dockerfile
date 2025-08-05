FROM docker.io/node:24-slim

# Set working directory
WORKDIR /app

# Metadata
LABEL maintainer="Letta Team"
LABEL description="Letta MCP Server with HTTP transport and built-in Tailscale"
LABEL version="1.2.0"

# Install curl and Tailscale
RUN apt-get update && apt-get install -y curl iptables && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL https://tailscale.com/install.sh | sh

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install && npm install dotenv

# Copy source code
COPY src ./src

# Copy entrypoint script
COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Expose HTTP port
EXPOSE 3001

# Default environment variables
ENV PORT=3001 \
    NODE_ENV=production

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
