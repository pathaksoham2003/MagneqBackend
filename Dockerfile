# Use Node 22 LTS image (adjust if you prefer another version)
FROM node:22.4.1

# Set working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# Optionally run database seed at build time:
# RUN npm run seed

# Expose your app port
EXPOSE 5000

# Start your app
CMD ["node", "index.js"]
