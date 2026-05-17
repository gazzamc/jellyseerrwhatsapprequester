require('dotenv').config();
const path = require('path');

// ===== CONFIG =====
const JELLYSEERR_URL = process.env.JELLYSEERR_URL || 'http://localhost:5055';
const API_KEY = process.env.API_KEY || 'YOUR_API_KEY_HERE';
const CHATS = process.env.CHAT_WHITELIST?.split(',') || ['change', 'me'];
const SESSION_PATH = process.env.CUSTOM_SESSION_PATH || 'session'; // When empty string, Defaults to .wwebjs_auth folder in root of app
const ENABLE_EVENT_MESSAGES = process.env.ENABLE_EVENT_MESSAGES === 'true'; // Disable Ready message here (non docker)
const CHAT_WHITELIST = CHATS.map((chat) => chat.toLowerCase());
const PHONE_NUMBER = process.env.PHONE_NUMBER || 0;
const CUSTOM_MESSAGE_PATH = path.resolve(
  __dirname,
  '../config/custom_bot_messages.js',
);

if (!API_KEY || API_KEY === 'YOUR_API_KEY_HERE') {
  throw new Error(
    'API_KEY environment variable is not set or is using the placeholder value.',
  );
}

module.exports = {
  JELLYSEERR_URL,
  API_KEY,
  SESSION_PATH,
  ENABLE_EVENT_MESSAGES,
  CHAT_WHITELIST,
  CUSTOM_MESSAGE_PATH,
  PHONE_NUMBER,
};
