# Stage 1: Build the React application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the code and build
COPY . .
# If you have environment variables (like API URL) in Dokploy, 
# they will be injected during this build step!
RUN npm run build

# Stage 2: Serve the app using Nginx
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy your custom Nginx routing configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React app from Stage 1 (adjust 'dist' to 'build' if using CRA)
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]