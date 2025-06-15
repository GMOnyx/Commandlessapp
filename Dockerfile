# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source code
COPY . .

# Build the backend
RUN npm run build:backend

# Production stage
FROM node:20-alpine
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=5001

# Copy built application
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./
COPY --from=build /app/shared ./shared

# Install only production dependencies
RUN npm ci --only=production --prefer-offline

# Expose port
EXPOSE 5001

# Start the application
CMD ["node", "dist/index.js"] 