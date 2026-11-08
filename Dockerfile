# Build assets and the Express bundle with the locked dependency graph.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Runtime image contains only production dependencies and built artifacts.
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server/migrations ./server/migrations

RUN mkdir -p /app/uploads /app/server/data \
  && chown -R node:node /app/uploads /app/server/data

USER node
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
