FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache openssl

# La API, Prisma y Multer no necesitan privilegios. El directorio de uploads se
# crea en la imagen para que Multer pueda seguir creando subdirectorios por curso.
RUN addgroup -S evaluaia && adduser -S evaluaia -G evaluaia

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
  && npx prisma generate \
  && mkdir -p ./uploads/planes-curriculares \
  && chown -R evaluaia:evaluaia /app

ENV NODE_ENV=production
EXPOSE 3000

USER evaluaia

ENTRYPOINT ["sh", "./scripts/docker-entrypoint.sh"]
