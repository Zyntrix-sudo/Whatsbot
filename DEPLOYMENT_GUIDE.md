# Render Deployment Guide (preferred)

This project is now configured to deploy primarily on Render. A `Render.yaml` manifest is included for a simple one-click deployment. A `Dockerfile` is also provided to enable reproducible Docker builds if you prefer deploying with a container.

## What changed

- Primary deployment target: Render (see `Render.yaml`).
- `Dockerfile` updated to Node 20 for better compatibility with native modules.
- `Procfile` is retained for platforms that use it (Railway/Heroku).
- `/health` endpoint remains available for keepalive pings.

## Deploy on Render (recommended)

1. Create a new Web Service on Render and connect your GitHub repository.
2. Ensure the service is configured to deploy the `main` branch.
3. If using the YAML blueprint, you can import or place the `Render.yaml` in the repo root — Render will use it during service creation.
4. Set environment variables in Render:
	- `OPENAI_API_KEY` (optional)
	- `BOT_NUMBER` and `OWNER_NUMBER` (required for operation)
	- `KEEPALIVE_URL` (optional — defaults to `/health`)

Render automatically provides `PORT` to the container.

## Running with Docker (optional, works on Render and Railway)

Build locally to verify:

```bash
docker build -t rest-ai-bot:local .
docker run -e PORT=3000 -p 3000:3000 rest-ai-bot:local
```

## Deploy on Railway (secondary)

Railway is supported, but Render is the preferred platform for stable, long-running bots. If you choose Railway:

- Set your project `Node` version to `18.x` or `20.x` in Railway settings to match `package.json`.
- Railway sets `PORT` automatically; ensure the service uses `npm start`.
- If native module install errors occur, consider using the Docker deployment option to avoid platform-specific build issues.

## Required config vars (both platforms)

- `BOT_NUMBER`
- `OWNER_NUMBER`
- `OPENAI_API_KEY` (optional)
- `KEEPALIVE_URL` (optional)

## WhatsApp auth note

This bot stores WhatsApp session files in `whatsapp-ai-bot/auth_info_multi`. Hosted platforms with ephemeral filesystems (like Render or Railway without persistent storage) will lose session files on rebuilds — use persistent storage or re-scan the QR after a redeploy. For production, consider mounting persistent storage or using a stateful service.

## Useful commands

```bash
npm ci
npm run check
npm start
```
