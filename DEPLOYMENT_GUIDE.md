# Railway Deployment Guide

This project is now set up for Railway instead of Render.

## What changed

- Root `package.json` now starts the bot with `npm start`
- `railway.json` config was added for Railway deploy settings
- `/health` endpoint was added for Railway health checks
- Old `Render.yaml` was removed

## Deploy on Railway

1. Push this repository to GitHub.
2. Create a new Railway project.
3. Choose "Deploy from GitHub repo".
4. Select this repository.
5. Railway should detect the Node app and run `npm start`.

## Railway settings

- Start command: `npm start`
- Healthcheck path: `/health`
- Port: Railway injects `PORT` automatically, and the bot already uses it

## Required environment variables

- `BOT_NUMBER`
- `OWNER_NUMBER`
- `PORT` is provided by Railway

If you keep extra secrets in `whatsapp-ai-bot/.env` locally, add the same values in Railway Variables.

## Important note about WhatsApp auth

This bot stores session files in `whatsapp-ai-bot/auth_info_multi`.
If Railway redeploys or the service storage resets, you may need to scan the QR code again unless you attach persistent storage.

## First deploy check

After deploy:

1. Open the Railway logs.
2. Wait for the QR code link or connection log.
3. Visit your generated app URL to view the QR page if needed.
4. Scan the QR code with WhatsApp.

## Useful local commands

```bash
npm install
npm run check
npm start
```
