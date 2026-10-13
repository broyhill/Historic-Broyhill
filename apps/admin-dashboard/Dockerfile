FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/admin-dashboard/package.json ./apps/admin-dashboard/
COPY packages/database/package.json ./packages/database/
COPY packages/ui/package.json ./packages/ui/
COPY packages/ts-config/package.json ./packages/ts-config/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/admin-dashboard ./apps/admin-dashboard
COPY --from=dependencies /app/packages ./packages
COPY . .
ENV NODE_ENV=production
RUN pnpm --filter database exec prisma generate
RUN pnpm --filter admin-dashboard build
RUN pnpm prune --prod

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/admin-dashboard/next.config.js ./
COPY --from=builder /app/apps/admin-dashboard/public ./public
COPY --from=builder /app/apps/admin-dashboard/.next/standalone ./
COPY --from=builder /app/apps/admin-dashboard/.next/static ./.next/static
USER nextjs
EXPOSE 3001
ENV PORT=3001
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
