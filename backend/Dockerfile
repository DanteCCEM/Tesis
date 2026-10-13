FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY src ./src
COPY scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

# En Windows el script suele copiarse con CRLF; Alpine entonces falla con
# "exec ./scripts/docker-entrypoint.sh: no such file or directory".
RUN sed -i 's/\r$//' ./scripts/docker-entrypoint.sh \
  && chmod +x ./scripts/docker-entrypoint.sh \
  && npx prisma generate

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
