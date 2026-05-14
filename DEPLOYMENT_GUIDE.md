# Heroku Deployment Guide

This project is now set up for Heroku instead of Railway.

## What changed

- Root `package.json` keeps `npm start` as the app start command
- `Procfile` was added for Heroku process startup
- `railway.json` was removed
- `/health` can still be used to confirm the bot is running

## Deploy on Heroku

1. Push this repository to GitHub.
2. Create a new Heroku app.
3. Connect the app to this GitHub repository or deploy with the Heroku CLI.
4. Deploy the `main` branch.

## Heroku app setup

- Runtime: Node.js
- Start command: `web: npm start`
- Node version: `24.x`

Heroku detects the app from the root `package.json` and uses the `Procfile` in the repo root.

## Required config vars

Set these in the Heroku app settings:

- `BOT_NUMBER`
- `OWNER_NUMBER`

Heroku provides `PORT` automatically, and the bot already listens on it.

## Important note about WhatsApp auth

This bot stores WhatsApp session files in `whatsapp-ai-bot/auth_info_multi`.
Heroku dyno filesystems are not persistent between rebuilds/restarts, so you may need to scan the QR code again after a fresh deploy or restart.

## First deploy check

After deploy:

1. Open the Heroku logs.
2. Wait for the QR code message or connection log.
3. Open the app URL if you want to view the QR page in the browser.
4. Scan the QR code with WhatsApp.

## Useful commands

```bash
npm install
npm run check
npm start
```
