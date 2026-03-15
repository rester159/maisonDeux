FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web ./apps/web

RUN npm run prisma:generate -w @luxefinder/api && npm run build -w @luxefinder/shared && npm run build -w @luxefinder/web && npm run build -w @luxefinder/api

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@luxefinder/api"]
