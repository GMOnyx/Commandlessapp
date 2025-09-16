# Use Node 20 LTS
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install root deps (for scripts) if any
COPY package*.json ./
RUN npm ci --omit=dev || npm i --omit=dev

# Install server deps
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev || npm i --omit=dev

# Bundle app source
COPY . .

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

# Start server
CMD ["node", "server/simple-index.js"]


