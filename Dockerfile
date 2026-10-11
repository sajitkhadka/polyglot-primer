# Zero-dependency Node server: no npm install step, nothing to build.
FROM node:22-alpine

WORKDIR /app
COPY server.js google-auth.js ./
COPY web ./web
COPY chapters ./chapters

# State (progress.json, notes.json) lives on a mounted volume, never in the image.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.js"]
