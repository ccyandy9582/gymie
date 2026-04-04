FROM node:20-alpine
WORKDIR /app
ARG BACKEND_PORT=4101
ENV BACKEND_PORT=${BACKEND_PORT}
ENV PORT=${BACKEND_PORT}
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE ${BACKEND_PORT}
CMD ["node", "src/index.js"]
