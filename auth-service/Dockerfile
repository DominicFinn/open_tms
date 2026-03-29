FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
COPY ../backend/prisma ./prisma-schema
RUN npx prisma generate --schema=./prisma-schema/schema.prisma
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh
EXPOSE 3002
ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "dist/index.js"]
