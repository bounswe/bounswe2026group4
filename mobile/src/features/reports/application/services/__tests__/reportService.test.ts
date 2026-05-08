import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { reportService } from '..';

describe('reportService', () => {
  const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

  beforeEach(() => {
    requests.length = 0;
    setApiTransport(async (method, config) => {
      requests.push({ method, url: config.url, data: config.data });
      const data = config.data as { target_id?: unknown; reason?: unknown } | undefined;

      if (method === 'POST' && config.url === '/reports/') {
        return {
          status: 201,
          data: {
            id: 7,
            target_type: 'story',
            target_id: data?.target_id,
            reason: data?.reason,
            status: 'pending',
            created_at: '2026-05-08T12:00:00Z',
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request ${method} ${config.url}`);
    });
  });

  afterEach(() => {
    resetApiTransport();
  });

  it('posts a content report to the reports endpoint and maps the response', async () => {
    const report = await reportService.reportContent({
      targetType: 'story',
      targetId: '42',
      reason: 'privacy_violation',
      description: 'Contains a private address.',
    });

    expect(requests[0]).toEqual({
      method: 'POST',
      url: '/reports/',
      data: {
        target_type: 'story',
        target_id: 42,
        reason: 'privacy_violation',
        description: 'Contains a private address.',
      },
    });
    expect(report).toMatchObject({
      id: '7',
      targetType: 'story',
      targetId: '42',
      reason: 'privacy_violation',
      status: 'pending',
    });
  });
});
