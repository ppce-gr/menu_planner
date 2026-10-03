FROM node:22-alpine

WORKDIR /app

# No hay dependencias de runtime: basta con copiar el código.
COPY package.json ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY docs ./docs
COPY deploy ./deploy

ENV PORT=3090 \
    HOST=0.0.0.0 \
    DATA_DIR=/data

# Volumen para SQLite y la clave de cifrado (¡imprescindible!).
VOLUME ["/data"]
EXPOSE 3090

CMD ["node", "src/index.js"]
