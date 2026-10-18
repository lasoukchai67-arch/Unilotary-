# ເວັບແອັດມິນ + reverse proxy (Caddy ອອກ HTTPS ໃຫ້ອັດຕະໂນມັດ)
# Build context: repo root  (docker build -f infra/web.Dockerfile .)
FROM node:22-alpine AS admin
WORKDIR /app/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci
COPY admin ./
ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM caddy:2-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=admin /app/admin/dist /srv/admin
