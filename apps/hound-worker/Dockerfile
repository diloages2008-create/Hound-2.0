FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY . ./

RUN if [ -f package.json ]; then \
      npm install --omit=dev; \
    else \
      npm init -y && npm install @supabase/supabase-js; \
    fi

CMD ["node", "src/index.mjs"]
