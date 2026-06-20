# Paymaster daemon image (Azure Container Apps). Builds only the paymaster and
# its workspace dependency (@devads/shared) from the pnpm monorepo.
FROM node:22-slim
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
WORKDIR /app

# Workspace manifest + lockfile, then just the packages the paymaster needs.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/paymaster ./apps/paymaster

# Disable pnpm's minimum-release-age supply-chain gate: the x402/viem releases
# this project pins are newer than the 24h default and would be rejected in a
# clean install.
RUN pnpm config set minimumReleaseAge 0 && pnpm install --no-frozen-lockfile

WORKDIR /app/apps/paymaster
ENV PAYMASTER_POLL_MS=5000
# Continuous poll → settle pending claims via x402. Env (PRIVATE_KEY,
# COORDINATOR_URL, …) is injected by the Container App, so no --env-file here.
CMD ["pnpm", "run", "start:container"]
