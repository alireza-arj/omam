# syntax=docker/dockerfile:1.7

FROM oven/bun:1.3.1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/calendar/package.json packages/calendar/package.json
RUN bun install --frozen-lockfile

FROM deps AS source
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages

FROM source AS api-build
WORKDIR /app/apps/api
RUN bunx prisma generate
WORKDIR /app
RUN bun run build:api

FROM source AS admin-build
# The panel talks to the API from the browser, so its address is baked in at
# build time. Point it at the public URL of the API, not at the container.
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL
RUN bun run --cwd apps/admin build

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
# Dates are read in the host's zone, so the container runs in the team's.
ENV TZ=Asia/Tehran
WORKDIR /app
COPY --from=api-build /app/package.json package.json
COPY --from=api-build /app/bun.lock bun.lock
COPY --from=api-build /app/node_modules node_modules
COPY --from=api-build /app/apps/api/node_modules apps/api/node_modules
COPY --from=api-build /app/apps/api/dist apps/api/dist
COPY --from=api-build /app/apps/api/prisma apps/api/prisma
# The seed runs on boot and needs the hashing helpers it shares with the API.
COPY --from=api-build /app/apps/api/src apps/api/src
COPY --from=api-build /app/apps/api/prisma.config.ts apps/api/prisma.config.ts
COPY --from=api-build /app/apps/api/package.json apps/api/package.json
COPY --from=api-build /app/packages packages
EXPOSE 3001
# Migrations run forward only and the seed is idempotent: it creates the first
# organization and owner once, then leaves them alone.
CMD ["sh", "-c", "cd /app/apps/api && bunx prisma migrate deploy && bun run prisma/seed.ts && bun run start:prod"]

FROM nginx:1.27-alpine AS admin
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html
# The panel is a single-page app: unknown paths are routes, not missing files.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM nginx:1.27-alpine AS mobile-web
COPY --from=mobile-build /app/apps/mobile/dist /usr/share/nginx/html
EXPOSE 80
