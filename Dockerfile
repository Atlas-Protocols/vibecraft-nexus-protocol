FROM node:20-alpine
WORKDIR /app

# Install deps
COPY package.json package-lock.json ./
RUN npm ci

# Copy only what the relay needs
COPY nexus-protocol/ ./nexus-protocol/
COPY agents/nexus-relay.ts ./agents/

ENV PORT=8080

CMD ["npx", "tsx", "agents/nexus-relay.ts"]
