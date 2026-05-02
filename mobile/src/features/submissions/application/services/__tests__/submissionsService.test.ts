import { resetApiTransport, setApiTransport } from '../../../../../core/api/client';
import { submissionsService } from '..';

function getFormField(formData: FormData, name: string) {
  if (typeof (formData as unknown as { get?: (key: string) => unknown }).get === 'function') {
    return (formData as unknown as { get: (key: string) => unknown }).get(name);
  }

  const parts = (formData as unknown as { _parts?: Array<[string, unknown]> })._parts ?? [];
  return parts.find(([key]) => key === name)?.[1];
}

describe('submissionsService', () => {
  beforeEach(() => {
    resetApiTransport();
  });

  afterEach(() => {
    resetApiTransport();
  });

  it('creates a story with contributor visibility and uploads image, audio, and video files', async () => {
    const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

    setApiTransport(async (method: any, config: any) => {
      requests.push({ method, url: config.url, data: config.data });

      if (method === 'POST' && config.url === '/stories/') {
        return {
          status: 201,
          data: { id: 12 } as never,
          config,
        };
      }

      if (method === 'POST' && config.url === '/stories/12/images/') {
        return { status: 201, data: {} as never, config };
      }

      if (method === 'POST' && config.url === '/stories/12/media/') {
        expect(config.data).toBeInstanceOf(FormData);
        return { status: 201, data: {} as never, config };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await submissionsService.createStory({
      title: 'Mixed Media',
      narrative: 'A story with several files.',
      location: { latitude: 41.0082, longitude: 28.9784 },
      placeName: 'Old City',
      timeType: 'exact_year',
      year: 1453,
      tags: [],
      contributorVisible: false,
      image: { uri: 'file:///story.jpg', name: 'story.jpg', type: 'image/jpeg' },
      audio: { uri: 'file:///story.mp3', name: 'story.mp3', type: 'audio/mpeg', mediaType: 'audio' },
      video: { uri: 'file:///story.mp4', name: 'story.mp4', type: 'video/mp4', mediaType: 'video' },
    });

    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'POST /stories/',
      'POST /stories/12/images/',
      'POST /stories/12/media/',
      'POST /stories/12/media/',
    ]);

    expect(requests[0].data).toBeInstanceOf(FormData);
    expect(getFormField(requests[0].data as FormData, 'contributor_visible')).toBe('false');
    expect(getFormField(requests[0].data as FormData, 'temporal_coverage')).toBe('1453');
    expect(requests[1].data).toBeInstanceOf(FormData);
    expect(getFormField(requests[1].data as FormData, 'file')).toBeTruthy();

    const mediaFiles = requests
      .slice(2)
      .map((request) => getFormField(request.data as FormData, 'file'));

    expect(mediaFiles).toEqual([expect.anything(), expect.anything()]);
  });

  it('creates exact date stories with date, optional time, and EDTF temporal coverage fields', async () => {
    const requests: Array<{ method: string; url?: string; data?: unknown }> = [];

    setApiTransport(async (method: any, config: any) => {
      requests.push({ method, url: config.url, data: config.data });

      if (method === 'POST' && config.url === '/stories/') {
        return {
          status: 201,
          data: { id: 13 } as never,
          config,
        };
      }

      throw new Error(`Unexpected request: ${method} ${config.url}`);
    });

    await submissionsService.createStory({
      title: 'Republic Day',
      narrative: 'A memory tied to a specific date and time.',
      location: { latitude: 39.9334, longitude: 32.8597 },
      placeName: 'Ankara',
      timeType: 'exact_date',
      dateValue: '1923-10-29',
      timeValue: '9:30',
      tags: [],
      contributorVisible: true,
    });

    expect(requests).toHaveLength(1);
    expect(getFormField(requests[0].data as FormData, 'time_type')).toBe('exact_date');
    expect(getFormField(requests[0].data as FormData, 'date_value')).toBe('1923-10-29');
    expect(getFormField(requests[0].data as FormData, 'time_value')).toBe('09:30');
    expect(getFormField(requests[0].data as FormData, 'temporal_coverage')).toBe('1923-10-29T09:30');
    expect(getFormField(requests[0].data as FormData, 'year')).toBeNull();
  });
});
