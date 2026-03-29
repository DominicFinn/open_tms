FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Remove dev dependencies
RUN npm prune --production

CMD ["node", "dist/index.js"]
