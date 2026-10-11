# Pre-renders the site at build time and serves it with the small Node server.
# SITE_URL is baked into canonical URLs, Open Graph tags and the sitemap, so pass your public origin:
#   docker build --build-arg SITE_URL=https://primer.example.com -t polyglot-primer .
FROM node:22-alpine

ARG SITE_URL=http://localhost:8080
ARG REPO_URL=

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js store.js google-auth.js ./
COPY web ./web
COPY scripts ./scripts
COPY chapters ./chapters
COPY docs ./docs
RUN SITE_URL="$SITE_URL" REPO_URL="$REPO_URL" node scripts/build.js

# State (session.key, and progress.json/notes.json when no database is configured) lives on a volume.
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "server.js"]
