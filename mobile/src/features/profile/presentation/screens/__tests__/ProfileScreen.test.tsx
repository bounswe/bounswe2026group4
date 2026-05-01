import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileScreen } from '../ProfileScreen';
import { navigationRef } from '../../../../../app/navigation/navigationRef';
import { userService } from '../../../application/services';
import { FeedEntity, FeedPageEntity } from '../../../../feed/domain/entities';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastInfo = jest.fn();
const mockUpdateUser = jest.fn(async () => undefined);
const mockLogout = jest.fn(async () => undefined);
const mockAuthClear = jest.fn(async () => undefined);
let mockAuthUser: {
  id: number;
  email: string;
  username: string;
  role: 'user';
  isUsernamePublic: boolean;
} | null = {
  id: 7,
  email: 'traveler@example.com',
  username: 'Traveler',
  role: 'user',
  isUsernamePublic: true,
};
let mockIsAuthenticated = true;

jest.mock('../../../../auth/application/services', () => ({
  authService: {
    clear: mockAuthClear,
  },
}));

jest.mock('../../../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      info: mockToastInfo,
      show: jest.fn(),
    },
  }),
}));

jest.mock('../../../../auth', () => ({
  useAuth: () => ({
    user: mockAuthUser,
    isAuthenticated: mockIsAuthenticated,
    updateUser: mockUpdateUser,
    logout: mockLogout,
  }),
}));

const selfProfile = {
  id: '7',
  username: 'Traveler',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'traveler@example.com',
  totalPoints: 12,
  publishedStoryCount: 4,
  dateJoined: '2026-01-15T10:00:00Z',
  bio: 'Collecting neighborhood memories.',
  location: 'Istanbul',
  birthDate: '1995-05-20',
  profilePhoto: 'https://cdn.example.com/original.jpg',
  isNamePublic: true,
  isUsernamePublic: true,
  isEmailVerified: true,
  isLocationPublic: true,
  isBirthDatePublic: false,
  isPhotoPublic: true,
};

const publicProfile = {
  id: '12',
  username: 'Aylin',
  firstName: 'Aylin',
  lastName: 'Demir',
  totalPoints: 30,
  publishedStoryCount: 4,
  dateJoined: '2025-02-10T10:00:00Z',
  bio: 'I write about harbor neighborhoods.',
  location: 'Izmir',
  birthYear: 1988,
  profilePhoto: 'https://cdn.example.com/public.jpg',
  followersCount: 12,
  followingCount: 5,
  isFollowedByMe: false,
};

function makeSavedStory(id: string, title = `Saved Story ${id}`): FeedEntity {
  return {
    id,
    title,
    locationName: 'Golden Horn',
    timePeriod: '1978',
    previewText: 'A saved story about local history.',
    submittedAt: '2026-03-18T10:00:00Z',
    hasMedia: false,
    likeCount: 4,
    savedByViewer: true,
  };
}

function makeSavedStoriesPage(overrides: Partial<FeedPageEntity> = {}): FeedPageEntity {
  return {
    items: [makeSavedStory('saved-1', 'Saved Harbor')],
    page: 1,
    pageSize: 10,
    totalCount: 1,
    hasNextPage: false,
    ...overrides,
  };
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(userService, 'getSavedStories').mockResolvedValue(makeSavedStoriesPage({
      items: [],
      totalCount: 0,
    }));
    mockAuthUser = {
      id: 7,
      email: 'traveler@example.com',
      username: 'Traveler',
      role: 'user',
      isUsernamePublic: true,
    };
    mockIsAuthenticated = true;
    navigationRef.redirectToPublic = jest.fn();
    navigationRef.redirectToAuth = jest.fn();
  });

  it('renders a loading state while profile data is being fetched', () => {
    render(
      <ProfileScreen
        getCurrentProfile={() => new Promise(() => undefined)}
      />,
    );

    expect(screen.getByLabelText('Loading profile')).toBeTruthy();
  });

  it('opens the edit profile form with photo actions and privacy toggles', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();

    fireEvent.press(screen.getByText('Edit Profile'));

    expect(screen.getByLabelText('Username')).toBeTruthy();
    expect(screen.getByLabelText('First name')).toBeTruthy();
    expect(screen.getByLabelText('Last name')).toBeTruthy();
    expect(screen.getByLabelText('Location')).toBeTruthy();
    expect(screen.getByLabelText('Bio')).toBeTruthy();
    expect(screen.getByText('Choose Photo')).toBeTruthy();
    expect(screen.getByText('Remove Photo')).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(6);
  });

  it('shows the saved full name on the profile header when available', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.getByText('Ada Lovelace')).toBeTruthy();
  });

  it('shows the saved birth date on the signed-in user profile', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.getByText('May 20, 1995')).toBeTruthy();
  });

  it('renders saved stories on the signed-in user profile', async () => {
    const getSavedStories = jest.fn(async () => makeSavedStoriesPage());

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        getSavedStories={getSavedStories}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByLabelText('Show saved stories')).toBeTruthy();
    expect(screen.queryByLabelText('Profile content tabs')).toBeNull();
    expect(screen.queryByText('Saved Stories')).toBeNull();
    expect(getSavedStories).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Show saved stories'));

    expect(await screen.findByText('Saved Stories')).toBeTruthy();
    expect(await screen.findByText('Saved Harbor')).toBeTruthy();
    expect(screen.getByText('Golden Horn')).toBeTruthy();
    expect(screen.getByLabelText('Remove Saved Harbor from saved stories')).toBeTruthy();
    expect(getSavedStories).toHaveBeenCalledWith('7', 1);
  });

  it('removes a saved story with an optimistic update and confirmation toast', async () => {
    const unbookmarkStory = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        getSavedStories={async () => makeSavedStoriesPage()}
        unbookmarkStory={unbookmarkStory}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show saved stories'));
    expect(await screen.findByText('Saved Harbor')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove Saved Harbor from saved stories'));

    await waitFor(() => {
      expect(unbookmarkStory).toHaveBeenCalledWith('saved-1');
      expect(screen.queryByText('Saved Harbor')).toBeNull();
      expect(mockToastSuccess).toHaveBeenCalledWith('Removed from saved stories.');
    });
  });

  it('restores a saved story when removing the bookmark fails', async () => {
    const unbookmarkStory = jest.fn(async () => {
      throw new Error('Network error');
    });

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        getSavedStories={async () => makeSavedStoriesPage()}
        unbookmarkStory={unbookmarkStory}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show saved stories'));
    expect(await screen.findByText('Saved Harbor')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove Saved Harbor from saved stories'));

    await waitFor(() => {
      expect(unbookmarkStory).toHaveBeenCalledWith('saved-1');
      expect(mockToastError).toHaveBeenCalledWith('Failed to remove saved story. Please try again.');
      expect(screen.getByText('Saved Harbor')).toBeTruthy();
    });
  });

  it('shows the saved stories empty state and browse action', async () => {
    navigationRef.navigate = jest.fn();

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        getSavedStories={async () => makeSavedStoriesPage({
          items: [],
          totalCount: 0,
        })}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show saved stories'));

    expect(await screen.findByText('No saved stories yet')).toBeTruthy();
    expect(screen.getByText('Bookmark stories to find them here later.')).toBeTruthy();

    fireEvent.press(screen.getByText('Browse stories'));

    expect(navigationRef.navigate).toHaveBeenCalledWith('Feed');
  });

  it('loads more saved stories when more bookmark pages exist', async () => {
    const getSavedStories = jest
      .fn()
      .mockResolvedValueOnce(makeSavedStoriesPage({
        items: [makeSavedStory('saved-1', 'First Saved Story')],
        totalCount: 2,
        hasNextPage: true,
      }))
      .mockResolvedValueOnce(makeSavedStoriesPage({
        items: [makeSavedStory('saved-2', 'Second Saved Story')],
        page: 2,
        totalCount: 2,
        hasNextPage: false,
      }));

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        getSavedStories={getSavedStories}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Show saved stories'));
    expect(await screen.findByText('First Saved Story')).toBeTruthy();

    fireEvent.press(screen.getByText('Load more saved stories'));

    expect(await screen.findByText('Second Saved Story')).toBeTruthy();
    expect(getSavedStories).toHaveBeenCalledWith('7', 2);
  });

  it('falls back to the public birth year on the signed-in user profile when the full date is unavailable', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => ({
          ...selfProfile,
          birthDate: null,
          birthYear: 1995,
        })}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.getByText('1995')).toBeTruthy();
    expect(screen.queryByText('May 20, 1995')).toBeNull();
  });

  it('shows a photo preview after selecting a valid image and can remove it before saving', async () => {
    jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked.png',
          fileName: 'picked.png',
          fileSize: 400_000,
          mimeType: 'image/png',
        },
      ],
    } as ImagePicker.ImagePickerSuccessResult);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.press(screen.getByText('Choose Photo'));

    await waitFor(() => {
      expect(screen.getByLabelText('Selected profile photo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Remove Photo'));

    await waitFor(() => {
      expect(screen.queryByLabelText('Selected profile photo')).toBeNull();
    });
  });

  it('validates selected photo type and size before save', async () => {
    jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked.gif',
          fileName: 'picked.gif',
          fileSize: 100_000,
          mimeType: 'image/gif',
        },
      ],
    } as ImagePicker.ImagePickerSuccessResult);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.press(screen.getByText('Choose Photo'));

    expect(await screen.findByText('Profile photo must be a JPG or PNG image.')).toBeTruthy();

    jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValueOnce({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked.jpg',
          fileName: 'picked.jpg',
          fileSize: 2_100_000,
          mimeType: 'image/jpeg',
        },
      ],
    } as ImagePicker.ImagePickerSuccessResult);

    fireEvent.press(screen.getByText('Choose Photo'));

    expect(await screen.findByText('Photo must be 2 MB or smaller.')).toBeTruthy();
  });

  it('validates bio length and birth date range before saving', async () => {
    const invalidProfile = {
      ...selfProfile,
      birthDate: '1899-12-31',
    };
    const updateCurrentProfile = jest.fn(async () => invalidProfile);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => invalidProfile}
        updateCurrentProfile={updateCurrentProfile}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.changeText(screen.getByLabelText('Bio'), 'a'.repeat(281));
    fireEvent.press(screen.getByText('Save Changes'));

    expect(await screen.findByText('Bio must be 280 characters or fewer.')).toBeTruthy();
    expect(screen.getByText('Birth date must be after 1900.')).toBeTruthy();
    expect(updateCurrentProfile).not.toHaveBeenCalled();
  });

  it('saves profile changes, uploads the photo, and updates auth user state', async () => {
    jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///picked.jpg',
          fileName: 'picked.jpg',
          fileSize: 350_000,
          mimeType: 'image/jpeg',
        },
      ],
    } as ImagePicker.ImagePickerSuccessResult);

    const updateCurrentProfile = jest.fn(async (input) => ({
      ...selfProfile,
      firstName: input.firstName,
      lastName: input.lastName,
      username: input.username,
      location: input.location,
      bio: input.bio,
      birthDate: input.birthDate,
      isNamePublic: input.isNamePublic,
      isUsernamePublic: input.isUsernamePublic,
      isLocationPublic: input.isLocationPublic,
      isBirthDatePublic: input.isBirthDatePublic,
      isPhotoPublic: input.isPhotoPublic,
    }));
    const uploadProfilePhoto = jest.fn(async () => ({
      ...selfProfile,
      username: 'Traveler Updated',
      location: 'Ankara',
      bio: 'Updated bio',
      profilePhoto: 'https://cdn.example.com/updated.jpg',
      isLocationPublic: false,
      isBirthDatePublic: true,
      isPhotoPublic: false,
    }));

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        updateCurrentProfile={updateCurrentProfile}
        uploadProfilePhoto={uploadProfilePhoto}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Edit Profile'));
    fireEvent.changeText(screen.getByLabelText('First name'), 'Ada');
    fireEvent.changeText(screen.getByLabelText('Last name'), 'Byron');
    fireEvent.changeText(screen.getByLabelText('Username'), 'Traveler Updated');
    fireEvent.changeText(screen.getByLabelText('Location'), 'Ankara');
    fireEvent.changeText(screen.getByLabelText('Bio'), 'Updated bio');

    const switches = screen.getAllByRole('switch');
    fireEvent.press(switches[0]);
    fireEvent.press(switches[1]);
    fireEvent.press(switches[2]);
    fireEvent.press(switches[3]);
    fireEvent.press(switches[4]);

    fireEvent.press(screen.getByLabelText('Open birth date picker'));
    fireEvent.press(screen.getByText('Use Date'));

    fireEvent.press(screen.getByText('Choose Photo'));
    await waitFor(() => {
      expect(screen.getByLabelText('Selected profile photo')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(updateCurrentProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'Traveler Updated',
          location: 'Ankara',
          bio: 'Updated bio',
          isLocationPublic: false,
          isBirthDatePublic: true,
          isPhotoPublic: false,
        }),
      );
    });

    expect(uploadProfilePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        uri: 'file:///picked.jpg',
        fileName: 'picked.jpg',
        mimeType: 'image/jpeg',
      }),
    );

    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'Traveler Updated',
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Profile updated successfully.');
    });
  });

  it('renders public profile fields returned by the API and falls back to anonymous user when username is hidden', async () => {
    const { rerender } = render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => publicProfile}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByText('Izmir')).toBeTruthy();
    expect(screen.getByText('1988')).toBeTruthy();
    expect(screen.queryByText('May 20, 1995')).toBeNull();
    expect(screen.getByText('I write about harbor neighborhoods.')).toBeTruthy();
    expect(screen.queryByText('Edit Profile')).toBeNull();
    expect(screen.queryByText('Saved Stories')).toBeNull();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();

    rerender(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => ({
          ...publicProfile,
          username: null,
          location: null,
          birthYear: null,
        })}
      />,
    );

    expect(await screen.findByText('Anonymous user')).toBeTruthy();
    expect(screen.queryByText('Izmir')).toBeNull();
    expect(screen.queryByText('1988')).toBeNull();
  });

  it('does not render a follow button on the user own profile', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => ({
          ...selfProfile,
          followersCount: 3,
          followingCount: 2,
        })}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.queryByText('Follow')).toBeNull();
    expect(screen.queryByLabelText('Follow user')).toBeNull();
    expect(screen.queryByLabelText('Unfollow user')).toBeNull();
    expect(screen.getByLabelText('3 Followers')).toBeTruthy();
    expect(screen.getByLabelText('2 Following')).toBeTruthy();
  });

  it('renders authenticated not-following state and optimistically follows', async () => {
    const followUser = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="public"
        userId="13"
        getPublicProfile={async () => ({
          ...publicProfile,
          id: '13',
          followersCount: 10,
          isFollowedByMe: false,
        })}
        followUser={followUser}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByText('Follow')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Follow user'));

    expect(screen.getByLabelText('Unfollow user')).toBeTruthy();
    expect(screen.getByLabelText('11 Followers')).toBeTruthy();

    await waitFor(() => {
      expect(followUser).toHaveBeenCalledWith('13');
    });
  });

  it('keeps the following state after leaving and returning when the profile response omits it', async () => {
    const followUser = jest.fn(async () => undefined);
    const getFollowers = jest.fn(async () => ({
      count: 0,
      next: null,
      previous: null,
      users: [],
    }));
    const firstRender = render(
      <ProfileScreen
        mode="public"
        userId="30"
        getPublicProfile={async () => ({
          ...publicProfile,
          id: '30',
          followersCount: 2,
          isFollowedByMe: false,
        })}
        getFollowers={getFollowers}
        followUser={followUser}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Follow user'));

    await waitFor(() => {
      expect(followUser).toHaveBeenCalledWith('30');
    });

    firstRender.unmount();

    const { isFollowedByMe: _isFollowedByMe, ...profileWithoutFollowState } = publicProfile;

    render(
      <ProfileScreen
        mode="public"
        userId="30"
        getPublicProfile={async () => ({
          ...profileWithoutFollowState,
          id: '30',
          followersCount: 3,
        })}
        getFollowers={getFollowers}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByLabelText('Unfollow user')).toBeTruthy();
  });

  it('infers following state from followers when the profile response omits it', async () => {
    const getFollowers = jest.fn(async () => ({
      count: 10,
      next: null,
      previous: null,
      users: [
        { id: '22', username: 'Deniz', profilePhoto: null },
        { id: '7', username: null, profilePhoto: null },
      ],
    }));
    const { isFollowedByMe: _isFollowedByMe, ...profileWithoutFollowState } = publicProfile;

    render(
      <ProfileScreen
        mode="public"
        userId="31"
        getPublicProfile={async () => ({
          ...profileWithoutFollowState,
          id: '31',
          followersCount: 10,
        })}
        getFollowers={getFollowers}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByLabelText('Unfollow user')).toBeTruthy();
    expect(getFollowers).toHaveBeenCalledWith('31', 1);
  });

  it('renders authenticated following state and rolls back when unfollow fails', async () => {
    const unfollowUser = jest.fn(async () => {
      throw new Error('Network error');
    });

    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => ({
          ...publicProfile,
          followersCount: 10,
          isFollowedByMe: true,
        })}
        unfollowUser={unfollowUser}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByLabelText('Unfollow user')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Unfollow user'));

    await waitFor(() => {
      expect(unfollowUser).toHaveBeenCalledWith('12');
      expect(mockToastError).toHaveBeenCalledWith('Failed to unfollow user. Please try again.');
    });
    expect(screen.getByLabelText('Unfollow user')).toBeTruthy();
    expect(screen.getByLabelText('10 Followers')).toBeTruthy();
  });

  it('renders unauthenticated follow state as a login prompt', async () => {
    mockAuthUser = null;
    mockIsAuthenticated = false;

    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => publicProfile}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    fireEvent.press(screen.getByText('Log in to follow'));

    expect(mockToastInfo).toHaveBeenCalledWith('Please sign in to follow users.');
    expect(navigationRef.redirectToAuth).toHaveBeenCalledWith('unauthorized');
  });

  it('opens followers list and navigates from a list entry', async () => {
    const onOpenUserProfile = jest.fn();

    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => publicProfile}
        getFollowers={async () => ({
          count: 1,
          next: null,
          previous: null,
          users: [{ id: '20', username: 'Deniz', profilePhoto: null }],
        })}
        onOpenUserProfile={onOpenUserProfile}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('12 Followers'));

    expect(await screen.findByText('Deniz')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open Deniz profile'));

    expect(onOpenUserProfile).toHaveBeenCalledWith('20');
  });

  it('does not navigate when a follower row is dragged like a scroll gesture', async () => {
    const onOpenUserProfile = jest.fn();

    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => publicProfile}
        getFollowers={async () => ({
          count: 2,
          next: null,
          previous: null,
          users: [
            { id: '20', username: 'Deniz', profilePhoto: null },
            { id: '21', username: 'Ece', profilePhoto: null },
          ],
        })}
        onOpenUserProfile={onOpenUserProfile}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('12 Followers'));

    const row = await screen.findByLabelText('Open Deniz profile');
    fireEvent(row, 'pressIn', { nativeEvent: { pageX: 0, pageY: 0 } });
    fireEvent(row, 'touchMove', { nativeEvent: { pageX: 0, pageY: 32 } });
    fireEvent.press(row);

    expect(onOpenUserProfile).not.toHaveBeenCalled();
    expect(screen.getByText('Deniz')).toBeTruthy();
  });

  it('shows the signed-in follower with the local username and You label when public username is hidden', async () => {
    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => ({
          ...publicProfile,
          isFollowedByMe: true,
        })}
        getFollowers={async () => ({
          count: 2,
          next: null,
          previous: null,
          users: [
            { id: '20', username: 'Deniz', profilePhoto: null },
            { id: '7', username: null, profilePhoto: null },
          ],
        })}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('12 Followers'));

    expect(await screen.findByText('Traveler (You)')).toBeTruthy();
    expect(screen.getByText('Deniz')).toBeTruthy();
    expect(screen.queryByText('Anonymous user')).toBeNull();
    expect(screen.getByLabelText('Open Traveler (You) profile')).toBeTruthy();
  });

  it('shows the bio privacy pending note in the edit form', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Edit Profile'));

    expect(
      screen.getByText('Bio privacy UI is ready, but it will start working after backend support is added.'),
    ).toBeTruthy();
  });

  it('shows an error state when profile loading fails', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => {
          throw new Error('Network error');
        }}
      />,
    );

    expect(await screen.findByText('Profile unavailable')).toBeTruthy();
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('renders delete account action and requires password before deletion', async () => {
    const deleteAccount = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        deleteAccount={deleteAccount}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Delete Account'));

    expect(screen.getByText('This action cannot be undone')).toBeTruthy();
    expect(screen.getByText('Delete My Account')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Confirm account deletion'));

    expect(await screen.findByText('Re-enter your password to continue.')).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('can dismiss the delete account modal without triggering deletion', async () => {
    const deleteAccount = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        deleteAccount={deleteAccount}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getByText('Delete Account'));
    expect(screen.getByText('This action cannot be undone')).toBeTruthy();

    fireEvent.press(screen.getByText('Cancel'));

    await waitFor(() => {
      expect(screen.queryByText('This action cannot be undone')).toBeNull();
    });
    expect(deleteAccount).not.toHaveBeenCalled();
    expect(mockAuthClear).not.toHaveBeenCalled();
    expect(navigationRef.redirectToPublic).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });
});
