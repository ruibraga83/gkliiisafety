# Groundlink III Safety Dashboard — runs server.js (static + api/* handlers).
# Built as a service on the existing gl_net network; fronted by gl_nginx.
FROM node:20-alpine

WORKDIR /app

# Install deps first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App source
COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000
CMD ["node", "server.js"]
