import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileScreen } from '../ProfileScreen';
import { navigationRef } from '../../../../../app/navigation/navigationRef';

const mockToastSuccess = jest.fn();
const mockUpdateUser = jest.fn(async () => undefined);
const mockLogout = jest.fn(async () => undefined);
const mockAuthClear = jest.fn(async () => undefined);

jest.mock('../../../../auth/application/services', () => ({
  authService: {
    clear: mockAuthClear,
  },
}));

jest.mock('../../../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: mockToastSuccess,
      error: jest.fn(),
      info: jest.fn(),
      show: jest.fn(),
    },
  }),
}));

jest.mock('../../../../auth', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      email: 'traveler@example.com',
      username: 'Traveler',
      role: 'user',
      isUsernamePublic: true,
    },
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
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigationRef.redirectToPublic = jest.fn();
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
    expect(screen.getByText('I write about harbor neighborhoods.')).toBeTruthy();
    expect(screen.queryByText('Edit Profile')).toBeNull();

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
