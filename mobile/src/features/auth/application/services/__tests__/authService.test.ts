import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { interceptors } from '../../../../../core/api/interceptors';
import { authService } from '../index';

describe('authService email verification', () => {
  beforeEach(() => {
    interceptors.clear();
    resetApiTransport();
  });

  afterEach(() => {
    resetApiTransport();
  });

  it('verifies an email through /auth/verify-email/', async () => {
    const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

    setApiTransport(async (method: any, config: any) => {
      requests.push({ method, url: config.url, data: config.data });
      return { status: 200, data: { message: 'ok' } as never, config };
    });

    await authService.verifyEmail(' Traveler@Example.COM ', ' 123456 ');

    expect(requests).toEqual([
      {
        method: 'POST',
        url: '/auth/verify-email/',
        data: { email: 'traveler@example.com', code: '123456' },
      },
    ]);
  });

  it('resends a verification code through /auth/resend-verification/', async () => {
    const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

    setApiTransport(async (method: any, config: any) => {
      requests.push({ method, url: config.url, data: config.data });
      return { status: 200, data: { message: 'ok' } as never, config };
    });

    await authService.resendVerificationCode(' Traveler@Example.COM ');

    expect(requests).toEqual([
      {
        method: 'POST',
        url: '/auth/resend-verification/',
        data: { email: 'traveler@example.com' },
      },
    ]);
  });
});
