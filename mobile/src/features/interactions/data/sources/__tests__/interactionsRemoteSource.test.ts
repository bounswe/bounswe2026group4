import { apiClient } from '../../../../../core/api/client';
import { interactionsRemoteSource } from '..';

describe('interactionsRemoteSource', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('bookmarks a story through the bookmark endpoint', async () => {
    const postSpy = jest.spyOn(apiClient, 'post').mockResolvedValue({});

    await interactionsRemoteSource.bookmarkStory('42');

    expect(postSpy).toHaveBeenCalledWith('/stories/42/bookmark/');
  });

  it('removes a bookmark through the bookmark endpoint', async () => {
    const deleteSpy = jest.spyOn(apiClient, 'delete').mockResolvedValue(undefined);

    await interactionsRemoteSource.unbookmarkStory('42');

    expect(deleteSpy).toHaveBeenCalledWith('/stories/42/bookmark/');
  });
});
