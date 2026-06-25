# livedemo-ai-api

Node.js service that generates interactive product demos from URLs. Captures website screenshots with Playwright, generates step text with OpenAI or Gemini Vision, uploads images to S3, and saves Story + Screen documents to MongoDB.

Can run as an HTTP API, a monq background worker (for `processUrlDemo` jobs from livedemo-backend), or both.

## Stack

- **Runtime** — Node.js 18+ (ESM)
- **Framework** — Express
- **Database** — MongoDB via Mongoose
- **Queue** — monq (MongoDB-backed job queue)
- **Browser automation** — Playwright (Chromium)
- **AI** — OpenAI GPT Vision, Google Gemini
- **Storage** — AWS S3

---

## Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- MongoDB running locally on port `27017`
- Playwright system dependencies (installed automatically via `postinstall`)

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

This also downloads the Playwright Chromium browser (~150 MB).

### 2. Configure environment variables

`local.env` is the committed template. Create your personal `.env` from it and fill in your own secrets:

```bash
cp local.env .env
```

> `.env` is listed in `.gitignore` — your secrets will never be committed.

Key variables:

| Variable | Description |
|---|---|
| `ENABLE_API` | Set to `true` to start the Express HTTP server |
| `ENABLE_CONSUMER` | Set to `true` to start the monq job worker |
| `PORT` | HTTP port (default `3001`) |
| `DB_URI` | MongoDB connection URI |
| `OPENAI_API_KEY` | OpenAI API key (required for default AI provider) |
| `GEMINI_API_KEY` | Google Gemini API key (optional alternative provider) |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials for S3 image uploads |
| `AWS_REGION` | AWS region (default `us-east-1`) |
| `LIVEDEMO_CDN_BUCKET` | S3 bucket name (default `livedemo-cdn`) |
| `DEFAULT_WORKSPACE_ID` | Fallback workspace when no `userId`/`workspaceId` is provided |

### 3. Start the server

```bash
pnpm start
```

By default (with both flags `true` in `.env`) this starts the API and the monq consumer.

---

## Project structure

```
server.js          # Express app + demo generation logic
consumer.js        # monq worker for processUrlDemo jobs
envServer.js       # Environment config loader (dotenv + ENV object)
aiHelpers.js       # OpenAI / Gemini Vision helpers
db/index.js        # Mongoose schemas and connection
tools/docker/      # Dockerfiles for CI and deployment
```

---

## API

The server listens on port `3001` by default.

| Method | Path | Description |
|---|---|---|
| `POST` | `/generate-demo` | Generate a demo from a URL |
| `GET` | `/health` | Health check |

### POST /generate-demo

```json
{
  "url": "https://example.com",
  "workspaceId": "optional-workspace-id",
  "userId": "optional-user-id"
}
```

Requires `workspaceId` or `userId` (or `DEFAULT_WORKSPACE_ID` in env).

---

## Running modes

Set via environment variables:

```bash
# API only
ENABLE_API=true ENABLE_CONSUMER=false pnpm start

# Consumer only (processes urlDemos queue jobs)
ENABLE_API=false ENABLE_CONSUMER=true pnpm start

# Both (default)
ENABLE_API=true ENABLE_CONSUMER=true pnpm start
```

Development with file watching:

```bash
pnpm dev
```

---

## Docker

CI builds three images on push to `develop`:

| Image tag | Dockerfile | Purpose |
|---|---|---|
| `:monq-base-latest` | `tools/docker/Dockerfile_monq_base` | Base image with Node, Playwright Chromium |
| `:monq-latest` | `tools/docker/Dockerfile_monq` | monq worker |
| `:latest` | `tools/docker/Dockerfile` | Full service (API + optional consumer via env) |

Required GitHub Actions secrets: `CI_MINE_USERNAME`, `CI_MINE_PASSWORD`, `GIT_SSH_KEY` (for private `monq` git dependency).

---

## License

MIT License (see [`LICENSE`](LICENSE)).
