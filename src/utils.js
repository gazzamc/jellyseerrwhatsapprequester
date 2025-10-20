const axios = require('axios');
const { JELLYSEERR_URL, API_KEY } = require('./config');

function processCustomMessage(message, args) {
  // If not in docker return undefined
  if (!messages) {
    return undefined;
  }

  if (typeof messages()[message] === 'function') {
    const callback = messages()[message];
    return callback(...args);
  } else {
    return messages()[message];
  }
}

async function requestMedia(mediaId, type, item, msg, responseText) {
  try {
    const url = `${JELLYSEERR_URL}/api/v1/request`;
    let payload = { mediaType: type, mediaId: mediaId };

    // If TV series, request all seasons
    if (type === 'tv' && item?.mediaInfo?.seasons) {
      payload.seasons = item.mediaInfo.seasons
        .map((s) => s.seasonNumber)
        .filter((n) => n > 0); // skip specials
    }

    const req = await axios.post(url, payload, {
      headers: { 'X-Api-Key': API_KEY },
    });

    // Log successful requests
    if (req.status === 201) {
      console.log(`Request for ${item.title}, successful.`);
    }

    await msg.reply(
      processCustomMessage('REQ_SUCCESS', [item, responseText]) ||
        `✅ "${item.title || item.name}" has been requested successfully!`,
    );
  } catch (err) {
    await msg.reply(
      processCustomMessage('REQ_FAIL', [item]) ||
        `❌ Failed to request "${item.title || item.name}".`,
    );
    console.error(err);
  }
}

async function isRequested(mediaId, msg) {
  const url = `${JELLYSEERR_URL}/api/v1/request`;
  try {
    const req = await axios.get(url, { headers: { 'X-Api-Key': API_KEY } });
    for (let i = 0; i < req.data.results.length; i++) {
      const item = req.data.results[i];
      const mediaInfo = item.media;
      if (
        mediaInfo.tvdbId === mediaId ||
        mediaInfo.tmdbId === mediaId ||
        mediaInfo.imdbId === mediaId
      ) {
        return true;
      }
    }
  } catch (err) {
    console.error(err.response?.data || err);
    await msg.reply(
      processCustomMessage('JELLYSEERR_FAIL', [err]) ||
        `❌ Error searching Jellyseerr.`,
    );
  }

  return false;
}

async function searchJellyseerr(query, type) {
  const url = `${JELLYSEERR_URL}/api/v1/search?query=${encodeURIComponent(query)}&page=1`;
  const res = await axios.get(url, { headers: { 'X-Api-Key': API_KEY } });
  let results = res.data.results.filter((r) => r.mediaType === type);

  // Fetch more details for cast + external IDs
  for (let item of results) {
    try {
      const detailsUrl = `${JELLYSEERR_URL}/api/v1/${type}/${item.id}`;
      const detailsRes = await axios.get(detailsUrl, {
        headers: { 'X-Api-Key': API_KEY },
      });
      item.mediaInfo = detailsRes.data;
      item.imdbId = detailsRes.data.externalIds?.imdbId;
      item.tvdbId = detailsRes.data.externalIds?.tvdbId;
    } catch {}
  }
  return results;
}

function buildResponse(results, type, searchTerm) {
  let responseText = `🔍 Found ${results.length} ${type === 'movie' ? 'movie(s)' : 'serie(s)'} for "${searchTerm}":\n\n`;
  results.forEach((item, idx) => {
    let year = item.releaseDate
      ? item.releaseDate.split('-')[0]
      : item.firstAirDate
        ? item.firstAirDate.split('-')[0]
        : 'N/A';
    let cast =
      item.mediaInfo?.credits?.cast
        ?.slice(0, 3)
        .map((c) => c.name)
        .join(', ') || 'Unknown cast';
    let overview = item.overview
      ? item.overview.length > 100
        ? item.overview.slice(0, 100) + '...'
        : item.overview
      : 'No description';

    // Links
    let imdbLink = item.imdbId
      ? `https://www.imdb.com/title/${item.imdbId}/`
      : '';
    let tvdbLink = item.tvdbId ? `https://thetvdb.com/?id=${item.tvdbId}` : '';
    let linkText = imdbLink || tvdbLink ? `🔗 ${imdbLink || tvdbLink}` : '';

    responseText += `${idx + 1}. *${item.title || item.name}* (${year})\n   🎭 ${cast}\n   📜 ${overview}\n   ${linkText}\n\n`;
  });

  // No choice needed if only one item
  if (results.length > 1) {
    responseText +=
      processCustomMessage('REQ_CHOICE', [results]) ||
      `Reply with the number (1-${results.length}) to request.`;
  }

  return responseText;
}

module.exports = {
  processCustomMessage,
  requestMedia,
  searchJellyseerr,
  isRequested,
  buildResponse,
};
