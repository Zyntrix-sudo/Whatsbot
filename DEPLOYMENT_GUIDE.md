# WhatsApp AI Bot - Deployment Guide for Render.com

## Overview
This guide will help you deploy your WhatsApp AI Bot to Render.com so it runs 24/7 even when your PC is off.

## Prerequisites
1. GitHub account (your code is already pushed)
2. Render.com account (free tier available)
3. Your WhatsApp bot credentials configured

## Deployment Steps

### 1. Push Code to GitHub
If you haven't already pushed your code:
```bash
git remote add origin https://github.com/yourusername/whatsapp-ai-bot.git
git branch -M main
git push -u origin main
```

### 2. Create Render.com Service
1. Go to [Render.com](https://render.com) and sign in
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure the service:
   - **Name**: whatsapp-ai-bot
   - **Region**: Choose closest to your users
   - **Branch**: main
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node.js

### 3. Configure Environment Variables
In your Render.com service dashboard:
1. Go to "Environment" tab
2. Add these variables (get values from your `.env` file):
   - `BOT_NUMBER`: Your WhatsApp number with country code
   - `OPENAI_API_KEY`: Your OpenAI API key
   - Any other variables from your `.env` file

### 4. Important Considerations for WhatsApp Bots
- **Persistent Connection**: Render.com web services maintain persistent connections, suitable for WhatsApp bots
- **QR Code Handling**: On first deploy, check logs for QR code to scan with WhatsApp
- **Session Storage**: The bot uses `auth_info_multi/` folder for session persistence. Render's free tier has ephemeral filesystem, so sessions may reset on redeploy. Consider:
  - Using external database for session storage (advanced)
  - Accepting occasional re-scan of QR code
  - Upgrading to Render's paid tier for persistent disk

### 5. Monitor and Maintain
- Check logs regularly for connection issues
- WhatsApp connections may need occasional refreshing
- Monitor usage to stay within free tier limits

## Troubleshooting
- **Connection Issues**: Check logs for Baileys connection errors
- **QR Code Not Showing**: Ensure you're checking logs immediately after deploy
- **Environment Variables**: Double-check all required variables are set

## Free Tier Limitations
- Render free tier: 750 hours/month (enough for 24/7 operation)
- Automatic sleep after 15 minutes of inactivity (may affect instant response)
- Consider upgrading if you need guaranteed uptime

## Alternative: Keep-alive Service
To prevent sleeping, you can set up a simple ping service:
1. Create a `/health` endpoint in your bot that returns 200 OK
2. Use a free service like UptimeRobot to ping your bot every 10-14 minutes

## Next Steps
1. Deploy following these steps
2. Test thoroughly
3. Monitor for first 24 hours
4. Adjust as needed

Your WhatsApp AI Bot should now run continuously on Render.com!