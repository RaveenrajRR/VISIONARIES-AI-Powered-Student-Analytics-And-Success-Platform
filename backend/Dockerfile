FROM node:22-alpine
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend/src ./src
COPY backend/scripts ./scripts
COPY datasets/raw /app/datasets/raw
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm","start"]
