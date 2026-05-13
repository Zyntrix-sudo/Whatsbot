const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const https = require('https');

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
  geminiApi: 'https://apis.davidcyril.name.ng/ai/gemini',
  fluxApi: 'https://apis.davidcyril.name.ng/fluxv2',
};

const BOT_INFO = {
  name: 'Rest AI',
  developer: 'Emmanuel Restoration Abimbola',
  version: '1.0.0',
  commandPrefix: 'rest',
};

const OWNER_COMMANDS = new Set([
  'help',
  'ping',
  'alive',
  'uptime',
  'pause',
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
]);

const BOT_STATE = {
  paused: false,
  startTime: Date.now(),
};

const BOT_PHONE = CONFIG.botNumber.replace('@s.whatsapp.net', '');

let sock;

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

function isCommand(text) {
  const value = text.trim().toLowerCase();
  return value === BOT_INFO.commandPrefix || value.startsWith(`${BOT_INFO.commandPrefix} `);
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

function parseCommand(text) {
  const cleanText = stripOwnerPrefix(text).toLowerCase();
  const words = cleanText.split(/\s+/).filter(Boolean);
  if (!words.length) return { command: null, args: [] };

  let args = [...words];
  if (args[0] === 'run') {
    args.shift();
  }

  // Direct commands
  const direct = args[0];
  if (
    [
      'help',
      'ping',
      'alive',
      'uptime',
      'pause',
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
    ].includes(direct)
  ) {
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

function stripOwnerPrefix(text) {
  const value = text.trim();
  if (!/^rest\b/i.test(value)) {
    return value;
  }

  return value.replace(/^rest\b\s*/i, '').trim();
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
    const response = await fetchJson(CONFIG.geminiApi, {
      prompt: prompt,
      model: 'gemini-pro',
    });

    return normalizeAiReply(response);
  } catch (error) {
    console.error('AI API error:', error.message);
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
    await sock.sendMessage(replyJid, { text: `No movie results found for "${query}". Try another title.` });
    return;
  }

  const listMessage = buildMovieListMessage(query, movies);
  await sock.sendMessage(replyJid, listMessage);
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
      return [
        `*${BOT_INFO.name} Help Menu*`,
        '',
        'You fit also talk naturally like: `rest execute my help menu`, `rest lets play tic tac toe`, `rest download this vid`, or `rest hi`.',
        '`rest help` - show this menu',
        '`rest ping` - check my speed',
        '`rest alive` - confirm I am online',
        '`rest uptime` - show uptime',
        '`rest pause` - pause or resume replies',
        '`rest imagine <prompt>` - generate an image',
        '`rest youtube <url>` - YouTube downloader',
        '`rest facebook <url>` - Facebook downloader',
        '`rest instagram <url>` - Instagram downloader',
        '`rest tiktok <url>` - TikTok downloader',
        '`rest movie <title>` - search movies',
        '`rest tictactoe` - start tic-tac-toe',
        '`rest move <row> <col>` - make a tic-tac-toe move',
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

    default:
      return 'I no know that command. Use `rest help`.';
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

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n🔗 Scan this QR code with WhatsApp on your phone:\n');
      qrcode.generate(qr, { small: true });
      console.log('\n📱 Make sure to scan the QR code within 60 seconds!\n');
    }

    if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }

    if (connection === 'open') {
      console.log('✅ Successfully connected to WhatsApp!');
      console.log('🤖 Rest AI Bot is now online and ready to receive messages.');
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
    const parsedOwnerCommand = isCommand(text) ? parseCommand(text) : { command: null, args: [] };
    const ownerCommand =
      isOwner(senderJid) &&
      parsedOwnerCommand.command &&
      OWNER_COMMANDS.has(parsedOwnerCommand.command);

    if (!remoteJid || !text) return;
    if (remoteJid === 'status@broadcast') return;
    if (msg.key.fromMe && !ownerCommand) return;

    if (isGroup && !ownerCommand && !shouldReplyInGroup(msg, text)) {
      return;
    }

    const replyJid = remoteJid;

    console.log(`Message from ${senderJid} in ${replyJid}: ${text}`);

    try {
      if (isCommand(text)) {
        if (!isOwner(senderJid)) {
          return;
        }

        if (ownerCommand) {
          const response = await handleOwnerCommand(parsedOwnerCommand.command, parsedOwnerCommand.args, replyJid, senderJid);
          if (response) {
            await sock.sendMessage(replyJid, { text: response });
          }
          return;
        }
      }

      if (BOT_STATE.paused && !isOwner(senderJid)) {
        return;
      }

      const userData = getUserData(senderJid);
      const aiInputText = isOwner(senderJid) ? stripOwnerPrefix(text) || text : text;

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
          await sock.sendMessage(replyJid, {
            text: 'Tell me wetin you want make I generate. Example: generate image of a red Ferrari for Lagos street.',
          });
          await sock.sendPresenceUpdate('available', replyJid);
          return;
        }

        const imageUrl = await generateImage(prompt);
        if (imageUrl) {
          await sock.sendMessage(replyJid, {
            image: { url: imageUrl },
            caption: `Oya, your image don land.\nPrompt: ${prompt}`,
          });
        } else {
          await sock.sendMessage(replyJid, {
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

      await sock.sendMessage(replyJid, { text: finalReply });
      await sock.sendPresenceUpdate('available', replyJid);
    } catch (error) {
      console.error('Message handler error:', error.message);
      try {
        await sock.sendMessage(replyJid, {
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
console.log('AI provider: David Cyril Gemini endpoint');
console.log('Image provider: David Cyril Flux V2 endpoint');

connectToWhatsApp().catch((error) => {
  console.error('Failed to start bot:', error.message);
  process.exit(1);
});
