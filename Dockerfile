# ---- Build: install everything, compile the server and bundle the web app ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime: production dependencies + compiled output only ----
FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server/migrations ./server/migrations
COPY server/data ./server/data
# Railway mounts volumes owned by root, so the app runs as root inside its
# container to be able to write uploaded files to the volume.
EXPOSE 4000
# Migrations run automatically on startup (see server/src/index.ts).
CMD ["node", "dist/server/index.js"]
