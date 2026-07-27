FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm install --omit=dev

COPY package.json ./
COPY backend/ ./backend/
COPY database/ ./database/
COPY frontend/ ./frontend/

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

CMD ["node", "backend/scripts/start.js"]
