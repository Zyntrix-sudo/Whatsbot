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
const axios = require('axios');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const crypto = require('crypto');
const { OpenAI } = require('openai');

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
  authDir: process.env.SESSION_DIR || '/app/session',
  usersDb: path.join(__dirname, 'users.json'),
  metaAiApi: 'https://apis.davidcyril.name.ng/ai/metaai',
  fluxApi: 'https://apis.davidcyril.name.ng/fluxv2',
  port: process.env.PORT || 3000,
  keepAliveUrl: process.env.KEEPALIVE_URL || `http://127.0.0.1:${process.env.PORT || 3000}/health`,
};

// Web server for QR code display and professional landing pages
const app = express();
let currentQR = null;

function generatePairingCode() {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  return code;
}

function getWhatsAppConnectLinks(pairingCode) {
  const botPhone = CONFIG.botNumber.replace('@s.whatsapp.net', '');
  const text = encodeURIComponent(`PAIR ${pairingCode}`);
  return {
    whatsappUri: `whatsapp://send?phone=${botPhone}&text=${text}`,
    waMeLink: `https://api.whatsapp.com/send?phone=${botPhone}&text=${text}`,
  };
}

app.get('/', (req, res) => {
  res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Rest AI WhatsApp Bot</title>
          <style>
            body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: linear-gradient(135deg, #0f172a 0%, #111827 55%, #1f2937 100%); color: #f8fafc; }
            .page { display: flex; min-height: 100vh; align-items: center; justify-content: center; padding: 24px; }
            .card { width: min(980px, 100%); display: grid; grid-template-columns: 1.25fr 1fr; gap: 24px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 24px; box-shadow: 0 40px 120px rgba(15, 23, 42, 0.35); padding: 32px; }
            .hero { display: flex; flex-direction: column; justify-content: center; gap: 18px; }
            .hero h1 { margin: 0; font-size: clamp(2.4rem, 4vw, 4rem); line-height: 1.03; letter-spacing: -0.04em; }
            .hero p { margin: 0; color: rgba(226, 232, 240, 0.88); line-height: 1.75; max-width: 40rem; }
            .buttons { display: flex; flex-wrap: wrap; gap: 14px; }
            .button { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 24px; border-radius: 14px; border: none; font-weight: 700; cursor: pointer; text-decoration: none; color: #fff; }
            .button.primary { background: linear-gradient(135deg, #38bdf8, #22c55e); }
            .button.secondary { background: rgba(255, 255, 255, 0.1); color: #e2e8f0; }
            .button.tertiary { background: rgba(255, 255, 255, 0.08); color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.14); }
            .sidebar { display: flex; flex-direction: column; gap: 18px; justify-content: center; }
            .badge { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: rgba(34, 197, 94, 0.12); color: #d1fae5; font-size: 0.95rem; }
            .feature { display: flex; flex-direction: column; gap: 10px; padding: 18px 20px; border-radius: 18px; background: rgba(148, 163, 184, 0.08); border: 1px solid rgba(148, 163, 184, 0.12); }
            .feature strong { font-size: 0.95rem; color: #f8fafc; }
            .feature span { color: rgba(226, 232, 240, 0.78); line-height: 1.65; }
            .footer { color: rgba(226, 232, 240, 0.64); font-size: 0.95rem; }
            @media (max-width: 860px) { .card { grid-template-columns: 1fr; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="card">
              <div class="hero">
                <span class="badge">Professional WhatsApp AI Bot</span>
                <h1>Rest AI connects your business to WhatsApp with modern reliability.</h1>
                <p>Launch a polished onboarding flow, scan a QR code, or pair directly through WhatsApp. The bot is built for Render deployment and stays awake with automatic health checks.</p>
                <div class="buttons">
                  <a class="button primary" href="/connect">Connect to WhatsApp</a>
                  <a class="button secondary" href="/health">Check Status</a>
                  <a class="button tertiary" href="https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20" target="_blank">View Channel</a>
                </div>
                <div class="footer">Deploy with Render and keep your bot live with automatic health pings and a modern connection experience.</div>
              </div>
              <div class="sidebar">
                <div class="feature">
                  <strong>Scan or pair</strong>
                  <span>Open the prepared connection page and choose either QR scan or WhatsApp pairing code.</span>
                </div>
                <div class="feature">
                  <strong>Business-grade UI</strong>
                  <span>Professional landing experience to reassure users before entering WhatsApp.</span>
                </div>
                <div class="feature">
                  <strong>Render-ready</strong>
                  <span>Includes health endpoint and keepalive ping for stable Render hosting.</span>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
});

app.get('/connect', (req, res) => {
  const pairingCode = generatePairingCode();
  const { whatsappUri, waMeLink } = getWhatsAppConnectLinks(pairingCode);
  const qrcodeHtml = currentQR
    ? `<img src="${currentQR}" alt="WhatsApp QR Code" style="width:100%; border-radius:18px; border:1px solid rgba(148,163,184,0.16); box-shadow:0 18px 45px rgba(15,23,42,0.18);" />`
    : `<div style="padding: 48px 24px; border-radius: 18px; background: rgba(148, 163, 184, 0.08); color: #fff; border: 1px solid rgba(148, 163, 184, 0.16); text-align:center;">Waiting for the QR code to appear once the bot starts. Refresh after the bot is ready.</div>`;

  res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connect Rest AI</title>
          <style>
            body { margin: 0; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f8fafc; }
            .page { min-height: 100vh; padding: 28px; display: flex; align-items: center; justify-content: center; }
            .panel { width: min(1024px, 100%); display: grid; grid-template-columns: 1fr 1fr; gap: 24px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 28px; padding: 32px; box-shadow: 0 40px 100px rgba(15, 23, 42, 0.35); }
            .panel h1 { margin: 0 0 16px; font-size: clamp(2rem, 3vw, 3rem); line-height: 1.05; }
            .panel p { margin: 0 0 22px; color: rgba(226, 232, 240, 0.82); line-height: 1.75; }
            .card { background: rgba(30, 41, 59, 0.95); border: 1px solid rgba(148, 163, 184, 0.12); border-radius: 24px; padding: 24px; display: flex; flex-direction: column; gap: 18px; }
            .label { color: #94a3b8; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.14em; }
            .code { font-family: 'Fira Code', monospace; background: rgba(148, 163, 184, 0.08); padding: 18px 20px; border-radius: 16px; border: 1px dashed rgba(148, 163, 184, 0.22); color: #e2e8f0; }
            .button { display: inline-flex; align-items: center; justify-content: center; min-height: 52px; padding: 0 22px; border-radius: 14px; border: none; font-weight: 700; text-decoration: none; color: #0f172a; background: #38bdf8; }
            .secondary { background: rgba(255, 255, 255, 0.08); color: #e2e8f0; }
            .row { display: grid; gap: 18px; }
            .hint { color: rgba(226, 232, 240, 0.72); font-size: 0.98rem; }
            .status-chip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; background: rgba(34, 197, 94, 0.12); color: #d1fae5; }
            @media (max-width: 860px) { .panel { grid-template-columns: 1fr; } }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="panel">
              <div class="card">
                <span class="label">Connect to WhatsApp</span>
                <h1>Choose your preferred connection flow</h1>
                <p>Scan the QR code with your WhatsApp mobile app, or use the secure pairing code to open the bot conversation instantly.</p>
                <div class="row">
                  <div>
                    <div class="label">Pairing code</div>
                    <div class="code">${pairingCode}</div>
                    <p class="hint">Tap the button below to open WhatsApp with the pairing code already filled.</p>
                    <a class="button" href="${whatsappUri}">Open WhatsApp App</a>
                    <a class="button secondary" href="${waMeLink}" target="_blank">Open WhatsApp Web</a>
                    <a class="button tertiary" href="https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20" target="_blank">View Channel</a>
                  </div>
                  <div>
                    <div class="label">Scan QR</div>
                    ${qrcodeHtml}
                    <p class="hint">If the QR code is visible, simply scan it from the WhatsApp mobile scanner. Refresh once the bot has generated the QR.</p>
                  </div>
                </div>
              </div>
              <div class="card">
                <span class="label">Ready for business</span>
                <h1>Professional connection workflow</h1>
                <p>This interface keeps the existing bot logic untouched while giving users a polished entry experience. The QR and pairing options are separated so both scan and link flows work reliably.</p>
                <div class="status-chip">Render deployment ready</div>
                <div class="status-chip">Auto keepalive enabled</div>
                <div class="status-chip">Anti-delete protection active</div>
                <div class="status-chip">AI and group status support</div>
                <p class="hint">If the bot is connected, it will continue to show a connection confirmation. Use the root landing page again after setup to return here.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `);
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    bot: BOT_INFO?.name || 'Rest AI',
    paused: BOT_STATE?.paused || false,
    uptime: formatUptime(),
  });
});

async function pingHealth() {
  try {
    const response = await axios.get(CONFIG.keepAliveUrl, { timeout: 10000 });
    if (response.status === 200) {
      console.log('🟢 Keepalive ping success');
      return;
    }
  } catch (error) {
    console.error('⚠️ Keepalive ping failed:', error.message);
  }
}

function startKeepAlive() {
  pingHealth();
  cron.schedule('*/5 * * * *', pingHealth, { scheduled: true });
}

app.listen(CONFIG.port, () => {
  console.log(`🌐 Web server running on port ${CONFIG.port}`);
  console.log(`🔗 Access QR code at: http://localhost:${CONFIG.port}`);
  startKeepAlive();
});

const BOT_INFO = {
  name: 'Rest AI',
  developer: 'Emmanuel Restoration Abimbola',
  version: '1.0.0',
  commandPrefix: '.',
  menuImage: 'https://i.postimg.cc/zGXYBh89/Miles-morales.jpg',
};

const COMMAND_ALIASES = {
  menu: 'help',
  h: 'help',
  owner: 'owner',
  ai: 'ask',
  gpt: 'ask',
  img: 'imagine',
  image: 'imagine',
  sm: 'movie',
  ytmp3: 'youtube',
  song: 'youtube',
  ytmp4: 'youtube',
  ytvid: 'youtube',
  ttdl: 'tiktok',
  igdl: 'instagram',
  gcstatus: 'gcstatus',
  swgc: 'gcstatus',
  upswgc: 'gcstatus',
  vv: 'vv',
  ttt: 'tictactoe',
  resume: 'resume',
  stats: 'status',
  info: 'status',
  pfx: 'prefix',
  id: 'jid',
  choose: 'pick',
  roll: 'dice',
  cf: 'coinflip',
  flip: 'coinflip',
  coin: 'coinflip',
  ball: '8ball',
  eightball: '8ball',
  math: 'calc',
};

const OWNER_COMMANDS = new Set([
  'help',
  'owner',
  'ping',
  'alive',
  'uptime',
  'pause',
  'resume',
  'status',
  'prefix',
  'ask',
  'game',
  'tiktok',
  'youtube',
  'facebook',
  'instagram',
  'download',
  'movie',
  'tictactoe',
  'move',
  'imagine',
  'gcstatus',
  'vv',
  'echo',
  'reverse',
  'upper',
  'lower',
  'count',
  'calc',
  'date',
  'time',
  'jid',
  'pick',
  'dice',
  'coinflip',
  '8ball',
  'quote',
  'fact',
  'joke',
  'compliment',
  'weather',
]);

const BOT_STATE = {
  paused: false,
  startTime: Date.now(),
  sentMessageIds: [],
  reconnectAttempts: 0,
  maxReconnectAttempts: 10,
};

const MESSAGE_CACHE = new Map();

function cacheMessage(msg) {
  if (!msg || !msg.key?.id || !msg.message) return;
  const remoteJid = msg.key.remoteJid;
  const isGroup = remoteJid?.endsWith('@g.us');
  const senderJid = getSenderId(msg, isGroup, remoteJid);
  const senderName = msg.pushName || msg.pushname || msg.notify || senderJid;
  MESSAGE_CACHE.set(msg.key.id, {
    remoteJid,
    senderJid,
    senderName,
    isGroup,
    message: msg.message,
    timestamp: Date.now(),
  });
  if (MESSAGE_CACHE.size > 500) {
    const oldestKey = MESSAGE_CACHE.keys().next().value;
    MESSAGE_CACHE.delete(oldestKey);
  }
}

function getCachedMessage(messageId) {
  return MESSAGE_CACHE.get(messageId);
}

function formatSenderReference(senderName, senderJid) {
  const formattedName = senderName || senderJid.replace('@s.whatsapp.net', '');
  return `@${formattedName}`;
}

async function safeReact(jid, key, emoji) {
  try {
    await sock.sendMessage(jid, { react: { text: emoji, key } });
  } catch (error) {
    // Reaction not supported or failed, ignore silently.
  }
}

async function maybeSendQuotedStatus(replyJid, msg) {
  const quoted = getQuotedMessage(msg);
  if (!quoted) return null;

  const quotedText = getMessageText(quoted);
  const media = extractMediaMessage(quoted);

  if (media) {
    const buffer = await downloadQuotedMediaBuffer(media.kind, media.payload);
    if (!buffer) {
      return 'I found the status media, but I could not download it right now.';
    }

    const caption = quotedText ? `${quotedText}\n\nREST AI` : 'REST AI';
    const payload = {
      [media.kind]: buffer,
      caption,
    };

    if (media.kind === 'audio') {
      payload.mimetype = media.payload.mimetype || 'audio/mp4';
      payload.ptt = Boolean(media.payload.ptt);
    }

    await sendTrackedMessage(replyJid, payload);
    return null;
  }

  if (quotedText) {
    return `Captured status from the quoted message:\n${quotedText}`;
  }

  return 'I found a quoted status message but could not read the content.';
}

async function sendDeletedMessageAlert(entry) {
  if (!entry) return;

  const senderLabel =
    entry.senderName || entry.senderJid.replace('@s.whatsapp.net', '');
  const chatLabel = entry.isGroup ? `group ${entry.remoteJid}` : 'private chat';
  const mentionJid = entry.senderJid;
  const bodyLines = [`Deleted message detected from ${senderLabel} in ${chatLabel}.`];

  if (entry.message) {
    const textContent = getMessageText(entry.message);
    if (textContent) {
      bodyLines.push(`Message: ${textContent}`);
    }
  } else {
    bodyLines.push('Message content was not cached before deletion.');
  }

  bodyLines.push(`Sender: ${senderLabel}`);
  bodyLines.push('REST AI');

  await sendTrackedMessage(CONFIG.ownerNumber, {
    text: bodyLines.join('\n'),
    contextInfo: { mentionedJid: [mentionJid] },
  });

  const media = extractMediaMessage(entry.message);
  if (!media) return;

  const buffer = await downloadQuotedMediaBuffer(media.kind, media.payload);
  if (!buffer) return;

  const captionParts = [`Deleted ${media.kind} from ${senderLabel}.`, 'REST AI'];
  if (media.payload.caption) {
    captionParts.unshift(media.payload.caption.trim());
  }

  const payload = {
    [media.kind]: buffer,
    caption: captionParts.join('\n'),
    contextInfo: { mentionedJid: [mentionJid] },
  };

  if (media.kind === 'audio') {
    payload.mimetype = media.payload.mimetype || 'audio/mp4';
    payload.ptt = Boolean(media.payload.ptt);
  }

  await sendTrackedMessage(CONFIG.ownerNumber, payload);
}

const QUICK_QUOTES = [
  'Discipline beats motivation when the mood no show.',
  'Small small progress still na progress.',
  'Rest if you need am, but no stop the work forever.',
  'Clarity first, speed next.',
  'No let fear do project manager for your life.',
];

const QUICK_FACTS = [
  'Octopuses get three hearts.',
  'Honey fit last for years without spoiling.',
  'Bananas are berries, but strawberries no be berries by botany rules.',
  'Your brain uses around 20 percent of your body energy.',
  'Sharks don dey older than trees for earth history.',
];

const QUICK_JOKES = [
  'Why developer carry ladder? Because the bug report talk say issue dey high priority.',
  'I tell my code make e rest small. E reply say: syntax never sleep.',
  'Why the bot calm down? E finally catch the missing semicolon.',
  'I ask the server how body. E say: 200 OK.',
  'Why the function break up? Too many unresolved arguments.',
];

const QUICK_COMPLIMENTS = [
  'You sharp well well today.',
  'Your brain dey fire correctly.',
  'Clean thinking dey show for the way you ask questions.',
  'You get strong builder energy today.',
  'You sabi push work forward, no cap.',
];

const EIGHT_BALL_ANSWERS = [
  'Yes, run am.',
  'No be bad idea at all.',
  'Signs point to yes.',
  'Later go clear pass now.',
  'No rush am yet.',
  'My answer na no for now.',
  'Ask me again when network no dey moody.',
  'E fit work, but verify am.',
];

const BOT_PHONE = CONFIG.botNumber.replace('@s.whatsapp.net', '');
const BOT_CHANNEL_URL = 'https://whatsapp.com/channel/0029VbCFEZv60eBdlqXqQz20';

const BOT_THUMBNAIL_QUOTE = {
  key: {
    fromMe: false,
    participant: '0@s.whatsapp.net',
    remoteJid: 'status@broadcast',
  },
  message: {
    contactMessage: {
      displayName: 'WhatsApp Business ✅',
      vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:WhatsApp Business\nORG:WhatsApp Inc.\nEND:VCARD',
    },
  },
};

function buildMentionText(mentionJid) {
  if (!mentionJid) return '';
  const username = String(mentionJid).replace(/@.*$/, '');
  return `@${username}`;
}

function addMentionToPayload(payload, mentionJid) {
  if (!mentionJid) return payload;
  const mentionText = buildMentionText(mentionJid);
  if (payload.text) {
    payload.text = `${mentionText} ${payload.text}`;
  }
  if (payload.caption) {
    payload.caption = `${mentionText} ${payload.caption}`;
  }
  return payload;
}

function attachChannelButton(payload) {
  if (!payload || payload.listMessage || payload.buttonsMessage || payload.templateMessage) {
    return payload;
  }

  if (!payload.templateButtons) {
    payload.templateButtons = [
      {
        urlButton: {
          displayText: 'View Channel',
          url: BOT_CHANNEL_URL,
        },
      },
    ];
  }

  if (!payload.footer) {
    payload.footer = 'Tap below to view the WhatsApp channel.';
  }

  return payload;
}

function getMentionsFromMessage(message) {
  const contextInfo = getContextInfo(message);
  return contextInfo?.mentionedJid || [];
}

async function sendBotReply(jid, payload, mentionJid, options = {}) {
  const mergedPayload = attachChannelButton({ ...payload });
  const mergedOptions = { ...options };

  if (!mergedOptions.quoted) {
    mergedOptions.quoted = BOT_THUMBNAIL_QUOTE;
  }

  const contextInfo = mergedOptions.contextInfo || mergedPayload.contextInfo || {};
  const mentioned = new Set([...(contextInfo.mentionedJid || [])]);
  if (mentionJid) mentioned.add(mentionJid);
  if (mentioned.size > 0) {
    mergedOptions.contextInfo = { ...contextInfo, mentionedJid: [...mentioned] };
  } else if (Object.keys(contextInfo).length > 0) {
    mergedOptions.contextInfo = contextInfo;
  }

  addMentionToPayload(mergedPayload, mentionJid);
  return sendTrackedMessage(jid, mergedPayload, mergedOptions);
}

let sock;

function rememberSentMessage(messageId) {
  if (!messageId) return;
  BOT_STATE.sentMessageIds.push(messageId);
  if (BOT_STATE.sentMessageIds.length > 200) {
    BOT_STATE.sentMessageIds.shift();
  }
}

function consumeSentMessage(messageId) {
  const index = BOT_STATE.sentMessageIds.indexOf(messageId);
  if (index === -1) return false;
  BOT_STATE.sentMessageIds.splice(index, 1);
  return true;
}

async function sendTrackedMessage(jid, payload, options = {}) {
  const mergedOptions = { ...options };
  if (!mergedOptions.quoted) {
    mergedOptions.quoted = BOT_THUMBNAIL_QUOTE;
  }
  const sent = await sock.sendMessage(jid, payload, mergedOptions);
  rememberSentMessage(sent?.key?.id);
  return sent;
}

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

function loadUsersDb() {
  if (!fs.existsSync(CONFIG.usersDb)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(CONFIG.usersDb, 'utf8'));
  } catch (error) {
    console.error('Failed to load users database:', error.message);
    return {};
  }
}

function saveUsersDb(db) {
  fs.writeFileSync(CONFIG.usersDb, JSON.stringify(db, null, 2));
}

function getUserData(userId) {
  const db = loadUsersDb();

  if (!db[userId]) {
    db[userId] = {
      name: null,
      firstTime: true,
      conversationHistory: [],
      lastSeen: new Date().toISOString(),
    };
    saveUsersDb(db);
  }

  db[userId].lastSeen = new Date().toISOString();
  saveUsersDb(db);
  return db[userId];
}

function saveUserData(userId, userData) {
  const db = loadUsersDb();
  db[userId] = userData;
  saveUsersDb(db);
}

function extractNameFromMessage(text, currentName) {
  const patterns = [
    /(?:i['\s]?m|i am|my name is|call me|you can call me)\s+([A-Za-z][A-Za-z'-]{1,29})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }
  }

  return currentName;
}

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

function extractDigits(value) {
  return normalizeJid(value).replace(/\D/g, '');
}

function isOwner(jid) {
  const ownerDigits = extractDigits(CONFIG.ownerNumber);
  const jidDigits = extractDigits(jid);

  if (!ownerDigits || !jidDigits) {
    return normalizeJid(jid) === normalizeJid(CONFIG.ownerNumber);
  }

  return jidDigits.includes(ownerDigits) || ownerDigits.includes(jidDigits);
}

function isCommand(text, options = {}) {
  return Boolean(parseCommand(text, options).command);
}

function extractUrl(text) {
  const urlMatch = text.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) return urlMatch[0];
  const simpleMatch = text.match(/(www\.[^\s]+\.[^\s]+)/i);
  return simpleMatch ? `https://${simpleMatch[0]}` : null;
}

function inferDownloadCommand(url) {
  if (!url) return 'download';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return 'youtube';
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch') || lowerUrl.includes('fb.com')) return 'facebook';
  if (lowerUrl.includes('instagram.com') || lowerUrl.includes('insta')) return 'instagram';
  if (lowerUrl.includes('tiktok.com') || lowerUrl.includes('vt.tiktok.com')) return 'tiktok';
  return 'download';
}

function parseCommand(text, options = {}) {
  const allowBare = Boolean(options.allowBare);
  const prefix = getCommandPrefix(text);
  if (!prefix && !allowBare) {
    return { command: null, args: [] };
  }

  const rawText = stripCommandPrefix(text, prefix);
  const cleanText = rawText.toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (!words.length) return { command: null, args: [] };

  let args = [...words];
  if (args[0] === 'run') {
    args.shift();
  }

  // Direct commands
  const direct = COMMAND_ALIASES[args[0]] || args[0];
  if (OWNER_COMMANDS.has(direct)) {
    return { command: direct, args: args.slice(1) };
  }

  // Natural language commands
  if (cleanText.includes('help')) return { command: 'help', args: [] };
  if (cleanText.includes('ping')) return { command: 'ping', args: [] };
  if (cleanText.includes('alive')) return { command: 'alive', args: [] };
  if (cleanText.includes('uptime')) return { command: 'uptime', args: [] };
  if (cleanText.includes('pause')) return { command: 'pause', args: [] };
  if (cleanText.includes('tic tac toe') || cleanText.includes('tictactoe')) return { command: 'tictactoe', args: [] };
  if (cleanText.includes('play') && cleanText.includes('game')) return { command: 'game', args: [] };
  if (cleanText.includes('download') || cleanText.includes('download this') || cleanText.includes('download that')) {
    const url = extractUrl(cleanText);
    return { command: inferDownloadCommand(url), args: url ? [url] : [] };
  }
  if (cleanText.includes('youtube')) {
    const url = extractUrl(cleanText);
    return { command: 'youtube', args: url ? [url] : args.slice(1) };
  }
  if (cleanText.includes('facebook')) {
    const url = extractUrl(cleanText);
    return { command: 'facebook', args: url ? [url] : args.slice(1) };
  }
  if (cleanText.includes('instagram')) {
    const url = extractUrl(cleanText);
    return { command: 'instagram', args: url ? [url] : args.slice(1) };
  }
  if (cleanText.includes('movie')) {
    const movieArgs = cleanText.split('movie').slice(1).join(' ').trim();
    return { command: 'movie', args: movieArgs ? movieArgs.split(/\s+/) : [] };
  }
  if (cleanText.includes('imagine') || cleanText.includes('generate image') || cleanText.includes('create image') || cleanText.includes('make image') || cleanText.includes('draw ')) {
    const imagePrompt = extractImagePrompt(cleanText);
    return { command: 'imagine', args: imagePrompt ? [imagePrompt] : args.slice(1) };
  }

  // If this is just a friendly owner chat, treat as regular AI chat
  if (/^(hi|hello|hey|howdy|rest)\b/.test(cleanText)) {
    return { command: null, args: [] };
  }

  return { command: null, args: [] };
}

function stripCommandPrefix(text, prefix = getCommandPrefix(text)) {
  const value = String(text || '').trim();
  if (prefix === '.') {
    return value.slice(1).trim();
  }
  return value;
}

function isImagePrompt(text) {
  const value = text.toLowerCase();
  return (
    value.startsWith('generate image') ||
    value.startsWith('create image') ||
    value.startsWith('make image') ||
    value.startsWith('draw ') ||
    value.startsWith('imagine ')
  );
}

function extractImagePrompt(text) {
  return text
    .replace(/^generate image\s*/i, '')
    .replace(/^create image\s*/i, '')
    .replace(/^make image\s*/i, '')
    .replace(/^draw\s*/i, '')
    .replace(/^imagine\s*/i, '')
    .trim();
}

function getCommandPrefix(text) {
  const value = String(text || '').trim();
  if (!value) return null;

  if (value.startsWith('.')) return '.';
  return null;
}

function getContextInfo(message) {
  if (!message) return null;

  return (
    message.extendedTextMessage?.contextInfo ||
    message.imageMessage?.contextInfo ||
    message.videoMessage?.contextInfo ||
    message.audioMessage?.contextInfo ||
    message.documentMessage?.contextInfo ||
    message.buttonsResponseMessage?.contextInfo ||
    message.listResponseMessage?.contextInfo ||
    null
  );
}

function unwrapMessageContainer(message) {
  if (!message) return null;

  const nested =
    message.ephemeralMessage?.message ||
    message.viewOnceMessage?.message ||
    message.viewOnceMessageV2?.message ||
    message.viewOnceMessageV2Extension?.message ||
    message.documentWithCaptionMessage?.message ||
    message.editedMessage?.message?.protocolMessage?.editedMessage;

  return nested ? unwrapMessageContainer(nested) : message;
}

function getQuotedMessage(msg) {
  const contextInfo = getContextInfo(msg?.message);
  return unwrapMessageContainer(contextInfo?.quotedMessage || null);
}

function getQuotedMedia(quotedMessage) {
  if (!quotedMessage) return null;

  if (quotedMessage.imageMessage) {
    return {
      kind: 'image',
      payload: quotedMessage.imageMessage,
      sendOptions: {
        image: undefined,
        caption: quotedMessage.imageMessage.caption || '',
      },
    };
  }

  if (quotedMessage.videoMessage) {
    return {
      kind: 'video',
      payload: quotedMessage.videoMessage,
      sendOptions: {
        video: undefined,
        caption: quotedMessage.videoMessage.caption || '',
      },
    };
  }

  if (quotedMessage.audioMessage) {
    return {
      kind: 'audio',
      payload: quotedMessage.audioMessage,
      sendOptions: {
        audio: undefined,
        mimetype: quotedMessage.audioMessage.mimetype || 'audio/mp4',
        ptt: Boolean(quotedMessage.audioMessage.ptt),
      },
    };
  }

  return null;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function downloadQuotedMediaBuffer(kind, payload) {
  const stream = await downloadContentFromMessage(payload, kind);
  return streamToBuffer(stream);
}

function extractMediaMessage(message) {
  const unwrapped = unwrapMessageContainer(message);
  if (!unwrapped) return null;

  if (unwrapped.imageMessage) {
    return { kind: 'image', payload: unwrapped.imageMessage };
  }

  if (unwrapped.videoMessage) {
    return { kind: 'video', payload: unwrapped.videoMessage };
  }

  if (unwrapped.audioMessage) {
    return { kind: 'audio', payload: unwrapped.audioMessage };
  }

  return null;
}

async function isGroupAdmin(groupJid, participantJid) {
  try {
    const metadata = await sock.groupMetadata(groupJid);
    const participant = metadata.participants.find((item) => normalizeJid(item.id) === normalizeJid(participantJid));
    return Boolean(participant && (participant.admin === 'admin' || participant.admin === 'superadmin'));
  } catch (error) {
    console.error('Group metadata error:', error.message);
    return false;
  }
}

async function sendGroupStatusMessage(groupJid, sourceMessage, caption) {
  const quotedMessage = getQuotedMessage(sourceMessage);
  const media = extractMediaMessage(quotedMessage || sourceMessage.message);

  if (!media && !caption) {
    return 'Reply image/video/audio or add text. Example: `.gcstatus Hello group`';
  }

  let payload = {};

  if (media?.kind === 'image') {
    const buffer = await downloadQuotedMediaBuffer('image', media.payload);
    payload = { image: buffer, caption };
  } else if (media?.kind === 'video') {
    const buffer = await downloadQuotedMediaBuffer('video', media.payload);
    payload = { video: buffer, caption };
  } else if (media?.kind === 'audio') {
    const buffer = await downloadQuotedMediaBuffer('audio', media.payload);
    payload = {
      audio: buffer,
      mimetype: media.payload.mimetype || 'audio/mp4',
      ptt: Boolean(media.payload.ptt),
    };
  } else {
    payload = { text: caption };
  }

  const inside = await generateWAMessageContent(payload, {
    upload: sock.waUploadToServer,
  });

  const messageSecret = crypto.randomBytes(32);
  const statusMessage = generateWAMessageFromContent(
    groupJid,
    {
      messageContextInfo: { messageSecret },
      groupStatusMessageV2: {
        message: {
          ...inside,
          messageContextInfo: { messageSecret },
        },
      },
    },
    {}
  );

  await sock.relayMessage(groupJid, statusMessage.message, {
    messageId: statusMessage.key.id,
  });

  return null;
}

function shouldReplyInGroup(msg, text) {
  const mentioned = getMentionsFromMessage(msg.message);
  const normalizedText = text.replace(/\s+/g, '');
  return mentioned.includes(CONFIG.botNumber) || normalizedText.includes(BOT_PHONE);
}

function getSenderId(msg, isGroup, remoteJid) {
  if (msg.key.fromMe) {
    return CONFIG.ownerNumber;
  }

  if (!isGroup) return remoteJid;
  return (
    msg.key.participantAlt ||
    msg.key.participant ||
    msg.participantAlt ||
    msg.participant ||
    remoteJid
  );
}

function truncateHistory(history, limit = 12) {
  return history.slice(-limit);
}

function buildAiPrompt(userData, text, isGroup) {
  const history = truncateHistory(userData.conversationHistory)
    .map((item) => `${item.role === 'assistant' ? 'Rest AI' : 'User'}: ${item.content}`)
    .join('\n');

  const userNameLine = userData.name
    ? `The user's name is ${userData.name}.`
    : "The user's name is not known yet.";

  const welcomeLine = userData.firstTime
    ? 'This is the first time this user is chatting with you.'
    : 'This user has chatted with you before, so greet them as a returning contact.';

  const groupLine = isGroup
    ? 'This message came from a WhatsApp group. If you are mentioned, reply directly and mention the sender in your answer. Do not respond to every group message unless explicitly required.'
    : 'This message came from a private chat.';

  return [
    `You are ${BOT_INFO.name}, a professional WhatsApp business assistant created by ${BOT_INFO.developer}.`,
    'Use clear American English for most replies, but if the user uses pidgin, adapt gently and keep the tone helpful and respectful.',
    'Always respond in a professional business voice that feels polite, concise, and service-oriented.',
    'If the user writes in another language, continue the conversation smoothly and use clear English unless they ask you to switch languages.',
    'If they ask your name, say your name is Rest AI. If they ask your developer, say Emmanuel Restoration Abimbola created you.',
    'Keep replies short and easy to understand, normally one or two short paragraphs.',
    'If the user is returning and you know their name, greet them warmly but professionally.',
    userNameLine,
    welcomeLine,
    groupLine,
    history ? `Recent conversation:\n${history}` : 'No recent conversation yet.',
    `User: ${text}`,
    'Reply now:',
  ].join('\n\n');
}

async function fetchJson(url, params, timeoutMs = 30000) {
  const query = new URLSearchParams(params);
  const requestUrl = `${url}?${query.toString()}`;

  return await new Promise((resolve, reject) => {
    const request = https.get(requestUrl, (response) => {
      const statusCode = response.statusCode || 0;
      const contentType = response.headers['content-type'] || '';
      let body = '';

      response.setEncoding('utf8');

      response.on('data', (chunk) => {
        body += chunk;
      });

      response.on('end', () => {
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }

        try {
          if (String(contentType).includes('application/json')) {
            resolve(JSON.parse(body));
            return;
          }

          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ raw: body });
          }
        } catch (error) {
          reject(error);
        }
      });

      response.on('error', (error) => {
        reject(error);
      });
    });

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error('Request timeout'));
    });

    request.on('error', (error) => {
      reject(error);
    });
  });
}

function normalizeAiReply(data) {
  if (!data) return null;

  const candidates = [
    data.result,
    data.reply,
    data.response,
    data.message,
    data.answer,
    data.text,
    data.raw,
  ];

  const value = candidates.find((item) => typeof item === 'string' && item.trim());
  return value ? value.trim() : null;
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || null;
const openaiClient = OPENAI_API_KEY ? new OpenAI({ apiKey: OPENAI_API_KEY }) : null;

async function getAiReply(prompt) {
  if (openaiClient) {
    try {
      const response = await openaiClient.responses.create({
        model: 'gpt-3.5-turbo',
        input: prompt,
        max_output_tokens: 500,
      });

      const output = response.output?.[0]?.content?.find((item) => item.type === 'output_text')?.text;
      if (typeof output === 'string' && output.trim()) {
        return output.trim();
      }
    } catch (error) {
      console.error('OpenAI API error:', error.message);
    }
  }

  try {
    const response = await fetchJson(CONFIG.metaAiApi, { text: prompt });
    return normalizeAiReply(response);
  } catch (error) {
    console.error('Meta AI API error:', error.message);
    return null;
  }
}

function normalizeImageUrl(data) {
  if (!data) return null;

  const candidates = [
    data.image,
    data.url,
    data.result,
    data.download_url,
    data.raw,
  ];

  const value = candidates.find((item) => typeof item === 'string' && /^https?:\/\//i.test(item));
  return value || null;
}

function normalizeDownloadUrl(data) {
  if (!data) return null;

  const candidates = [
    data.download_url,
    data.url,
    data.video,
    data.link,
    data.result,
    data.raw,
  ];

  const value = candidates.find((item) => typeof item === 'string' && /^https?:\/\//i.test(item));
  return value || null;
}

async function scrapeTikTokVideo(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      maxRedirects: 5,
      timeout: 30000,
    });

    const html = response.data;
    let jsonMatch = html.match(/<script id="SIGI_STATE">(.*?)<\/script>/s);
    if (!jsonMatch) {
      jsonMatch = html.match(/window\['SIGI_STATE'\]\s*=\s*({.*?});/s);
    }
    if (!jsonMatch) {
      return null;
    }

    const content = jsonMatch[1];
    const state = JSON.parse(content);
    const itemModule = state?.ItemModule || state?.itemModule || {};
    const firstItem = Object.values(itemModule)[0];
    const video = firstItem?.video || {};
    return video?.downloadAddr || video?.playAddr || null;
  } catch (error) {
    console.error('TikTok scrape error:', error.message);
    return null;
  }
}

async function downloadMedia(url) {
  let downloadUrl = null;

  try {
    const data = await fetchJson('https://apis.davidcyril.name.ng/download/aio', { url }, 45000);
    downloadUrl = normalizeDownloadUrl(data) || normalizeImageUrl(data);
  } catch (error) {
    console.error('Download API error:', error.message);
  }

  if (!downloadUrl && typeof url === 'string' && /tiktok\.com|vt\.tiktok\.com/i.test(url)) {
    downloadUrl = await scrapeTikTokVideo(url);
  }

  return downloadUrl;
}

function renderTicTacToeBoard(board) {
  return board
    .map((row) => row.map((cell) => (cell === ' ' ? '▪️' : cell)).join(' | '))
    .join('\n---------\n');
}

function getTicTacToeWinner(board) {
  const lines = [
    [board[0][0], board[0][1], board[0][2]],
    [board[1][0], board[1][1], board[1][2]],
    [board[2][0], board[2][1], board[2][2]],
    [board[0][0], board[1][0], board[2][0]],
    [board[0][1], board[1][1], board[2][1]],
    [board[0][2], board[1][2], board[2][2]],
    [board[0][0], board[1][1], board[2][2]],
    [board[0][2], board[1][1], board[2][0]],
  ];

  for (const line of lines) {
    if (line[0] !== ' ' && line[0] === line[1] && line[1] === line[2]) {
      return line[0];
    }
  }

  if (board.every((row) => row.every((cell) => cell !== ' '))) {
    return 'draw';
  }

  return null;
}

function renderTicTacToeBoard(board) {
  const labels = '  A   B   C';
  return board
    .map((row, index) => `${index + 1} ${row.map((cell) => (cell === ' ' ? ' ' : cell)).join(' | ')}`)
    .reduce((text, row, index) => `${text}${index ? '\n---+---+---\n' : '\n'}${row}`, labels);
}

function normalizeTicTacToeMove(args) {
  const joined = args.join(' ').trim().toLowerCase();
  if (!joined) return null;

  const compact = joined.replace(/\s+/g, '');
  const alphaNumeric = compact.match(/^([abc])([123])$/i);
  if (alphaNumeric) {
    return {
      row: Number(alphaNumeric[2]) - 1,
      col: alphaNumeric[1].toLowerCase().charCodeAt(0) - 97,
    };
  }

  const numeric = joined.match(/^([123])\s+([123])$/);
  if (numeric) {
    return {
      row: Number(numeric[1]) - 1,
      col: Number(numeric[2]) - 1,
    };
  }

  return null;
}

function getAvailableTicTacToeMoves(board) {
  const moves = [];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (board[row][col] === ' ') {
        moves.push({ row, col });
      }
    }
  }
  return moves;
}

function cloneBoard(board) {
  return board.map((row) => [...row]);
}

function pickAiMove(board) {
  const aiMark = 'O';
  const playerMark = 'X';
  const availableMoves = getAvailableTicTacToeMoves(board);

  for (const move of availableMoves) {
    const testBoard = cloneBoard(board);
    testBoard[move.row][move.col] = aiMark;
    if (getTicTacToeWinner(testBoard) === aiMark) {
      return move;
    }
  }

  for (const move of availableMoves) {
    const testBoard = cloneBoard(board);
    testBoard[move.row][move.col] = playerMark;
    if (getTicTacToeWinner(testBoard) === playerMark) {
      return move;
    }
  }

  return (
    availableMoves.find((move) => move.row === 1 && move.col === 1) ||
    availableMoves.find((move) => (move.row === 0 || move.row === 2) && (move.col === 0 || move.col === 2)) ||
    availableMoves[0] ||
    null
  );
}

function formatTicTacToeCell(row, col) {
  return `${String.fromCharCode(65 + col)}${row + 1}`;
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function formatWeather() {
  const formatter = new Intl.DateTimeFormat('en-NG', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  });

  return `I no get live weather data inside this bot yet, but Lagos time now na ${formatter.format(new Date())}.`;
}

function calculateExpression(expression) {
  const clean = expression.replace(/\s+/g, '');
  if (!clean || !/^[0-9+\-*/%.()]+$/.test(clean)) {
    return null;
  }

  try {
    const value = Function(`"use strict"; return (${clean});`)();
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

function buildMovieListMessage(query, movies) {
  const rows = movies.slice(0, 5).map((item, index) => ({
    title: `${item.show.name} (${item.show.premiered ? item.show.premiered.slice(0, 4) : 'N/A'})`,
    description: item.show.summary
      ? item.show.summary.replace(/<[^>]+>/g, '').slice(0, 100) + '...'
      : 'No description available.',
    rowId: `movie_${index}`,
  }));

  return {
    listMessage: {
      title: `Movie search results for: ${query}`,
      description: 'Swipe through the results and choose one.',
      buttonText: 'View movies',
      sections: [
        {
          title: 'Movies',
          rows,
        },
      ],
    },
  };
}

async function searchMovies(query) {
  try {
    const data = await fetchJson('https://api.tvmaze.com/search/shows', { q: query }, 20000);
    if (!Array.isArray(data)) return [];
    return data.slice(0, 5);
  } catch (error) {
    console.error('Movie search error:', error.message);
    return [];
  }
}

async function sendMovieResults(replyJid, query) {
  const movies = await searchMovies(query);
  if (!movies.length) {
    await sendBotReply(replyJid, { text: `No movie results found for "${query}". Try another title.` });
    return;
  }

  const listMessage = buildMovieListMessage(query, movies);
  await sendBotReply(replyJid, listMessage);
}

async function generateImage(prompt) {
  if (openaiClient) {
    try {
      const response = await openaiClient.images.generate({
        model: 'gpt-image-1',
        prompt,
        size: '1024x1024',
      });
      const imageUrl = response.data?.[0]?.url;
      if (typeof imageUrl === 'string' && imageUrl.trim()) {
        return imageUrl.trim();
      }
    } catch (error) {
      console.error('OpenAI image error:', error.message);
    }
  }

  try {
    const data = await fetchJson(CONFIG.fluxApi, { prompt }, 45000);
    return normalizeImageUrl(data);
  } catch (error) {
    console.error('Image API error:', error.message);
    return null;
  }
}

function formatUptime() {
  const totalSeconds = Math.floor((Date.now() - BOT_STATE.startTime) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

function handleAskCommandExamples(command) {
  if (command === 'ai' || command === 'ask') {
    return 'Send a question like `.ai who be your developer?`';
  }

  return `Use \`${BOT_INFO.commandPrefix}${command}\``;
}

async function handleOwnerCommand(command, args, replyJid, senderJid, msg) {
  const rawArgs = args.join(' ').trim();

  switch (command) {
    case 'owner':
      return [
        `*${BOT_INFO.name} Owner*`,
        `Owner number: ${CONFIG.ownerNumber.replace('@s.whatsapp.net', '')}`,
        `Developer: ${BOT_INFO.developer}`,
      ].join('\n');

    case 'ping':
      return 'Pong. I dey active and sharp sharp.';

    case 'alive':
      return `${BOT_INFO.name} dey online. No worry, I still dey work.`;

    case 'uptime':
      return `Uptime: ${formatUptime()}`;

    case 'pause':
      BOT_STATE.paused = true;
      return 'Bot don pause. Normal users no go get reply until you use `.resume`.';

    case 'resume':
      BOT_STATE.paused = false;
      return 'Bot don resume. I fit reply people again.';

    case 'status': {
      if (msg) {
        const quotedStatus = await maybeSendQuotedStatus(replyJid, msg);
        if (quotedStatus !== null) {
          return quotedStatus;
        }
      }

      return [
        `*${BOT_INFO.name} Status*`,
        `Paused: ${BOT_STATE.paused ? 'yes' : 'no'}`,
        `Uptime: ${formatUptime()}`,
        `Prefix: ${BOT_INFO.commandPrefix}`,
      ].join('\n');
    }

    case 'prefix':
      return `Command prefix don change to \`${BOT_INFO.commandPrefix}\` only. Example: \`.menu\``;

    case 'game':
      return 'Game menu: `.tictactoe`, `.dice`, `.coinflip`, `.8ball`.';

    case 'tiktok':
    case 'youtube':
    case 'facebook':
    case 'instagram': {
      if (!rawArgs) {
        return `Send the link like: \`.${command} https://example.com/...\``;
      }

      await sendBotReply(replyJid, { text: `I dey fetch the download link now for ${command}...` });
      const downloadUrl = await downloadMedia(rawArgs);
      if (!downloadUrl) {
        return `I no fit get download link for that ${command} link now. Make you try again or send another link.`;
      }

      return `Download link for your ${command} video:\n${downloadUrl}`;
    }

    case 'movie': {
      if (!rawArgs) {
        return 'Send movie search like: `.movie Spider-Man`';
      }

      await sendMovieResults(replyJid, rawArgs);
      return null;
    }

    case 'tictactoe': {
      const userData = getUserData(senderJid);
      userData.ticTacToe = {
        board: [
          [' ', ' ', ' '],
          [' ', ' ', ' '],
          [' ', ' ', ' '],
        ],
        player: 'X',
        ai: 'O',
        status: 'playing',
      };
      saveUserData(senderJid, userData);

      return [
        'Tic-Tac-Toe don start.',
        'You be X and you start first. AI be O.',
        `Play with \`.move A1\` or \`.move 1 1\`.`,
        '',
        renderTicTacToeBoard(userData.ticTacToe.board),
      ].join('\n');
    }

    case 'move': {
      const move = normalizeTicTacToeMove(args);
      if (!move) {
        return 'Send your move like `.move A1` or `.move 2 3`.';
      }

      const userData = getUserData(senderJid);
      const game = userData.ticTacToe;
      if (!game || game.status !== 'playing') {
        return 'No active Tic-Tac-Toe game. Start one with `.tictactoe`.';
      }

      if (game.board[move.row][move.col] !== ' ') {
        return 'That position don full. Choose another square.';
      }

      game.board[move.row][move.col] = game.player;
      let winner = getTicTacToeWinner(game.board);
      if (winner === game.player) {
        game.status = 'finished';
        saveUserData(senderJid, userData);
        return `You win this round.\n\n${renderTicTacToeBoard(game.board)}`;
      }

      if (winner === 'draw') {
        game.status = 'draw';
        saveUserData(senderJid, userData);
        return `Draw game.\n\n${renderTicTacToeBoard(game.board)}`;
      }

      const aiMove = pickAiMove(game.board);
      if (aiMove) {
        game.board[aiMove.row][aiMove.col] = game.ai;
      }

      winner = getTicTacToeWinner(game.board);
      if (winner === game.ai) {
        game.status = 'finished';
        saveUserData(senderJid, userData);
        return [
          `You play ${formatTicTacToeCell(move.row, move.col)}. AI answer with ${formatTicTacToeCell(aiMove.row, aiMove.col)}.`,
          '',
          renderTicTacToeBoard(game.board),
          '',
          'AI win this round.',
        ].join('\n');
      }

      if (winner === 'draw') {
        game.status = 'draw';
        saveUserData(senderJid, userData);
        return [
          `You play ${formatTicTacToeCell(move.row, move.col)}. AI answer with ${formatTicTacToeCell(aiMove.row, aiMove.col)}.`,
          '',
          renderTicTacToeBoard(game.board),
          '',
          'Draw game.',
        ].join('\n');
      }

      saveUserData(senderJid, userData);
      return [
        `You play ${formatTicTacToeCell(move.row, move.col)}. AI answer with ${formatTicTacToeCell(aiMove.row, aiMove.col)}.`,
        '',
        renderTicTacToeBoard(game.board),
        '',
        'Your turn again.',
      ].join('\n');
    }

    case 'imagine': {
      if (!rawArgs) {
        return 'Send image prompt like: `.img a cyberpunk Lagos night market`';
      }

      await sendBotReply(replyJid, { text: 'I dey generate the image now. Small time.' });
      const imageUrl = await generateImage(rawArgs);

      if (!imageUrl) {
        return 'Image generation fail. Try another prompt.';
      }

      await sendBotReply(replyJid, {
        image: { url: imageUrl },
        caption: `Generated image for: ${rawArgs}`,
      });
      return null;
    }

    case 'echo':
      return rawArgs || 'Send text after `.echo`.';

    case 'reverse':
      return rawArgs ? rawArgs.split('').reverse().join('') : 'Send text after `.reverse`.';

    case 'upper':
      return rawArgs ? rawArgs.toUpperCase() : 'Send text after `.upper`.';

    case 'lower':
      return rawArgs ? rawArgs.toLowerCase() : 'Send text after `.lower`.';

    case 'count':
      if (!rawArgs) {
        return 'Send text after `.count`.';
      }
      return `Chars: ${rawArgs.length}\nWords: ${rawArgs.split(/\s+/).filter(Boolean).length}`;

    case 'calc': {
      if (!rawArgs) {
        return 'Send calculation like `.calc (12+8)*3`';
      }
      const value = calculateExpression(rawArgs);
      return value === null ? 'I no fit solve that expression. Use only numbers and + - * / % ( ).' : `Answer: ${value}`;
    }

    case 'date':
      return new Intl.DateTimeFormat('en-NG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Africa/Lagos',
      }).format(new Date());

    case 'time':
      return new Intl.DateTimeFormat('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'Africa/Lagos',
      }).format(new Date());

    case 'jid':
      return `Chat: ${replyJid}\nSender: ${senderJid}`;

    case 'pick': {
      if (!rawArgs) {
        return 'Send options like `.pick rice, beans, yam`';
      }
      const choices = rawArgs.split(/[,|]/).map((item) => item.trim()).filter(Boolean);
      const pool = choices.length ? choices : rawArgs.split(/\s+/).filter(Boolean);
      return pool.length ? `I pick: ${getRandomItem(pool)}` : 'Give me options to pick from.';
    }

    case 'dice':
      return `You roll: ${Math.floor(Math.random() * 6) + 1}`;

    case 'coinflip':
      return `Coin talk: ${Math.random() < 0.5 ? 'Heads' : 'Tails'}`;

    case '8ball':
      if (!rawArgs) {
        return 'Ask question like `.8ball will this deploy work?`';
      }
      return getRandomItem(EIGHT_BALL_ANSWERS);

    case 'quote':
      return getRandomItem(QUICK_QUOTES);

    case 'fact':
      return getRandomItem(QUICK_FACTS);

    case 'joke':
      return getRandomItem(QUICK_JOKES);

    case 'compliment':
      return getRandomItem(QUICK_COMPLIMENTS);

    case 'weather':
      return formatWeather();

    case 'vv':
      return null;

    default:
      return `I no know that command. Use \`${BOT_INFO.commandPrefix}menu\`.`;
  }
}

async function sendHelpMenu(replyJid) {
  await sendBotReply(replyJid, {
    image: { url: BOT_INFO.menuImage },
    caption: buildHelpMenu(),
  });
}

function buildHelpMenu() {
  const now = new Date();
  const dateText = new Intl.DateTimeFormat('en-NG', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'Africa/Lagos',
  }).format(now);
  const timeText = new Intl.DateTimeFormat('en-NG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Lagos',
  }).format(now);

  return [
    `*${BOT_INFO.name} Menu*`,
    `Date: ${dateText}`,
    `Time: ${timeText}`,
    `Prefix: ${BOT_INFO.commandPrefix}`,
    `Commands: ${OWNER_COMMANDS.size}+`,
    '',
    'Core',
    '.menu, .owner, .ping, .alive, .uptime, .status, .pause, .resume, .prefix',
    '',
    'AI and Media',
    '.ai [question], .img [prompt], .vv, .gcstatus [text]',
    '',
    'Downloads',
    '.youtube, .facebook, .instagram, .tiktok, .movie',
    '',
    'Games',
    '.tictactoe, .move A1, .dice, .coinflip, .8ball [question]',
    '',
    'Utilities',
    '.echo, .reverse, .upper, .lower, .count, .calc, .date, .time, .jid, .pick',
    '',
    'Fun',
    '.quote, .fact, .joke, .compliment, .weather',
    '',
    'Owner self DM shortcut',
    'Inside your own DM, you can type commands without the dot. Example: `menu`, `ping`, `tictactoe`.',
  ].join('\n');
}

async function connectToWhatsApp(isRetry = false) {
  try {
    if (!fs.existsSync(CONFIG.authDir)) {
      fs.mkdirSync(CONFIG.authDir, { recursive: true });
      console.log(`✅ Created session directory: ${CONFIG.authDir}`);
    }

    console.log(`🔌 Initializing WhatsApp connection from: ${CONFIG.authDir}`);
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.authDir);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger: silentLogger,
      browser: ['Rest AI', 'Chrome', '1.0.0'],
      connectTimeoutMs: 90000,
      qrTimeout: 120000,
      keepAliveIntervalMs: 30000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 250,
      maxRetries: 5,
    });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔗 QR code generated! Access it at the web interface.\n');
      console.log(`🌐 Web server: http://localhost:${CONFIG.port}`);

      // Generate QR code as data URL for web display
      try {
        currentQR = await QRCode.toDataURL(qr);
        console.log('✅ QR code image generated for web display');
      } catch (error) {
        console.error('❌ Failed to generate QR code image:', error);
      }

      // Also show terminal QR for local development
      qrcode.generate(qr, { small: true });
      console.log('\n📱 Make sure to scan the QR code within 60 seconds!\n');
    }

    if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }

    if (connection === 'open') {
      console.log('✅ Successfully connected to WhatsApp!');
      console.log('🤖 Rest AI Bot is now online and ready to receive messages.');
      console.log(`📂 Session persisted at: ${CONFIG.authDir}`);
      currentQR = null;
      BOT_STATE.reconnectAttempts = 0;
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;
      console.log(`❌ Connection closed with status: ${statusCode}`);

      if (shouldReconnect) {
        BOT_STATE.reconnectAttempts++;
        if (BOT_STATE.reconnectAttempts <= BOT_STATE.maxReconnectAttempts) {
          const backoffMs = Math.min(30000, 1000 * Math.pow(2, BOT_STATE.reconnectAttempts - 1));
          console.log(`🔄 Reconnect attempt ${BOT_STATE.reconnectAttempts}/${BOT_STATE.maxReconnectAttempts} in ${backoffMs}ms...`);
          setTimeout(() => connectToWhatsApp(true), backoffMs);
        } else {
          console.error(`🚫 Max reconnection attempts (${BOT_STATE.maxReconnectAttempts}) reached. Manual restart required.`);
          process.exit(1);
        }
      } else {
        console.log('🚫 Logged out from WhatsApp (status code ' + statusCode + '). Session needs to be re-paired.');
        BOT_STATE.reconnectAttempts = 0;
      }
    }
  });

  sock.ev.on('creds.update', async () => {
    console.log('💾 Saving WhatsApp credentials...');
    try {
      await saveCreds();
      console.log('✅ Credentials saved successfully.');
    } catch (error) {
      console.error('❌ Failed to save credentials:', error.message);
    }
  });

  sock.ev.on('messages.upsert', async (event) => {
    const msg = event.messages?.[0];
    if (!msg) return;

    if (msg.message?.protocolMessage?.type === 0 || msg.messageStubType === 0) {
      const deletedKey = msg.message?.protocolMessage?.key || msg.key;
      const remoteJid = msg.key.remoteJid;
      const isGroup = remoteJid?.endsWith('@g.us');
      const senderJid = getSenderId(msg, isGroup, remoteJid);
      const cached = getCachedMessage(deletedKey?.id);
      if (cached) {
        await sendDeletedMessageAlert(cached);
      } else {
        await sendDeletedMessageAlert({
          remoteJid,
          senderJid,
          senderName: msg.pushName || msg.pushname || msg.notify || senderJid,
          isGroup,
          message: null,
          timestamp: Date.now(),
        });
      }
      return;
    }

    if (msg.message && !msg.key.fromMe) {
      cacheMessage(msg);
    }

    if (!msg?.message) return;

    const remoteJid = msg.key.remoteJid;
    const text = getMessageText(msg.message);
    const isGroup = remoteJid?.endsWith('@g.us');
    const senderJid = getSenderId(msg, isGroup, remoteJid);

    if (!remoteJid || !text) return;
    if (remoteJid === 'status@broadcast') return;

    if (msg.key.fromMe && consumeSentMessage(msg.key.id)) {
      return;
    }

    const isOwnerSelfDm = !isGroup && normalizeJid(remoteJid) === normalizeJid(CONFIG.ownerNumber) && isOwner(senderJid);
    const hasCommandPrefix = Boolean(getCommandPrefix(text));
    const parsedCommand = parseCommand(text, { allowBare: isOwnerSelfDm });
    const ownerCommand =
      isOwner(senderJid) &&
      parsedCommand.command &&
      OWNER_COMMANDS.has(parsedCommand.command) &&
      (hasCommandPrefix || isOwnerSelfDm);

    const replyJid = remoteJid;

    if (isGroup && parsedCommand.command === 'gcstatus') {
      const caption = parsedCommand.args.join(' ').trim();
      const result = await sendGroupStatusMessage(replyJid, msg, caption);
      if (result) {
        await sendBotReply(replyJid, { text: result }, senderJid);
      } else {
        await sendBotReply(replyJid, { text: 'Group status sent.' }, senderJid);
      }
      return;
    }

    if (msg.key.fromMe && !isOwnerSelfDm && !ownerCommand) return;

    if (isGroup && !ownerCommand && !shouldReplyInGroup(msg, text)) {
      return;
    }

    console.log(`Message from ${senderJid} in ${replyJid}: ${text}`);

    try {
      if (ownerCommand) {
        if (parsedCommand.command === 'status') {
          await safeReact(replyJid, msg.key, '✅');
        }

        if (parsedCommand.command === 'help') {
          await sendHelpMenu(replyJid);
          return;
        }

        if (parsedCommand.command === 'vv') {
          const quotedMessage = getQuotedMessage(msg);
          if (!quotedMessage) {
            await sendBotReply(replyJid, { text: 'Reply to a view-once image, video, or audio with `.vv`.' }, senderJid);
            return;
          }

          const media = getQuotedMedia(quotedMessage);
          if (!media) {
            await sendBotReply(replyJid, { text: 'No supported media found in that quoted message.' }, senderJid);
            return;
          }

          await sendBotReply(replyJid, { text: `I am retrieving the ${media.kind} for you now...` }, senderJid);
          const buffer = await downloadQuotedMediaBuffer(media.kind, media.payload);
          const captionParts = [];
          if (media.payload.caption) {
            captionParts.push(media.payload.caption.trim());
          }
          captionParts.push('REST AI');

          const sendPayload = {
            ...media.sendOptions,
            [media.kind]: buffer,
            caption: captionParts.join('\n'),
          };
          await sendBotReply(replyJid, sendPayload, senderJid);
          return;
        }

        if (parsedCommand.command === 'ask') {
          const promptText = parsedCommand.args.join(' ').trim();
          if (!promptText) {
            await sendBotReply(replyJid, { text: handleAskCommandExamples('ask') }, senderJid);
            return;
          }

          const userData = getUserData(senderJid);
          userData.name = extractNameFromMessage(promptText, userData.name);
          userData.conversationHistory.push({
            role: 'user',
            content: promptText,
          });
          userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
          saveUserData(senderJid, userData);

          await sock.sendPresenceUpdate('composing', replyJid);
          const prompt = buildAiPrompt(userData, promptText, isGroup);
          const aiReply = await getAiReply(prompt);
          const finalReply = aiReply || 'I could not generate a response right now. Please try again in a moment.';

          userData.conversationHistory.push({
            role: 'assistant',
            content: finalReply,
          });
          userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
          userData.firstTime = false;
          saveUserData(senderJid, userData);

          await sendBotReply(replyJid, { text: finalReply }, senderJid);
          await sock.sendPresenceUpdate('available', replyJid);
          return;
        }

        const response = await handleOwnerCommand(parsedCommand.command, parsedCommand.args, replyJid, senderJid, msg);
        if (response) {
          await sendBotReply(replyJid, { text: response }, senderJid);
        }
        return;
      }

      const allowAiConversation = !isGroup || hasCommandPrefix;

      if (!allowAiConversation) {
        return;
      }

      if (BOT_STATE.paused && !isOwner(senderJid)) {
        return;
      }

      const userData = getUserData(senderJid);
      const aiInputText = stripCommandPrefix(text) || text;

      userData.name = extractNameFromMessage(aiInputText, userData.name);

      userData.conversationHistory.push({
        role: 'user',
        content: aiInputText,
      });
      userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
      saveUserData(senderJid, userData);

      await sock.sendPresenceUpdate('composing', replyJid);

      if (isImagePrompt(aiInputText)) {
        const prompt = extractImagePrompt(aiInputText);
        if (!prompt) {
          await sendBotReply(replyJid, {
            text: 'Tell me wetin you want make I generate. Example: generate image of a red Ferrari for Lagos street.',
          }, senderJid);
          await sock.sendPresenceUpdate('available', replyJid);
          return;
        }

        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
          await sendBotReply(replyJid, {
            image: { url: imageUrl },
            caption: `Oya, your image don land.\nPrompt: ${prompt}`,
          }, senderJid);
        } else {
          await sendBotReply(replyJid, {
            text: 'I try generate the image but e no work. Try another prompt small.',
          }, senderJid);
        }

        userData.conversationHistory.push({
          role: 'assistant',
          content: `Generated or attempted image for prompt: ${prompt}`,
        });
        userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
        userData.firstTime = false;
        saveUserData(senderJid, userData);
        await sock.sendPresenceUpdate('available', replyJid);
        return;
      }

      const prompt = buildAiPrompt(userData, aiInputText, isGroup);
      const aiReply = await getAiReply(prompt);

      const fallbackReply = userData.name
        ? `Hello ${userData.name}, I am available and ready to help. I could not generate a response right now, please try again shortly.`
        : 'I am available and ready to help. I could not generate a response right now, please try again shortly.';

      const finalReply = aiReply || fallbackReply;

      userData.conversationHistory.push({
        role: 'assistant',
        content: finalReply,
      });
      userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
      userData.firstTime = false;
      saveUserData(senderJid, userData);

      await sendBotReply(replyJid, { text: finalReply }, senderJid);
      await sock.sendPresenceUpdate('available', replyJid);
    } catch (error) {
      console.error('Message handler error:', error.message);
      try {
        await sendBotReply(replyJid, {
          text: 'Something break small for my side. Try again in a bit.',
        }, senderJid);
      } catch (sendError) {
        console.error('Failed to send error message:', sendError.message);
      }
    }
  });
  } catch (error) {
    console.error('❌ Failed to initialize WhatsApp connection:', error.message);
    console.error(error.stack);
    const backoffMs = Math.min(30000, 1000 * Math.pow(2, BOT_STATE.reconnectAttempts));
    BOT_STATE.reconnectAttempts++;
    console.log(`🔄 Retrying connection in ${backoffMs}ms...`);
    setTimeout(() => connectToWhatsApp(true), backoffMs);
  }
}

console.log(`Starting ${BOT_INFO.name} v${BOT_INFO.version}`);
console.log(`Developer: ${BOT_INFO.developer}`);
console.log(`Bot number: ${CONFIG.botNumber}`);
console.log(`Owner number: ${CONFIG.ownerNumber}`);
console.log(`Command prefix: ${BOT_INFO.commandPrefix}`);
console.log('AI provider: David Cyril Meta AI endpoint');
console.log('Image provider: David Cyril Flux V2 endpoint');

// =======================
// PROCESS ERROR HANDLING
// =======================
process.on('uncaughtException', (error) => {
  console.error('🔥 Uncaught Exception:', error);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, gracefully shutting down...');
  if (sock) {
    try {
      await sock.ev.removeAllListeners();
      sock.ws?.close?.();
      sock.end?.();
    } catch (e) {
      console.error('Error during graceful shutdown:', e.message);
    }
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, gracefully shutting down...');
  if (sock) {
    try {
      await sock.ev.removeAllListeners();
      sock.ws?.close?.();
      sock.end?.();
    } catch (e) {
      console.error('Error during graceful shutdown:', e.message);
    }
  }
  process.exit(0);
});

console.log(`\n🚀 Starting bot with persistent session at: ${CONFIG.authDir}\n`);
connectToWhatsApp().catch((error) => {
  console.error('❌ Failed to start bot:', error.message);
  console.error(error.stack);
  process.exit(1);
});
