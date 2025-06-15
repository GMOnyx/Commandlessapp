# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Copy main package.json for build tools and backend code
COPY package.json package-lock.json ./
COPY server ./server
COPY shared ./shared

# Install dependencies for build
RUN npm ci --prefer-offline

# Build backend with esbuild directly
RUN npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Production stage
FROM node:20-alpine
WORKDIR /app

# Set environment
ENV NODE_ENV=production
ENV PORT=5001

# Copy backend-only package.json for production
COPY package.backend.json package.json
RUN npm install --only=production --prefer-offline

# Copy built application and shared code
COPY --from=build /app/dist ./dist
COPY --from=build /app/shared ./shared

# Expose port
EXPOSE 5001

# Start the application
CMD ["node", "dist/index.js"] 