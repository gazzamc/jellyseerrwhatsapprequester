jest.mock('whatsapp-web.js', () => {
  const mockOn = jest.fn();
  const mockInitialize = jest.fn();
  const mockGetChats = jest.fn();

  function MockClient() {
    this.on = mockOn;
    this.initialize = mockInitialize;
    this.getChats = mockGetChats;
  }

  return {
    Client: jest.fn().mockImplementation(() => new MockClient()),
    LocalAuth: jest.fn().mockImplementation(() => ({})),
  };
});

jest.mock('qrcode-terminal', () => ({
  generate: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn()
}));

// Mock config
jest.mock('./config', () => ({
  SESSION_PATH: 'fakeSession',
  ENABLE_EVENT_MESSAGES: true,
  CHAT_WHITELIST: ['allowedchat'],
}));

// Mock helper functions (used internally by message handler)
jest.mock('./utils', () => ({
  isRequested: jest.fn(),
  requestMedia: jest.fn(),
  searchJellyseerr: jest.fn(),
  buildResponse: jest.fn(() => 'Mock Response'),
  processCustomMessage: jest.fn().mockReturnValue(undefined), // Return undefined to disable custom messages
}));

const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { pendingSelections } = require('./index');
const fs = require('fs');
const {
  isRequested,
  requestMedia,
  searchJellyseerr,
  processCustomMessage,
  buildResponse
} = require('./utils');

describe('WhatsApp bot', () => {
  let mockClient;

  beforeAll(() => {
    require('./index'); // ensures fresh initialization for test suite
  });

  beforeEach(() => {
    mockClient = Client.mock.results[0]?.value;
  });

  test('initializes WhatsApp client', () => {
    expect(Client).toHaveBeenCalledTimes(1);
    expect(mockClient.initialize).toHaveBeenCalled();
  });

  test('handles QR event and generates code', () => {
    const handler = mockClient.on.mock.calls.find(c => c[0] === 'qr')[1];
    handler('FAKE_QR');
    expect(qrcode.generate).toHaveBeenCalledWith('FAKE_QR', { small: true });
  });

  test('handles authenticated event', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const handler = mockClient.on.mock.calls.find(c => c[0] === 'authenticated')[1];
    handler();
    expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/authenticated/i));
    logSpy.mockRestore();
  });

  test('handles disconnected event', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const handler = mockClient.on.mock.calls.find(c => c[0] === 'disconnected')[1];
    handler('session expired');
    expect(logSpy).toHaveBeenCalledWith('session expired');
    logSpy.mockRestore();
  });

  describe('ready event', () => {
    test('sends ready message to whitelisted chats', async () => {
      const fakeChat = {
        name: 'allowedchat',
        sendMessage: jest.fn(),
      };
      mockClient.getChats.mockResolvedValueOnce([fakeChat]);
      const handler = mockClient.on.mock.calls.find(c => c[0] === 'ready')[1];
      await handler();
      expect(fakeChat.sendMessage).toHaveBeenCalledWith('Bot Ready');
    });

    test('skips sending to non-whitelisted chats', async () => {
      const fakeChat = {
        name: 'unlisted',
        sendMessage: jest.fn(),
      };
      mockClient.getChats.mockResolvedValueOnce([fakeChat]);
      const handler = mockClient.on.mock.calls.find(c => c[0] === 'ready')[1];
      await handler();
      expect(fakeChat.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('message event', () => {
    let handler;
    let msg;

    beforeEach(() => {
      jest.spyOn(console, 'error').mockImplementation(() => {}); // suppress console.error
      
      handler = mockClient.on.mock.calls.find(c => c[0] === 'message')[1];
      msg = {
        from: 'user123',
        body: '!r movie inception',
        getChat: jest.fn().mockResolvedValue({ name: 'allowedchat' }),
        reply: jest.fn(),
      };
    });

    test('ignores messages from non-whitelisted chats', async () => {
      msg.getChat.mockResolvedValueOnce({ name: 'notallowed' });
      await handler(msg);
      expect(msg.reply).not.toHaveBeenCalled();
    });

    test('handles !help command', async () => {
      msg.body = '!help';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/Beep Boop/i));
    });

    test('handles no search term', async () => {
      msg.body = '!r';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Please provide a search term/i)
      );
    });

    test('handles no results found when type NOT provided', async () => {
      searchJellyseerr.mockResolvedValueOnce([]);
      msg.body = '!r movie nothing';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/No movies found/i));
    });

    test('handles no results found when type provided', async () => {
      searchJellyseerr.mockResolvedValueOnce([]);
      msg.body = '!r nothing';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/No type provided/i));
    });

    test('handles single result already requested', async () => {
      searchJellyseerr.mockResolvedValueOnce([{ id: 1, title: 'Film' }]);
      isRequested.mockResolvedValueOnce(true);
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/already been requested/i));
    });

    test('handles single new result and requests media', async () => {
      searchJellyseerr.mockResolvedValueOnce([{ id: 1, title: 'Film' }]);
      isRequested.mockResolvedValueOnce(false);
      await handler(msg);
      expect(requestMedia).toHaveBeenCalledWith(
        1,
        'movie',
        expect.any(Object),
        msg,
        'Mock Response'
      );
    });

    test('handles multiple results (saves pendingSelections)', async () => {
      searchJellyseerr.mockResolvedValueOnce([
        { id: 1, title: 'A' },
        { id: 2, title: 'B' },
      ]);
      await handler(msg);
      expect(pendingSelections['user123']).toBeDefined();
      expect(msg.reply).toHaveBeenCalledWith('Mock Response');
    });

    test('handles numeric reply with valid selection', async () => {
      pendingSelections['user123'] = {
        type: 'movie',
        results: [{ id: 1, title: 'Chosen Movie' }],
      };
      msg.body = '1';
      isRequested.mockResolvedValueOnce(false);
      await handler(msg);
      expect(requestMedia).toHaveBeenCalled();
      expect(pendingSelections['user123']).toBeUndefined();
    });

    test('handles invalid numeric selection', async () => {
      pendingSelections['user123'] = { type: 'movie', results: [] };
      msg.body = '9';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(expect.stringMatching(/Invalid selection/i));
    });

    test('handles Jellyseerr error gracefully', async () => {
      searchJellyseerr.mockRejectedValueOnce(new Error('API fail'));
      msg.body = '!r movie fail';
      await handler(msg);
      expect(msg.reply).toHaveBeenCalledWith(
        expect.stringMatching(/Error searching Jellyseerr/i)
      );
    });
  });
});
