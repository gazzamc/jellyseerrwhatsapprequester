// Mocks
jest.mock('axios');
jest.mock('./config', () => ({
  JELLYSEERR_URL: 'http://fake-jelly',
  API_KEY: 'FAKE_KEY',
}));

const axios = require('axios');
const {
  processCustomMessage,
  requestMedia,
  isRequested,
  searchJellyseerr,
  buildResponse,
} = require('./utils');

// Simulate global `messages` object (used inside processCustomMessage)
global.messages = null;

describe('media utility functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processCustomMessage', () => {
    afterEach(() => {
      global.messages = null;
    });

    test('returns undefined if messages not defined', () => {
      global.messages = null;
      const result = processCustomMessage('REQ_SUCCESS', []);
      expect(result).toBeUndefined();
    });

    test('returns string message if key exists', () => {
      global.messages = () => ({ REQ_SUCCESS: 'Success message' });
      const result = processCustomMessage('REQ_SUCCESS', []);
      expect(result).toBe('Success message');
    });

    test('executes function if message is a function', () => {
      global.messages = () => ({
        REQ_SUCCESS: jest.fn((item) => `Success for ${item}`),
      });
      const result = processCustomMessage('REQ_SUCCESS', ['Inception']);
      expect(result).toBe('Success for Inception');
    });
  });

  describe('buildResponse', () => {
    test('builds formatted text with IMDb link and cast', () => {
      const results = [
        {
          title: 'Inception',
          releaseDate: '2010-07-16',
          mediaInfo: {
            credits: { cast: [{ name: 'Leonardo' }, { name: 'Joseph' }] },
          },
          overview: 'A dream within a dream',
          imdbId: 'tt1375666',
        },
      ];

      const response = buildResponse(results, 'movie', 'inception');
      expect(response).toMatch(/Inception/);
      expect(response).toMatch(/Leonardo, Joseph/);
      expect(response).toMatch(/imdb\.com/);
      expect(response).not.toMatch(/Reply with the number/);
    });

    test('adds reply instruction when multiple results', () => {
      const results = [
        { title: 'Movie A', releaseDate: '2000', mediaInfo: {}, overview: 'A' },
        { title: 'Movie B', releaseDate: '2001', mediaInfo: {}, overview: 'B' },
      ];
      const response = buildResponse(results, 'movie', 'test');
      expect(response).toMatch(/Reply with the number/);
    });
  });

  describe('searchJellyseerr', () => {
    test('filters by type and enriches results', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: {
            results: [
              { id: 1, mediaType: 'movie' },
              { id: 2, mediaType: 'tv' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            externalIds: { imdbId: 'tt123', tvdbId: 'tv123' },
            credits: { cast: [{ name: 'Actor' }] },
          },
        });

      const results = await searchJellyseerr('query', 'movie');
      expect(results).toHaveLength(1);
      expect(results[0].imdbId).toBe('tt123');
      expect(axios.get).toHaveBeenCalledTimes(2);
    });

    test('handles detail fetch errors silently', async () => {
      axios.get
        .mockResolvedValueOnce({
          data: { results: [{ id: 1, mediaType: 'movie' }] },
        })
        .mockRejectedValueOnce(new Error('details fail'));

      const results = await searchJellyseerr('query', 'movie');
      expect(results).toHaveLength(1);
    });
  });

  describe('isRequested', () => {
    const msg = { reply: jest.fn() };

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error
    });

    afterEach(() => {
      console.error.mockRestore();
    });

    test('returns true when match found', async () => {
      axios.get.mockResolvedValueOnce({
        data: { results: [{ media: { tmdbId: 100 } }] },
      });

      const result = await isRequested(100, msg);
      expect(result).toBe(true);
    });

    test('returns false when no match found', async () => {
      axios.get.mockResolvedValueOnce({
        data: { results: [{ media: { tmdbId: 999 } }] },
      });

      const result = await isRequested(123, msg);
      expect(result).toBe(false);
    });

    test('handles API errors gracefully', async () => {
      axios.get.mockRejectedValueOnce(new Error('API down'));

      await isRequested(1, msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/Error/));
    });
  });

  describe('requestMedia', () => {
    const msg = { reply: jest.fn() };

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error
    });

    afterEach(() => {
      console.error.mockRestore();
    });

    test('sends POST request for movie and replies success', async () => {
      axios.post.mockResolvedValueOnce({ status: 201 });
      const item = { title: 'Inception' };

      await requestMedia(1, 'movie', item, msg, 'text');
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/request'),
        expect.objectContaining({ mediaId: 1, mediaType: 'movie' }),
        expect.any(Object),
      );
      expect(msg.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Inception/),
      );
    });

    test('includes seasons for TV type', async () => {
      axios.post.mockResolvedValueOnce({ status: 201 });
      const item = {
        title: 'Show',
        mediaInfo: { seasons: [{ seasonNumber: 0 }, { seasonNumber: 1 }] },
      };

      await requestMedia(42, 'tv', item, msg);
      const payload = axios.post.mock.calls[0][1];
      expect(payload.seasons).toEqual([1]); // skip special
    });

    test('handles POST failure and replies error', async () => {
      axios.post.mockRejectedValueOnce(new Error('fail'));
      const item = { title: 'BadMovie' };
      await requestMedia(1, 'movie', item, msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/Failed/));
    });
  });
});
