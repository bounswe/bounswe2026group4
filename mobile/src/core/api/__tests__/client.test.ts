import { apiClient, resetApiTransport, setApiTransport } from '../client';

describe('apiClient', () => {
  afterEach(() => {
    resetApiTransport();
  });

  it('returns a helpful error when the transport fails before receiving a response', async () => {
    setApiTransport(async () => {
      throw new TypeError('fetch failed');
    });

    await expect(apiClient.post('/auth/register/', { ok: true })).rejects.toThrow(
      'Unable to reach the backend. Check EXPO_PUBLIC_API_BASE_URL and make sure the backend is running and reachable from your phone.',
    );
  });
});
