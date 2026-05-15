const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadContentFromMessage,
  generateWAMessageContent,
  generateWAMessageFromContent,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'));

const CONFIG = {
  botNumber: process.env.BOT_NUMBER || '2349031646071@s.whatsapp.net',
  ownerNumber: process.env.OWNER_NUMBER || '2349031646071@s.whatsapp.net',
  authDir: path.join(__dirname, 'auth_info_multi'),
  usersDb: path.join(__dirname, 'users.json'),
  metaAiApi: 'https://apis.davidcyril.name.ng/endpoints/ai/meta-ai',
  fluxApi: 'https://apis.davidcyril.name.ng/fluxv2',
  port: process.env.PORT || 3000,
};

// Web server for QR code display
const app = express();
let currentQR = null;

app.get('/', (req, res) => {
  if (currentQR) {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rest AI - WhatsApp QR Code</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #25D366; }
            img { max-width: 100%; height: auto; }
            p { color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔗 Rest AI WhatsApp Bot</h1>
            <p>Scan this QR code with WhatsApp on your phone to authenticate the bot:</p>
            <img src="${currentQR}" alt="QR Code" />
            <p><strong>Make sure to scan within 60 seconds!</strong></p>
            <p>After scanning, refresh this page to check connection status.</p>
          </div>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rest AI - Connected</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #25D366; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>✅ Rest AI Bot Connected!</h1>
            <p>The bot is now connected to WhatsApp and ready to receive messages.</p>
          </div>
        </body>
      </html>
    `);
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    bot: BOT_INFO?.name || 'Rest AI',
  });
});

app.listen(CONFIG.port, () => {
  console.log(`🌐 Web server running on port ${CONFIG.port}`);
  console.log(`🔗 Access QR code at: http://localhost:${CONFIG.port}`);
});

const BOT_INFO = {
  name: 'Rest AI',
  developer: 'Emmanuel Restoration Abimbola',
  version: '1.0.0',
  commandPrefix: '.',
  menuImage: 'https://i.postimg.cc/zGXYBh89/Miles-morales.jpg',
};

const silentLogger = {
  level: 'silent',
  child() {
    return this;
  },
  trace() {},
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function getMessageText(message) {
  if (!message) return '';

  const nestedMessage =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.documentWithCaptionMessage?.message ||
    message.editedMessage?.message?.protocolMessage?.editedMessage ||
    null;

  if (nestedMessage) {
    return getMessageText(nestedMessage);
  }

  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message.templateButtonReplyMessage?.selectedId ||
    ''
  ).trim();
}

function normalizeJid(jid) {
  return String(jid || '').trim().toLowerCase();
}

let sock;

/**
 * Fetch AI response from Meta AI endpoint
 * @param {string} text - User message
 * @returns {Promise<string|null>} AI response or null
 */
async function getAiReply(text) {
  try {
    const url = `https://apis.davidcyril.name.ng/endpoints/ai/meta-ai?query=${encodeURIComponent(text)}`;
    
    const response = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve(jsonData);
          } catch (e) {
            resolve({ raw: data });
          }
        });
      }).on('error', reject);
    });

    // Extract response from various possible JSON fields
    const candidates = [
      response.result,
      response.reply,
      response.response,
      response.message,
      response.answer,
      response.text,
      response.data,
      response.content,
      response.raw,
    ];

    const aiResponse = candidates.find((item) => typeof item === 'string' && item.trim());
    return aiResponse ? aiResponse.trim() : null;
  } catch (error) {
    console.error('AI API error:', error.message);
    return null;
  }
}

async function sendTrackedMessage(jid, payload) {
  try {
    const sent = await sock.sendMessage(jid, payload);
    return sent;
  } catch (error) {
    console.error('Error sending message:', error.message);
    return null;
  }
}

async function connectToWhatsApp() {
  if (!fs.existsSync(CONFIG.authDir)) {
    fs.mkdirSync(CONFIG.authDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authDir);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    logger: silentLogger,
    browser: ['Rest AI', 'Chrome', '1.0.0'],
    connectTimeoutMs: 60000,
    qrTimeout: 60000,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔗 QR code generated! Access it at the web interface.\n');
      console.log(`🌐 Web server: http://localhost:${CONFIG.port}`);

      try {
        currentQR = await QRCode.toDataURL(qr);
        console.log('✅ QR code image generated for web display');
      } catch (error) {
        console.error('❌ Failed to generate QR code image:', error);
      }

      qrcode.generate(qr, { small: true });
      console.log('\n📱 Make sure to scan the QR code within 60 seconds!\n');
    }

    if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }

    if (connection === 'open') {
      console.log('✅ Successfully connected to WhatsApp!');
      console.log('🤖 Rest AI Bot is now online and ready to receive messages.');
      currentQR = null;
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Connection closed.');

      if (shouldReconnect) {
        console.log('🔄 Reconnecting in 5 seconds...');
        setTimeout(() => connectToWhatsApp(), 5000);
      } else {
        console.log('🚫 Logged out from WhatsApp. Please delete the auth_info_multi folder and restart the bot.');
      }
    }
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('messages.upsert', async (event) => {
    const m = event.messages?.[0];
    if (!m?.message) return;

    // Prevent message loop - ignore messages sent by the bot itself
    if (m.key.fromMe) return;

    const remoteJid = m.key.remoteJid;
    const messageText = getMessageText(m.message);

    if (!remoteJid || !messageText) return;
    if (remoteJid === 'status@broadcast') return;

    // Ignore group messages - only reply to private messages
    const isGroup = remoteJid?.endsWith('@g.us');
    if (isGroup) return;

    console.log(`📨 Message from ${remoteJid}: ${messageText}`);

    try {
      // Send typing indicator
      await sock.sendPresenceUpdate('typing', remoteJid);

      // Fetch AI response
      const aiReply = await getAiReply(messageText);

      // Use fallback message if API fails
      const response = aiReply || `Hey there! 👋 I got your message but couldn't process it right now. Try again in a moment.`;

      console.log(`🤖 Sending reply to ${remoteJid}`);

      // Send the reply
      await sendTrackedMessage(remoteJid, { text: response });

      // Send available status
      await sock.sendPresenceUpdate('available', remoteJid);
    } catch (error) {
      console.error('Error handling message:', error.message);

      try {
        await sendTrackedMessage(remoteJid, {
          text: 'Something went wrong on my end. Please try again later.',
        });
      } catch (sendError) {
        console.error('Failed to send error message:', sendError.message);
      }
    }
  });
}

console.log(`\n🚀 Starting ${BOT_INFO.name} v${BOT_INFO.version}`);
console.log(`👨‍💻 Developer: ${BOT_INFO.developer}`);
console.log(`🔧 AI Provider: David Cyril Meta AI Endpoint`);
console.log(`🌐 Web Server: http://localhost:${CONFIG.port}\n`);

connectToWhatsApp().catch((error) => {
  console.error('Failed to start bot:', error.message);
  process.exit(1);
});
