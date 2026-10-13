# Build from the repository root:  docker build -f apps/api/Dockerfile -t historic-broyhill-api .
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl && corepack enable
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/database packages/database
RUN pnpm --filter database exec prisma generate && pnpm --filter api build

FROM node:22-alpine
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
