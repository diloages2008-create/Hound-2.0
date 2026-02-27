FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/hound-worker/package.json ./apps/hound-worker/package.json

RUN npm install --workspaces --include-workspace-root=false

COPY apps/hound-worker ./apps/hound-worker

WORKDIR /app/apps/hound-worker

CMD ["npm", "run", "start"]
