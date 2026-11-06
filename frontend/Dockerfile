FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# O endereço da API entra na interface durante o build
ARG VITE_API_URL=http://localhost:8000
ARG VITE_SHOW_DEMO_ACCOUNTS=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SHOW_DEMO_ACCOUNTS=$VITE_SHOW_DEMO_ACCOUNTS
RUN npm run build

FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
