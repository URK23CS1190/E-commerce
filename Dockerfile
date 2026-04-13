<<<<<<< HEAD
FROM nginx:alpine

COPY . /usr/share/nginx/html

EXPOSE 80
=======
FROM node:18-alpine

WORKDIR /app

# Copy server dependencies and install
COPY server/package*.json ./server/
RUN cd server && npm install --production

# Copy everything else
COPY . .

EXPOSE 3000

# Run server/index.js which requires ./app
CMD ["node", "server/index.js"]
>>>>>>> 6d83ebe (feat: NOIR e-commerce with CI/CD, Docker, K8s, live dashboard)
