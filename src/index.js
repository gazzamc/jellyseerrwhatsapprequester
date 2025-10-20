const { Client, LocalAuth } = require('whatsapp-web.js');
const {
  SESSION_PATH,
  ENABLE_EVENT_MESSAGES,
  CHAT_WHITELIST,
} = require('./config');
const {
  requestMedia,
  isRequested,
  searchJellyseerr,
  processCustomMessage,
  buildResponse,
} = require('./utils');
const qrcode = require('qrcode-terminal');

const fs = require('fs');

let messages;
if (fs.existsSync('./config/custom_bot_messages.js')) {
  messages = require('./config/custom_bot_messages.js');
}

const usage =
  '🤖 *Beep Boop Beep...*\n\n' +
  '*Commands:*\n\n' +
  '*!request | !r* : _Initiate a request_\n\n' +
  "*keywords:*\n\t*movie* (default): _Request a movie, e.g. !r movie Big Momma's House_\n\t*series*: _Request a series (all seasons), e.g. !r series My Wife and Kids_\n\n" +
  '_If there is more than 1 result, you will be given a choice. Respond with a valid number to finish the request._\n\n';

// To store ongoing search sessions { userId: { results: [], type: 'movie'|'tv' } }
let pendingSelections = {};

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: SESSION_PATH,
  }),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  },
});

// Show QR in terminal
client.on('qr', async (qr) => {
  qrcode.generate(qr, { small: true });
  console.log('Scan this QR with your WhatsApp');
});

client.on('authenticated', async () => {
  console.log('✅ WhatsApp bot successfully authenticated!');
});

client.on('disconnected', async (reason) => {
  // If logged out or session expired
  console.log(reason);
});

client.on('ready', async () => {
  console.log('✅ WhatsApp bot is ready!');
  // Send out a message to all whitlisted chats that bot is ready.
  if (ENABLE_EVENT_MESSAGES) {
    const chats = await client.getChats();
    for (let i = 0; i < chats.length; i++) {
      if (CHAT_WHITELIST.includes(chats[i].name.toLowerCase())) {
        chats[i].sendMessage(
          processCustomMessage('BOT_READY', [usage]) || 'Bot Ready',
        );
      }
    }
  }
});

// Main message handler
client.on('message', async (msg) => {
  const chat = await msg.getChat();
  if (!CHAT_WHITELIST.includes(chat.name.toLowerCase())) {
    return;
  }

  const senderId = msg.from;
  const text = msg.body.trim();

  // Handle pending selection
  if (pendingSelections[senderId] && /^[0-9]+$/.test(text)) {
    let selectionIndex = parseInt(text) - 1;
    let session = pendingSelections[senderId];

    if (selectionIndex >= 0 && selectionIndex < session.results.length) {
      let item = session.results[selectionIndex];
      let mediaType = session.type;
      let mediaId = item.id;

      if (await isRequested(mediaId, msg)) {
        const response = `"${item.title || item.name}" has already been requested!`;
        await msg.reply(response);
      } else {
        await requestMedia(mediaId, mediaType, item, msg);
      }

      delete pendingSelections[senderId];
    } else {
      await msg.reply(
        processCustomMessage('INVALID_SEL') ||
          `⚠️ Invalid selection. Please enter a number from the list.`,
      );
    }
    return;
  }

  // Command parsing
  if (
    text.toLowerCase().startsWith('!request') ||
    text.toLowerCase().startsWith('!r')
  ) {
    let isDefault = true;
    let type = 'movie'; // default
    let searchTerm = text.toLowerCase().startsWith('!request')
      ? text.replace(/^!request\s*/i, '')
      : text.replace(/^!r\s*/i, '');

    if (searchTerm.toLowerCase().startsWith('movie ')) {
      isDefault = false;
      type = 'movie';
      searchTerm = searchTerm.slice(6);
    } else if (searchTerm.toLowerCase().startsWith('series ')) {
      isDefault = false;
      type = 'tv';
      searchTerm = searchTerm.slice(7);
    }

    if (!searchTerm.trim()) {
      await msg.reply(
        processCustomMessage('NO_TERM') ||
          `⚠️ Please provide a search term. Example:\n!request movie ironman`,
      );
      return;
    }

    try {
      let results = await searchJellyseerr(searchTerm.trim(), type);
      if (results.length === 0) {
        const response = isDefault
          ? `No type provided, used movie (default) and found nothing for "${searchTerm}"`
          : `No ${type === 'movie' ? 'movies' : 'series'} found for "${searchTerm}"`;
        await msg.reply(
          processCustomMessage('REQ_NO_ITEM', [type, searchTerm, isDefault]) ||
            response,
        );
        return;
      }

      // Auto choose if only one item
      if (results.length === 1) {
        let item = results[0];
        let mediaId = item.id;
        let mediaType = type;
        if (await isRequested(mediaId, msg)) {
          const response = `"${item.title || item.name}" has already been requested!`;
          await msg.reply(response);
        } else {
          const responseText = buildResponse(results, type, searchTerm);
          await requestMedia(mediaId, mediaType, item, msg, responseText);
        }
        return;
      }

      // Save session
      pendingSelections[senderId] = { results, type };

      // Build response with IMDb/TVDB links
      const responseText = buildResponse(results, type, searchTerm);

      await msg.reply(responseText);
    } catch (err) {
      console.error(err.response?.data || err);
      await msg.reply(
        processCustomMessage('JELLYSEERR_FAIL', [err]) ||
          `❌ Error searching Jellyseerr.`,
      );
    }
  }

  // Add help command
  if (
    text.toLowerCase().startsWith('!help') ||
    text.toLowerCase().startsWith('!h')
  ) {
    await msg.reply(processCustomMessage('BOT_USAGE') || usage);
  }
});

// Start bot
client.initialize();

module.exports.pendingSelections = pendingSelections; //Export for testing
