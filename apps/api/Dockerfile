FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm ci

COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN npm run prisma:generate -w @luxefinder/api && npm run build -w @luxefinder/shared && npm run build -w @luxefinder/api

EXPOSE 3000

CMD ["npm", "run", "start", "-w", "@luxefinder/api"]
