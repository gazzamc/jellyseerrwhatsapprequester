// index.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const fs = require("fs");

let messages;
if (fs.existsSync('./config/custom_bot_messages.js')) {
    messages = require('./config/custom_bot_messages.js')
}


// ===== CONFIG =====
const JELLYSEERR_URL = process.env.JELLYSEERR_URL || 'http://localhost:5055';
const API_KEY = process.env.API_KEY || 'YOUR_API_KEY_HERE';
const CHATS = process.env.CHAT_WHITELIST?.split(',') || ['change', 'me']
const SESSION_PATH = process.env.CUSTOM_SESSION_PATH || 'session'; // When empty string, Defaults to .wwebjs_auth folder in root of app
const ENABLE_EVENT_MESSAGES = process.env.ENABLE_EVENT_MESSAGES ? process.env.ENABLE_EVENT_MESSAGES : true // Disable Ready message here (non docker)
const CHAT_WHITELIST = CHATS.map(chat => chat.toLowerCase());

// To store ongoing search sessions { userId: { results: [], type: 'movie'|'tv' } }
let pendingSelections = {};

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: SESSION_PATH
    }),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    }
});

// Show QR in terminal
client.on('qr', async qr => {
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
        const chats = await client.getChats()
        for (let i = 0; i < chats.length; i++) {
            if (CHAT_WHITELIST.includes(chats[i].name.toLowerCase())) {
                chats[i].sendMessage(processCustomMessage('BOT_READY') || 'Bot Ready')
            }
        }
    }
});

// Main message handler
client.on('message_create', async msg => {
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
                try {
                    await requestMedia(mediaId, mediaType, item);
                    await msg.reply(processCustomMessage('REQ_SUCCESS', [item]) || `✅ "${item.title || item.name}" has been requested successfully!`);
                } catch (err) {
                    await msg.reply(processCustomMessage('REQ_FAIL', [item]) || `❌ Failed to request "${item.title || item.name}".`);
                    console.error(err.response?.data || err);
                }
            }

            delete pendingSelections[senderId];
        } else {
            await msg.reply(processCustomMessage('INVALID_SEL', [item]) || `⚠️ Invalid selection. Please enter a number from the list.`);
        }
        return;
    }

    // Command parsing
    if (text.toLowerCase().startsWith('!request')) {
        let type = 'movie'; // default
        let searchTerm = text.replace(/^!request\s*/i, '');

        if (searchTerm.toLowerCase().startsWith('movie ')) {
            type = 'movie';
            searchTerm = searchTerm.slice(6);
        } else if (searchTerm.toLowerCase().startsWith('series ')) {
            type = 'tv';
            searchTerm = searchTerm.slice(7);
        }

        if (!searchTerm.trim()) {
            await msg.reply(processCustomMessage('NO_TERM', [item]) || `⚠️ Please provide a search term. Example:\n!request movie ironman`);
            return;
        }

        try {
            let results = await searchJellyseerr(searchTerm.trim(), type);
            if (results.length === 0) {
                await msg.reply(processCustomMessage('REQ_NO_ITEM', [type, searchTerm]) || `No ${type === 'movie' ? 'movies' : 'series'} found for "${searchTerm}"`);
                return;
            }

            // Save session
            pendingSelections[senderId] = { results, type };

            // Build response with IMDb/TVDB links
            let responseText = `🔍 Found ${results.length} ${type === 'movie' ? 'movies' : 'series'} for "${searchTerm}":\n\n`;
            results.forEach((item, idx) => {
                let year = item.releaseDate ? item.releaseDate.split('-')[0] : (item.firstAirDate ? item.firstAirDate.split('-')[0] : 'N/A');
                let cast = item.mediaInfo?.credits?.cast?.slice(0, 3).map(c => c.name).join(', ') || 'Unknown cast';
                let overview = item.overview ? (item.overview.length > 100 ? item.overview.slice(0, 100) + '...' : item.overview) : 'No description';

                // Links
                let imdbLink = item.imdbId ? `https://www.imdb.com/title/${item.imdbId}/` : '';
                let tvdbLink = item.tvdbId ? `https://thetvdb.com/?id=${item.tvdbId}` : '';
                let linkText = imdbLink || tvdbLink ? `🔗 ${imdbLink || tvdbLink}` : '';

                responseText += `${idx + 1}. *${item.title || item.name}* (${year})\n   🎭 ${cast}\n   📜 ${overview}\n   ${linkText}\n\n`;
            });
            responseText += processCustomMessage('REQ_CHOICE', [results]) || `Reply with the number (1-${results.length}) to request.`;

            await msg.reply(responseText);
        } catch (err) {
            console.error(err.response?.data || err);
            await msg.reply(processCustomMessage('JELLYSEERR_FAIL', [err]) || `❌ Error searching Jellyseerr.`);
        }
    }
});

// ===== FUNCTIONS =====
async function searchJellyseerr(query, type) {
    const url = `${JELLYSEERR_URL}/api/v1/search?query=${encodeURIComponent(query)}&page=1`;
    const res = await axios.get(url, { headers: { 'X-Api-Key': API_KEY } });
    let results = res.data.results.filter(r => r.mediaType === type);

    // Fetch more details for cast + external IDs
    for (let item of results) {
        try {
            const detailsUrl = `${JELLYSEERR_URL}/api/v1/${type}/${item.id}`;
            const detailsRes = await axios.get(detailsUrl, { headers: { 'X-Api-Key': API_KEY } });
            item.mediaInfo = detailsRes.data;
            item.imdbId = detailsRes.data.externalIds?.imdbId;
            item.tvdbId = detailsRes.data.externalIds?.tvdbId;
        } catch {}
    }
    return results;
}

async function isRequested(mediaId, msg) {
    const url = `${JELLYSEERR_URL}/api/v1/request`;
    try {
        const req = await axios.get(url, { headers: { 'X-Api-Key': API_KEY } });
        for (let i = 0; i < req.data.results.length; i++) {
            const item = req.data.results[i];
            const mediaInfo = item.media;
            if (mediaInfo.tvdbId === mediaId || mediaInfo.tmdbId === mediaId || mediaInfo.imdbId === mediaId) {
                return true;
            }
        }
    } catch (err) {
        console.error(err.response?.data || err);
        await msg.reply(processCustomMessage('JELLYSEERR_FAIL', [err]) || `❌ Error searching Jellyseerr.`);
    }

    return false;
}

async function requestMedia(mediaId, type, item) {
    const url = `${JELLYSEERR_URL}/api/v1/request`;

    let payload = { mediaType: type, mediaId: mediaId };

    // If TV series, request all seasons
    if (type === 'tv' && item?.mediaInfo?.seasons) {
        payload.seasons = item.mediaInfo.seasons.map(s => s.seasonNumber).filter(n => n > 0); // skip specials
    }

    const req = await axios.post(url, payload, { headers: { 'X-Api-Key': API_KEY } });

    // Log successful requests
    if (req.status === 201) {
        console.log(`Request for ${item.title}, successful.`)
    }
}

function processCustomMessage(message, args) {
    // If not in docker return undefined
    if (!messages) {
        return undefined
    }

    if (typeof messages()[message] === 'function') {
        const callback = messages()[message];
        return callback(...args)
    } else {
        return messages()[message]
    }
}

// Start bot
client.initialize();
