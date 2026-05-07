FROM node:20-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN npx prisma generate

ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-3.0.x.so.node

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node src/seed.js && node src/app.js"]
