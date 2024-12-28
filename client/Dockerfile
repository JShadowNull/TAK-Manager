# syntax=docker/dockerfile:1

# Base stage for shared dependencies
FROM node:18-slim as base
WORKDIR /app
COPY package*.json ./
RUN npm install

# Development stage
FROM base as development
ENV NODE_ENV=development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]

# Build stage
FROM base as builder
ENV NODE_ENV=production
COPY . .
RUN npm run build

# Production stage
FROM base as production
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
EXPOSE 5173
CMD ["npm", "run", "preview", "--", "--host"] 