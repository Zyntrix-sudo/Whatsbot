# Use Node.js 24 LTS version
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (will be overridden by Fly.io)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]