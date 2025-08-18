// index.js
require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');

// ===== CONFIG =====
const JELLYSEERR_URL = 'http://localhost:5055';
const API_KEY = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// To store ongoing search sessions { userId: { results: [], type: 'movie'|'tv' } }
let pendingSelections = {};

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true }
});

// Show QR in terminal
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
    console.log('Scan this QR with your WhatsApp');
});

client.on('ready', () => {
    console.log('✅ WhatsApp bot is ready!');
});

// Main message handler
client.on('message', async msg => {
    const chat = await msg.getChat();
    if (chat.isGroup) return;

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

            try {
                await requestMedia(mediaId, mediaType, item);
                await msg.reply(`✅ "${item.title || item.name}" has been requested successfully!`);
            } catch (err) {
                await msg.reply(`❌ Failed to request "${item.title || item.name}".`);
                console.error(err.response?.data || err);
            }

            delete pendingSelections[senderId];
        } else {
            await msg.reply(`⚠️ Invalid selection. Please enter a number from the list.`);
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
            await msg.reply(`⚠️ Please provide a search term. Example:\n!request movie ironman`);
            return;
        }

        try {
            let results = await searchJellyseerr(searchTerm.trim(), type);
            if (results.length === 0) {
                await msg.reply(`No ${type === 'movie' ? 'movies' : 'series'} found for "${searchTerm}"`);
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
            responseText += `Reply with the number (1-${results.length}) to request.`;

            await msg.reply(responseText);
        } catch (err) {
            console.error(err.response?.data || err);
            await msg.reply(`❌ Error searching Jellyseerr.`);
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

async function requestMedia(mediaId, type, item) {
    const url = `${JELLYSEERR_URL}/api/v1/request`;

    let payload = { mediaType: type, mediaId: mediaId };

    // If TV series, request all seasons
    if (type === 'tv' && item?.mediaInfo?.seasons) {
        payload.seasons = item.mediaInfo.seasons.map(s => s.seasonNumber).filter(n => n > 0); // skip specials
    }

    await axios.post(url, payload, { headers: { 'X-Api-Key': API_KEY } });
}

// Start bot
client.initialize();
