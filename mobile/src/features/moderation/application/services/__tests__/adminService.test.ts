import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { adminService } from '../adminService';

describe('adminService', () => {
  afterEach(() => {
    resetApiTransport();
  });

  it('hydrates comment reports with their parent story id when the report payload omits it', async () => {
    const requests: string[] = [];

    setApiTransport(async (method, config) => {
      requests.push(`${method} ${config.url ?? ''}`);

      if (method === 'GET' && config.url === '/moderation/reports/?page=1&page_size=10&status=pending') {
        return {
          status: 200,
          data: {
            count: 1,
            next: null,
            results: [
              {
                id: 11,
                reporter: {
                  id: 2,
                  username: 'Reporter',
                  email: 'reporter@example.com',
                },
                target_type: 'comment',
                target_id: 99,
                reason: 'spam',
                status: 'pending',
                created_at: '2026-05-01T12:00:00Z',
              },
            ],
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/feed/?page=1&page_size=100&sort_by=recent') {
        return {
          status: 200,
          data: {
            count: 1,
            next: null,
            results: [
              {
                id: 7,
                title: 'Reported story',
              },
            ],
          } as never,
          config,
        };
      }

      if (method === 'GET' && config.url === '/stories/7/comments/?page=1&page_size=100') {
        return {
          status: 200,
          data: {
            count: 1,
            next: null,
            results: [
              {
                id: 99,
                text: 'Reported comment',
              },
            ],
          } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    const reports = await adminService.getReports({ status: 'pending' });

    expect(reports.items[0]).toEqual(expect.objectContaining({
      targetId: '99',
      targetStoryId: '7',
      targetType: 'comment',
    }));
    expect(requests).toContain('GET /stories/feed/?page=1&page_size=100&sort_by=recent');
    expect(requests).toContain('GET /stories/7/comments/?page=1&page_size=100');
  });

  it('bans a user through the moderation endpoint', async () => {
    const requests: string[] = [];

    setApiTransport(async (method, config) => {
      requests.push(`${method} ${config.url ?? ''}`);

      if (method === 'PATCH' && config.url === '/moderation/users/12/ban/') {
        return {
          status: 204,
          data: undefined as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await adminService.banUser('12');

    expect(requests).toEqual(['PATCH /moderation/users/12/ban/']);
  });
});
