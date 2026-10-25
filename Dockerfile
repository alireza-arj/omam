# syntax=docker/dockerfile:1
ARG BUN_VERSION=1.3.1
FROM oven/bun:${BUN_VERSION}-slim AS bun-binary

FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS build-base
COPY --from=bun-binary /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM build-base AS manifests
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/calendar/package.json packages/calendar/package.json
COPY packages/i18n/package.json packages/i18n/package.json

# A clean install: never copy the frontend/build dependency tree to the API.
FROM manifests AS api-deps
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production --filter @omam/api --ignore-scripts
COPY apps/api/prisma/schema.prisma apps/api/prisma/schema.prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts
RUN bun node_modules/@prisma/engines/scripts/postinstall.js
WORKDIR /app/apps/api
RUN bun /app/node_modules/prisma/build/index.js generate

FROM api-deps AS api-build
WORKDIR /app
COPY apps/api/src apps/api/src
COPY apps/api/prisma/seed.ts apps/api/prisma/seed.ts
COPY packages packages
COPY tsconfig.base.json ./
RUN bun build apps/api/src/index.ts apps/api/prisma/seed.ts --target bun --external @prisma/client --minify --entry-naming '[name].[ext]' --outdir /app/runtime

FROM manifests AS admin-source
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --filter @omam/admin
COPY tsconfig.base.json ./
COPY apps/admin apps/admin
COPY packages packages

FROM admin-source AS admin-build
ARG VITE_API_URL=http://localhost:3001
ARG VITE_BASE_PATH=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN bun run --cwd apps/admin build

FROM admin-source AS site-admin-build
ENV VITE_API_URL=/api
RUN VITE_BASE_PATH=/admin/ bun run --cwd apps/admin build && mv apps/admin/dist apps/admin/path-dist
RUN VITE_BASE_PATH=/ bun run --cwd apps/admin build && mv apps/admin/dist apps/admin/panel-dist

FROM manifests AS mobile-source
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --filter @omam/mobile
COPY tsconfig.base.json ./
COPY apps/mobile apps/mobile
COPY packages packages

FROM mobile-source AS mobile-build
ARG EXPO_PUBLIC_API_PORT=3001
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_PORT=$EXPO_PUBLIC_API_PORT
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN bun run --cwd apps/mobile build:web

FROM mobile-source AS site-mobile-build
ENV EXPO_PUBLIC_API_URL=/api
RUN bun run --cwd apps/mobile build:web

FROM public.ecr.aws/docker/library/debian:bookworm-slim AS api
COPY --from=bun-binary /usr/local/bin/bun /usr/local/bin/bun
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3001
ENV TZ=Asia/Tehran
ENV BUN_RUNTIME_TRANSPILER_CACHE_PATH=0
WORKDIR /app/apps/api
COPY --from=api-deps /app/node_modules /app/node_modules
COPY --from=api-build /app/runtime ./dist
COPY --from=api-build /app/packages /app/packages
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
COPY apps/api/prisma/migrations ./prisma/migrations
COPY apps/api/prisma.config.ts ./prisma.config.ts
EXPOSE 3001
CMD ["sh", "-c", "bun /app/node_modules/prisma/build/index.js migrate deploy && bun dist/seed.js && exec bun dist/index.js"]

FROM public.ecr.aws/docker/library/nginx:1.27-alpine AS admin
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM public.ecr.aws/docker/library/nginx:1.27-alpine AS mobile-web
COPY --from=mobile-build /app/apps/mobile/dist /usr/share/nginx/html
COPY deployment/mobile.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM api AS deployment
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*
COPY --from=site-mobile-build /app/apps/mobile/dist /usr/share/nginx/html
COPY --from=site-admin-build /app/apps/admin/path-dist /usr/share/nginx/html/admin
COPY --from=site-admin-build /app/apps/admin/panel-dist /usr/share/nginx/panel
COPY deployment/nginx.conf /etc/nginx/nginx.conf
COPY deployment/start.ts /app/deployment/start.ts
ENV HOST=127.0.0.1
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 CMD bun -e 'const r = await fetch("http://127.0.0.1/api/health"); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "run", "/app/deployment/start.ts"]
