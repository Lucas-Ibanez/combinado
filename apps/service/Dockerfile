FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

COPY dist/ ./dist/

CMD ["node", "dist/index.js"]
