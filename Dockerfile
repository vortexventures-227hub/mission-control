FROM node:22.22.3-slim AS base
# Pinned, not @latest. An unpinned image resolved a newer pnpm that did not
# apply this repo's build-script allowlist, so better-sqlite3 / node-pty never
# ran their native build steps and the install died on ERR_PNPM_IGNORED_BUILDS.
# 10.32.1 is the version this repo is verified against end to end (install,
# build, boot, SQLite migrations). Bump deliberately, not implicitly.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
# Copy only dependency manifests first for better layer caching
COPY package.json ./
COPY pnpm-lock.yaml* ./
# .npmrc carries ignore-scripts=false. It is tracked in the repo but was
# never copied into this stage, so the container installed with pnpm
# defaults while local installs used the repo settings.
COPY .npmrc ./
# better-sqlite3 requires native compilation tools
RUN apt-get update && apt-get install -y python3 make g++ --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      echo "WARN: pnpm-lock.yaml not found in build context; running non-frozen install" && \
      pnpm install --no-frozen-lockfile; \
    fi

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22.22.3-slim AS runtime

ARG MC_VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/builderz-labs/mission-control"
LABEL org.opencontainers.image.description="Mission Control - operations dashboard"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.version="${MC_VERSION}"

WORKDIR /app
ENV NODE_ENV=production
# curl, CA certs, python3, git needed for agent runtime installers (OpenClaw, Hermes)
# procps provides `ps` and `uptime` used by system-monitor APIs
RUN apt-get update && apt-get install -y curl ca-certificates python3 git make g++ procps --no-install-recommends && rm -rf /var/lib/apt/lists/*
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# OpenClaw CLI. src/lib/openclaw-gateway.ts does NOT open a socket — it shells
# out (runOpenClaw -> spawn(openclawBin)), so without this binary every session
# control call fails with `spawn openclaw ENOENT` and KILL is unreachable.
# Pinned deliberately: an unpinned agent runtime is the same trap that
# `corepack prepare pnpm@latest` just cost us on this image.
#
# 2026.7.1-2 (npm `latest`) with node bumped to 22.22.3 to satisfy its engine
# range. Ryu authorised this bump specifically to find out whether a newer
# gateway can terminate a LIVE session: on 2026.4.23 both the HTTP kill endpoint
# and the sessions.abort RPC hang indefinitely against a session that exists
# (60s with zero bytes; 83s wall for a 15s-budgeted RPC), while a nonexistent
# key returns a clean 404 in 0.24s. That hang is upstream of Mission Control.
# `--version` runs here as a build-time gate: a CLI that cannot start fails the
# image rather than surfacing as a runtime 500 — it is what caught the earlier
# EBADENGINE instead of shipping it.
RUN npm install -g openclaw@2026.7.1-2 && openclaw --version
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/src/lib/schema.sql ./src/lib/schema.sql
# node-pty is a native addon; Next standalone tracing can omit built artifacts.
# Copy the fully installed package (including native binary artifacts) from deps stage.
COPY --from=deps /app/node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty ./node_modules/.pnpm/node-pty@1.1.0/node_modules/node-pty
# Create data directory with correct ownership for SQLite
RUN mkdir -p .data && chown nextjs:nodejs .data
ENV OPENCLAW_HOME=/app/.data/openclaw
RUN mkdir -p /app/.data/openclaw && chown -R nextjs:nodejs /app/.data
RUN echo 'const http=require("http");const r=http.get("http://localhost:"+(process.env.PORT||3000)+"/api/status?action=health",s=>{process.exit(s.statusCode===200?0:1)});r.on("error",()=>process.exit(1));r.setTimeout(4000,()=>{r.destroy();process.exit(1)})' > /app/healthcheck.js
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 755 /app/docker-entrypoint.sh && \
    chmod -R a+rX /app/public/ /app/src/
USER nextjs
ENV PORT=3000
EXPOSE 3000
ENV HOSTNAME=0.0.0.0
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "/app/healthcheck.js"]
ENTRYPOINT ["/app/docker-entrypoint.sh"]
