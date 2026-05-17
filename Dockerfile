# Use Node.js 20 LTS for broad compatibility and reproducible builds
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Render / Railway will set a PORT env var automatically)
EXPOSE 3000

# Start the application
CMD ["npm", "start"]