FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web-portal/package.json ./apps/web-portal/
COPY apps/admin-dashboard/package.json ./apps/admin-dashboard/
COPY apps/ai-workers/package.json ./apps/ai-workers/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ts-config/package.json ./packages/ts-config/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps ./apps
COPY --from=dependencies /app/packages ./packages
COPY . .
ENV NODE_ENV=production
RUN pnpm --filter database exec prisma generate
RUN pnpm build
RUN pnpm prune --prod

FROM node:20-alpine AS ai-worker-runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/apps/ai-workers/dist ./dist
COPY --from=builder /app/apps/ai-workers/package.json ./package.json
USER nestjs
EXPOSE 4000
CMD ["node", "dist/main.js"]

FROM node:20-alpine AS web-portal-runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web-portal/next.config.js ./
COPY --from=builder /app/apps/web-portal/public ./public
COPY --from=builder /app/apps/web-portal/.next/standalone ./
COPY --from=builder /app/apps/web-portal/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
