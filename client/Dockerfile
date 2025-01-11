# syntax=docker/dockerfile:1

FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Development with hot reload
ENV NODE_ENV=development
CMD ["npm", "run", "dev"] 