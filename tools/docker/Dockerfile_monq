# syntax=docker/dockerfile:1

FROM docker.io/livedemo/livedemo-backend:monq-base-latest

ENV CI=true
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /home/app

COPY package.json pnpm-lock.yaml ./
COPY . ./

RUN npm install -g pnpm@10.27.0

RUN --mount=type=ssh pnpm install --frozen-lockfile

RUN chmod +x start.sh

ENTRYPOINT ["./start.sh"]
