# Google Cloud Run Dockerfile for Mojulo 3.0.0 MCP Server
FROM node:22-bookworm-slim

# Install system dependencies for OpenSCAD / Manifold / Chromium
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    openscad \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests
COPY package.json tsconfig.json ./

# Install dependencies and pre-fetch mojulo
RUN npm install
RUN npx -y mojulo@3.0.0 --version

# Copy source
COPY src ./src

# Build TypeScript
RUN npm run build

# Cloud Run defaults to PORT 8080
ENV PORT=8080
ENV NODE_ENV=production
ENV MOJULO_TOOL_PACKS=on

EXPOSE 8080

CMD ["node", "dist/mcp-server-bridge.js"]