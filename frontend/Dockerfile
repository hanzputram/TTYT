# Frontend Dockerfile
FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 5173

# Run in dev mode for accessibility
CMD ["npm", "run", "dev", "--", "--host"]
