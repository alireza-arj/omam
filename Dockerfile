# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN bun install --frozen-lockfile

FROM deps AS source
COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY apps/mobile apps/mobile
COPY packages packages

FROM source AS api-build
WORKDIR /app/apps/api
RUN bunx prisma generate
WORKDIR /app
RUN bun run build:api

FROM source AS mobile-build
ARG EXPO_PUBLIC_API_PORT=3001
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_PORT=$EXPO_PUBLIC_API_PORT
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN bun run build:mobile

FROM base AS api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV DATABASE_URL=file:/data/omam.db
WORKDIR /app
COPY --from=api-build /app/package.json package.json
COPY --from=api-build /app/bun.lock bun.lock
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/apps/api/node_modules apps/api/node_modules
COPY --from=api-build /app/packages/contracts/node_modules packages/contracts/node_modules
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/prisma apps/api/prisma
COPY --from=api-build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=api-build /app/apps/api/package.json apps/api/package.json
COPY --from=api-build /app/packages/contracts packages/contracts
EXPOSE 3001
VOLUME ["/data"]
CMD ["sh", "-c", "cd /app/apps/api && bunx prisma db push --skip-generate && bun run start:prod"]

FROM nginx:1.27-alpine AS mobile-web
COPY --from=mobile-build /app/apps/mobile/dist /usr/share/nginx/html
EXPOSE 80
