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
  metaAiApi: 'https://apis.davidcyril.name.ng/ai/metaai',
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
    paused: BOT_STATE?.paused || false,
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
};

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

async function sendTrackedMessage(jid, payload, options) {
  const sent = await sock.sendMessage(jid, payload, options);
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
  const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
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
    : 'This user has chatted with you before, so greet them like someone returning.';

  const groupLine = isGroup
    ? 'This message came from a WhatsApp group. Only answer the actual question and do not act like you are replying to the whole group.'
    : 'This message came from a private chat.';

  return [
    `You are ${BOT_INFO.name}, a friendly WhatsApp assistant created by ${BOT_INFO.developer}.`,
    'Your style must be warm Nigerian pidgin mixed with clear English.',
    'Keep replies short, natural, and chatty. Usually 1 or 2 short paragraphs.',
    "If they ask your name, say your name is Rest AI. If they ask your developer, say Emmanuel Restoration Abimbola created you.",
    'If the user is returning and you know their name, greet them like: "Ahh Restoration, you don come back abii?" but adapt it naturally to their actual name.',
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

async function getAiReply(prompt) {
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

async function downloadMedia(url) {
  try {
    const data = await fetchJson('https://apis.davidcyril.name.ng/download/aio', { url }, 45000);
    return normalizeDownloadUrl(data) || normalizeImageUrl(data);
  } catch (error) {
    console.error('Download API error:', error.message);
    return null;
  }
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
    await sendTrackedMessage(replyJid, { text: `No movie results found for "${query}". Try another title.` });
    return;
  }

  const listMessage = buildMovieListMessage(query, movies);
  await sendTrackedMessage(replyJid, listMessage);
}

async function generateImage(prompt) {
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

async function handleOwnerCommand(command, args, replyJid, senderJid) {
  switch (command) {
    case 'help':
      return buildHelpMenu();

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
      BOT_STATE.paused = !BOT_STATE.paused;
      return BOT_STATE.paused
        ? 'Bot don pause. I no go reply normal users until you resume me.'
        : 'Bot don resume. I fit reply people again.';

    case 'game':
      return 'Game menu: trivia, riddles, guess number, word battle. Tell me which one you want make we run.';

    case 'tiktok':
    case 'youtube':
    case 'facebook':
    case 'instagram': {
      const targetUrl = args.join(' ').trim();
      if (!targetUrl) {
        return `Send the link like: \`rest ${command} https://example.com/...\``;
      }

      await sock.sendMessage(replyJid, { text: `I dey fetch the download link now for ${command}...` });
      const downloadUrl = await downloadMedia(targetUrl);
      if (!downloadUrl) {
        return `I no fit get download link for that ${command} link now. Make you try again or send another link.`;
      }

      return `Download link for your ${command} video:\n${downloadUrl}`;
    }

    case 'movie': {
      const query = args.join(' ').trim();
      if (!query) {
        return 'Send movie search like: `rest movie Spider-Man`';
      }

      await sendMovieResults(replyJid, query);
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
        next: 'X',
        status: 'playing',
      };
      saveUserData(senderJid, userData);
      return `Tic-Tac-Toe started! Use \`rest move <row> <col>\`, for example \`rest move 1 1\`.

${renderTicTacToeBoard(userData.ticTacToe.board)}`;
    }

    case 'move': {
      const row = parseInt(args[0], 10) - 1;
      const col = parseInt(args[1], 10) - 1;
      if (Number.isNaN(row) || Number.isNaN(col) || row < 0 || row > 2 || col < 0 || col > 2) {
        return 'Send your move like: `rest move 2 3`. Row and column must be 1, 2 or 3.';
      }

      const userData = getUserData(senderJid);
      const game = userData.ticTacToe;
      if (!game || game.status !== 'playing') {
        return 'No active Tic-Tac-Toe game. Start one with `rest tictactoe`.';
      }

      if (game.board[row][col] !== ' ') {
        return 'That position don full. Choose another one.';
      }

      game.board[row][col] = game.next;
      const winner = getTicTacToeWinner(game.board);
      if (winner) {
        game.status = winner === 'draw' ? 'draw' : 'finished';
        saveUserData(senderJid, userData);
        const boardText = renderTicTacToeBoard(game.board);
        if (winner === 'draw') {
          return `The game end draw!\n\n${boardText}`;
        }
        return `Na ${winner} win!\n\n${boardText}`;
      }

      game.next = game.next === 'X' ? 'O' : 'X';
      saveUserData(senderJid, userData);
      return `Move recorded. Next player: ${game.next}\n\n${renderTicTacToeBoard(game.board)}`;
    }

    case 'imagine': {
      const prompt = args.join(' ').trim();
      if (!prompt) {
        return 'Send image prompt like: `rest imagine a cyberpunk Lagos night market`';
      }

      await sock.sendMessage(replyJid, { text: 'I dey generate the image now. Small time.' });
      const imageUrl = await generateImage(prompt);

      if (!imageUrl) {
        return 'Image generation fail. Try another prompt.';
      }

      await sock.sendMessage(replyJid, {
        image: { url: imageUrl },
        caption: `Generated image for: ${prompt}`,
      });
      return null;
    }

    case 'vv':
      return null;

    default:
      return 'I no know that command. Use `rest help`.';
  }
}

function buildHelpMenu() {
  const now = new Date();
  const dateText = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(now);
  const timeText = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(now);

  return [
    '┏❐ *◈ Rest AI ◈*',
    '┃',
    `┃├◆ 👤 Owner: ${BOT_INFO.developer}`,
    `┃├◆ 📅 Date: ${dateText}`,
    `┃├◆ ⏰ Time: ${timeText}`,
    `┃├◆ ⚡ Commands: ${OWNER_COMMANDS.size}+`,
    `┃├◆ 🔑 Prefix: ${BOT_INFO.commandPrefix} / .`,
    '┗❐',
    '',
    '┏❐ 《 *OWNER MENU* 》 ❐',
    '┃├◆ .menu / rest help',
    '┃├◆ .owner',
    '┃├◆ .ping / .alive / .uptime',
    '┃├◆ .pause',
    '┗❐',
    '',
    '┏❐ 《 *AI MENU* 》 ❐',
    '┃├◆ .ai / .gpt [question]',
    '┃├◆ .img [image prompt]',
    '┃├◆ rest [question]',
    '┗❐',
    '',
    '┏❐ 《 *MEDIA MENU* 》 ❐',
    '┃├◆ .vv',
    '┃├◆ .gcstatus / .swgc [text]',
    '┗❐',
    '',
    '┏❐ 《 *MOVIE MENU* 》 ❐',
    '┃├◆ .movie / .sm [title]',
    '┗❐',
    '',
    '┏❐ 《 *GAME MENU* 》 ❐',
    '┃├◆ .game',
    '┃├◆ .tictactoe',
    '┃├◆ .move [row] [col]',
    '┗❐',
    '',
    '┏❐ 《 *DOWNLOAD MENU* 》 ❐',
    '┃├◆ .youtube / .ytmp3 / .ytmp4 / .song / .ytvid [url]',
    '┃├◆ .facebook [url]',
    '┃├◆ .instagram / .igdl [url]',
    '┃├◆ .tiktok / .ttdl [url]',
    '┗❐',
    '',
    '_Powered by Rest AI © 2026_',
  ].join('\n');
}

function handleAskCommandExamples(command) {
  if (command === 'ai' || command === 'ask') {
    return 'Send a question like `.ai who be your developer?`';
  }

  return `Use \`${BOT_INFO.commandPrefix}${command}\``;
}

async function handleOwnerCommand(command, args, replyJid, senderJid) {
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

    case 'status':
      return [
        `*${BOT_INFO.name} Status*`,
        `Paused: ${BOT_STATE.paused ? 'yes' : 'no'}`,
        `Uptime: ${formatUptime()}`,
        `Prefix: ${BOT_INFO.commandPrefix}`,
      ].join('\n');

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

      await sendTrackedMessage(replyJid, { text: `I dey fetch the download link now for ${command}...` });
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

      await sendTrackedMessage(replyJid, { text: 'I dey generate the image now. Small time.' });
      const imageUrl = await generateImage(rawArgs);

      if (!imageUrl) {
        return 'Image generation fail. Try another prompt.';
      }

      await sendTrackedMessage(replyJid, {
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
  await sendTrackedMessage(replyJid, {
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
      currentQR = null; // Clear QR code once connected
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
    const msg = event.messages?.[0];
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

    if (msg.key.fromMe && !isOwnerSelfDm && !ownerCommand) return;

    if (isGroup && !ownerCommand && !shouldReplyInGroup(msg, text)) {
      return;
    }

    const replyJid = remoteJid;

    console.log(`Message from ${senderJid} in ${replyJid}: ${text}`);

    try {
      if (ownerCommand) {
        if (parsedCommand.command === 'help') {
          await sendHelpMenu(replyJid);
          return;
        }

        if (parsedCommand.command === 'gcstatus') {
          if (!isGroup) {
            await sendTrackedMessage(replyJid, { text: 'Group only command.' });
            return;
          }

          const isAdmin = await isGroupAdmin(replyJid, senderJid);
          if (!isAdmin) {
            await sendTrackedMessage(replyJid, { text: 'Admin only command.' });
            return;
          }

          const caption = parsedCommand.args.join(' ').trim();
          const result = await sendGroupStatusMessage(replyJid, msg, caption);
          if (result) {
            await sendTrackedMessage(replyJid, { text: result });
            return;
          }

          await sendTrackedMessage(replyJid, { text: 'Group status sent.' });
          return;
        }

        if (parsedCommand.command === 'vv') {
          const quotedMessage = getQuotedMessage(msg);
          if (!quotedMessage) {
            await sendTrackedMessage(replyJid, { text: 'Reply to a view-once image, video, or audio with `.vv`.' });
            return;
          }

          const media = getQuotedMedia(quotedMessage);
          if (!media) {
            await sendTrackedMessage(replyJid, { text: 'No supported media found in that quoted message.' });
            return;
          }

          await sendTrackedMessage(replyJid, { text: `I dey extract the ${media.kind} now...` });
          const buffer = await downloadQuotedMediaBuffer(media.kind, media.payload);
          const sendPayload = {
            ...media.sendOptions,
            [media.kind]: buffer,
          };
          await sendTrackedMessage(replyJid, sendPayload);
          return;
        }

        if (parsedCommand.command === 'ask') {
          const promptText = parsedCommand.args.join(' ').trim();
          if (!promptText) {
            await sendTrackedMessage(replyJid, { text: handleAskCommandExamples('ask') });
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
          const finalReply = aiReply || 'The AI no answer me just now. Try again small.';

          userData.conversationHistory.push({
            role: 'assistant',
            content: finalReply,
          });
          userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
          userData.firstTime = false;
          saveUserData(senderJid, userData);

          await sendTrackedMessage(replyJid, { text: finalReply });
          await sock.sendPresenceUpdate('available', replyJid);
          return;
        }

        const response = await handleOwnerCommand(parsedCommand.command, parsedCommand.args, replyJid, senderJid);
        if (response) {
          await sendTrackedMessage(replyJid, { text: response });
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
          await sendTrackedMessage(replyJid, {
            text: 'Tell me wetin you want make I generate. Example: generate image of a red Ferrari for Lagos street.',
          });
          await sock.sendPresenceUpdate('available', replyJid);
          return;
        }

        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
          await sendTrackedMessage(replyJid, {
            image: { url: imageUrl },
            caption: `Oya, your image don land.\nPrompt: ${prompt}`,
          });
        } else {
          await sendTrackedMessage(replyJid, {
            text: 'I try generate the image but e no work. Try another prompt small.',
          });
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
        ? `Ahh ${userData.name}, I dey here o. Network or AI waka small, but send your message again make I try.`
        : 'I dey here o, but the AI no answer me just now. Send am again make I try.';

      const finalReply = aiReply || fallbackReply;

      userData.conversationHistory.push({
        role: 'assistant',
        content: finalReply,
      });
      userData.conversationHistory = truncateHistory(userData.conversationHistory, 20);
      userData.firstTime = false;
      saveUserData(senderJid, userData);

      await sendTrackedMessage(replyJid, { text: finalReply });
      await sock.sendPresenceUpdate('available', replyJid);
    } catch (error) {
      console.error('Message handler error:', error.message);
      try {
        await sendTrackedMessage(replyJid, {
          text: 'Something break small for my side. Try again in a bit.',
        });
      } catch (sendError) {
        console.error('Failed to send error message:', sendError.message);
      }
    }
  });
}

console.log(`Starting ${BOT_INFO.name} v${BOT_INFO.version}`);
console.log(`Developer: ${BOT_INFO.developer}`);
console.log(`Bot number: ${CONFIG.botNumber}`);
console.log(`Owner number: ${CONFIG.ownerNumber}`);
console.log(`Command prefix: ${BOT_INFO.commandPrefix}`);
console.log('AI provider: David Cyril Meta AI endpoint');
console.log('Image provider: David Cyril Flux V2 endpoint');

connectToWhatsApp().catch((error) => {
  console.error('Failed to start bot:', error.message);
  process.exit(1);
});
