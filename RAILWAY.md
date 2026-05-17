Deployment notes for Railway (secondary)

Render is the recommended deployment target for this project — see `DEPLOYMENT_GUIDE.md` and `Render.yaml` for the preferred configuration. If you still want to use Railway, keep these tips in mind:

- Railway auto-detects Node.js projects via `package.json`. Ensure `start` script exists (it does: `npm start`).
- Set Node version in Railway project settings to `18.x` or `20.x` to match `package.json` engines.
- If you encounter `module not found` (e.g., `@whiskeysockets/baileys`), check the deployment logs for `npm install` errors. Common fixes:
  - Ensure `package.json` lists `@whiskeysockets/baileys` in `dependencies`.
  - Use the Railway build logs to inspect `npm install` failures; sometimes network or registry restrictions cause incomplete installs.
  - Railway caches dependencies; try clearing build cache and redeploying if errors persist.
- `postinstall` runs `npm rebuild || true` to attempt native rebuilds and avoid certain install-time issues.
- Environment variables to set in Railway:
  - `PORT` (Railway sets this automatically; bot uses `process.env.PORT`)
  - `OWNER_NUMBER`, `BOT_NUMBER` (WhatsApp numbers)
  - `OPENAI_API_KEY` (if using OpenAI)
  - `KEEPALIVE_URL` (optional, default points to `/health`)

Troubleshooting tips:
- Run `npm ci` or `npm install` locally to reproduce install errors before deploying.
- If a package fails building due to Node version, pick the Node LTS matching the package requirements.
- Use the included `Dockerfile` for full environment reproducibility on Railway if native build issues persist; Docker removes most platform-specific native build problems.
