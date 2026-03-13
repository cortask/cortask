# Stage 1: Build
FROM node:20-bookworm AS build

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/channels/package.json packages/channels/
COPY packages/gateway/package.json packages/gateway/
COPY packages/ui/package.json packages/ui/
COPY packages/cli/package.json packages/cli/
COPY packages/desktop/package.json packages/desktop/

RUN pnpm install --frozen-lockfile

COPY packages/core/ packages/core/
COPY packages/channels/ packages/channels/
COPY packages/gateway/ packages/gateway/
COPY packages/ui/ packages/ui/
COPY packages/cli/ packages/cli/
COPY skills/ skills/

RUN pnpm -F @cortask/core build && \
    pnpm -F @cortask/channels build && \
    pnpm -F @cortask/gateway build && \
    pnpm -F @cortask/ui build && \
    pnpm -F cortask build

# Stage 2: Runtime
FROM node:20-bookworm-slim

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CORTASK_DATA_DIR=/data
ENV NODE_ENV=production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

COPY --from=build /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/package.json /app/tsconfig.base.json ./
COPY --from=build /app/packages/core/package.json packages/core/
COPY --from=build /app/packages/channels/package.json packages/channels/
COPY --from=build /app/packages/gateway/package.json packages/gateway/
COPY --from=build /app/packages/ui/package.json packages/ui/
COPY --from=build /app/packages/cli/package.json packages/cli/
COPY --from=build /app/packages/desktop/package.json packages/desktop/

RUN pnpm install --frozen-lockfile --prod

COPY --from=build /app/packages/core/dist packages/core/dist/
COPY --from=build /app/packages/channels/dist packages/channels/dist/
COPY --from=build /app/packages/gateway/dist packages/gateway/dist/
COPY --from=build /app/packages/ui/dist packages/ui/dist/
COPY --from=build /app/packages/cli/dist packages/cli/dist/
COPY --from=build /app/skills skills/

VOLUME /data
EXPOSE 3777

CMD ["node", "packages/cli/dist/index.js", "serve", "--host", "0.0.0.0"]
