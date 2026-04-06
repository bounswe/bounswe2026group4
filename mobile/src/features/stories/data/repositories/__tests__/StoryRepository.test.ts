import { StoryRepositoryImpl } from '..';
import { storiesRemoteSource } from '../../sources';

describe('StoryRepositoryImpl', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('fetches a story detail record and merges mapped comments', async () => {
    jest.spyOn(storiesRemoteSource, 'getStory').mockResolvedValue({
      id: 42,
      title: 'The City Walls',
      narrative: 'First paragraph.\n\nSecond paragraph.',
      status: 'published',
      location_name: 'Old City',
      location_lat: '41.0082',
      location_lng: '28.9784',
      time_type: 'exact_year',
      year: 1453,
      contributor_name: 'historian_01',
      submitted_at: '2026-03-18T10:00:00Z',
      like_count: 7,
      user_has_liked: false,
      media_items: [],
    });
    jest.spyOn(storiesRemoteSource, 'getStoryComments').mockResolvedValue([
      {
        id: 1,
        text: 'Great story!',
        author_username: 'reader',
        is_anonymized: false,
        created_at: '2026-03-20T12:00:00Z',
      },
    ]);

    const repository = new StoryRepositoryImpl();
    const result = await repository.getStory('42');

    expect(result?.id).toBe('42');
    expect(result?.location.name).toBe('Old City');
    expect(result?.comments).toEqual([
      {
        id: '1',
        authorName: 'reader',
        body: 'Great story!',
        createdAt: '2026-03-20T12:00:00Z',
      },
    ]);
  });

  it('returns null when the story is not found', async () => {
    jest.spyOn(storiesRemoteSource, 'getStory').mockResolvedValue(null);

    const repository = new StoryRepositoryImpl();

    await expect(repository.getStory('404')).resolves.toBeNull();
  });

  it('deletes a story through the remote source', async () => {
    const deleteStorySpy = jest.spyOn(storiesRemoteSource, 'deleteStory').mockResolvedValue(undefined);

    const repository = new StoryRepositoryImpl();
    await repository.deleteStory('42');

    expect(deleteStorySpy).toHaveBeenCalledWith('42');
  });
});
