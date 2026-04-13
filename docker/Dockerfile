FROM node:20-alpine
WORKDIR /app
COPY server/package.json ./server/package.json
RUN cd server && npm install
COPY public ./public
COPY server ./server
WORKDIR /app/server
EXPOSE 3000
CMD ["npm", "start"]