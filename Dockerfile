FROM public.ecr.aws/docker/library/node:22-bookworm-slim AS base
RUN npm install --global bun@1.3.1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock bunfig.toml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/calendar/package.json packages/calendar/package.json
COPY packages/i18n/package.json packages/i18n/package.json
RUN ELECTRON_SKIP_BINARY_DOWNLOAD=1 bun install --frozen-lockfile

FROM deps AS source
COPY tsconfig.base.json ./
COPY apps apps
COPY packages packages
COPY deployment deployment

FROM source AS api-build
WORKDIR /app/apps/api
RUN bunx prisma generate
WORKDIR /app
RUN bun run build:api

FROM source AS admin-build
# The panel talks to the API from the browser, so its address is baked in at
# build time. Point it at the public URL of the API, not at the container.
ARG VITE_API_URL=http://localhost:3001
ARG VITE_BASE_PATH=/
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BASE_PATH=$VITE_BASE_PATH
RUN bun run --cwd apps/admin build

FROM source AS mobile-build
ARG EXPO_PUBLIC_API_PORT=3001
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_PORT=$EXPO_PUBLIC_API_PORT
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL
RUN bun run --cwd apps/mobile build:web

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

FROM public.ecr.aws/docker/library/nginx:1.27-alpine AS admin
COPY --from=admin-build /app/apps/admin/dist /usr/share/nginx/html
# The panel is a single-page app: unknown paths are routes, not missing files.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / {\n    try_files $uri $uri/ /index.html;\n  }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM public.ecr.aws/docker/library/nginx:1.27-alpine AS mobile-web
COPY --from=mobile-build /app/apps/mobile/dist /usr/share/nginx/html
COPY deployment/mobile.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

FROM source AS site-build
ENV VITE_API_URL=/api
ENV VITE_BASE_PATH=/admin/
ENV EXPO_PUBLIC_API_URL=/api
RUN bun run build:admin && mv apps/admin/dist apps/admin/path-dist && bun run --cwd apps/mobile build:web
RUN VITE_BASE_PATH=/ bun run build:admin && mv apps/admin/dist apps/admin/panel-dist

FROM api AS deployment
RUN apt-get update && apt-get install -y --no-install-recommends nginx && rm -rf /var/lib/apt/lists/*
COPY --from=site-build /app/apps/mobile/dist /usr/share/nginx/html
COPY --from=site-build /app/apps/admin/path-dist /usr/share/nginx/html/admin
COPY --from=site-build /app/apps/admin/panel-dist /usr/share/nginx/panel
COPY deployment/electron /usr/share/nginx/html/electron
COPY deployment/nginx.conf /etc/nginx/nginx.conf
COPY deployment/start.ts /app/deployment/start.ts
ENV HOST=127.0.0.1
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 CMD bun -e 'const r = await fetch("http://127.0.0.1/api/health"); process.exit(r.ok ? 0 : 1)'
CMD ["bun", "run", "/app/deployment/start.ts"]
