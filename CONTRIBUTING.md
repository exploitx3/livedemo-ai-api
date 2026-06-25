# Contributing

Thank you for your interest in contributing to livedemo-ai-api!

## Prerequisites

- Node.js 18+
- pnpm (`npm i -g pnpm`)
- MongoDB running locally on port `27017`

## Getting started

1. **Fork** this repository and clone your fork.
2. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/your-change
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```
4. Copy the environment template and fill in your secrets:
   ```bash
   cp local.env .env
   ```
5. Start the server and verify it runs:
   ```bash
   pnpm start
   ```
6. Make your changes, then **open a Pull Request** against `main`.

## Branch naming

| Prefix | Use for |
|---|---|
| `feat/` | New features or improvements |
| `fix/` | Bug fixes |
| `docs/` | Documentation-only changes |
| `refactor/` | Code restructuring without behavior change |
| `chore/` | Maintenance (dependency bumps, config tweaks) |

## Commit style

Use short, imperative-mood commit messages:

```
fix: handle missing workspaceId in generateDemo
feat: add Gemini provider toggle via env
docs: document LIVEDEMO_CDN_BUCKET variable
refactor: extract S3 upload helper
```

## Code conventions

- ESM (`import`/`export`) throughout — no `require()`
- Environment variables are read only in `envServer.js`; import `ENV` elsewhere
- Shared AI logic lives in `aiHelpers.js`
- Mongoose schemas live in `db/index.js`

## Pull request checklist

Before submitting, please ensure:

- [ ] Your branch is up to date with `main`
- [ ] `pnpm start` launches without errors (with valid `.env`)
- [ ] New or changed endpoints are tested manually
- [ ] No secrets or credentials are committed
- [ ] Environment variable changes are reflected in `README.md` and `local.env`

## Reporting issues

Open a [GitHub Issue](../../issues) using the appropriate template. Please include:

- Node.js version (`node --version`)
- pnpm version (`pnpm --version`)
- Full error output or stack trace
- Steps to reproduce

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.
