FROM node:20-alpine AS base
ENV NODE_ENV=production
WORKDIR /app

# Prepare server installation with cached deps
COPY server/package*.json /app/server/
WORKDIR /app/server
RUN npm ci || npm install --omit=dev --no-audit --no-fund

# Copy server source
COPY server/ /app/server/

EXPOSE 8080
CMD ["node", "simple-index.js"]


