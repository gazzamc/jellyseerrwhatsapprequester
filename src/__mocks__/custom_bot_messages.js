// __mocks__/custom_bot_messages.js

/**
 * This mock simulates the real custom_bot_messages.js file.
 * In production, your real file likely exports a function that returns
 * an object mapping message keys to strings or functions.
 *
 * Here we just return predictable mock values for testing.
 */

module.exports = () => ({
  REQ_SUCCESS: (item) => `Mock success for ${item?.title || item}`,
  REQ_FAIL: (item) => `Mock failure for ${item?.title || item}`,
  JELLYSEERR_FAIL: (err) => `Mock Jellyseerr error: ${err.message || err}`,
  REQ_CHOICE: (results) => `Mock choice message (${results.length} results)`,
});
