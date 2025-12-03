#!/bin/bash
set -e

echo "[$(date)] startup.sh: launching Next.js..." >&2

# Always run in the app folder
cd /home/site/wwwroot

# Production mode
export NODE_ENV=production
export PORT=${PORT:-3000}

echo "[$(date)] PATH is: $PATH" >&2
echo "[$(date)] Using PORT=$PORT" >&2

# Start Next.js using the local dependency
npx next start -p "$PORT"
