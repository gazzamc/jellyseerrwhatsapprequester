require('dotenv').config();

// ===== CONFIG =====
const JELLYSEERR_URL = process.env.JELLYSEERR_URL || 'http://localhost:5055';
const API_KEY = process.env.API_KEY || 'YOUR_API_KEY_HERE';
const CHATS = process.env.CHAT_WHITELIST?.split(',') || ['change', 'me']
const SESSION_PATH = process.env.CUSTOM_SESSION_PATH || 'session'; // When empty string, Defaults to .wwebjs_auth folder in root of app
const ENABLE_EVENT_MESSAGES = process.env.ENABLE_EVENT_MESSAGES ? true : false // Disable Ready message here (non docker)
const CHAT_WHITELIST = CHATS.map(chat => chat.toLowerCase());

module.exports = {
    JELLYSEERR_URL,
    API_KEY,
    SESSION_PATH,
    ENABLE_EVENT_MESSAGES,
    CHAT_WHITELIST,
};