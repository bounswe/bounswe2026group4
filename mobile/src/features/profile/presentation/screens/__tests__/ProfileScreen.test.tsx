import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

const mockLogout = jest.fn(async () => undefined);
const mockUpdateUser = jest.fn(async () => undefined);
const mockToastSuccess = jest.fn();

jest.mock('../../../../auth', () => ({
  useAuth: () => ({
    user: {
      id: 7,
      email: 'traveler@example.com',
      username: 'Traveler',
      role: 'user',
    },
    updateUser: mockUpdateUser,
    logout: mockLogout,
  }),
}));

jest.mock('../../../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: mockToastSuccess,
      error: jest.fn(),
      info: jest.fn(),
      show: jest.fn(),
    },
    dismiss: jest.fn(),
  }),
}));

const selfProfile = {
  id: '7',
  username: 'Traveler',
  email: 'traveler@example.com',
  totalPoints: 12,
  dateJoined: '2026-01-15T10:00:00Z',
  bio: 'Collecting neighborhood memories.',
  location: 'Istanbul',
  birthDate: '1995-05-20',
  isUsernamePublic: true,
  isEmailVerified: true,
  isLocationPublic: true,
  isBirthDatePublic: false,
  isPhotoPublic: true,
};

const publicProfile = {
  id: '12',
  username: 'Aylin',
  totalPoints: 30,
  publishedStoryCount: 4,
  dateJoined: '2025-02-10T10:00:00Z',
  bio: 'I write about harbor neighborhoods.',
  location: 'Izmir',
  birthYear: 1988,
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    mockLogout.mockClear();
    mockUpdateUser.mockClear();
    mockToastSuccess.mockClear();
  });

  it('renders a loading state while profile data is being fetched', () => {
    render(
      <ProfileScreen
        getCurrentProfile={() => new Promise(() => undefined)}
      />,
    );

    expect(screen.getByLabelText('Loading profile')).toBeTruthy();
  });

  it('renders self profile data with edit controls and delete action', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    expect(await screen.findByText('Traveler')).toBeTruthy();
    expect(screen.getByText('traveler@example.com')).toBeTruthy();
    expect(screen.getAllByText('Edit profile')).toHaveLength(2);
    expect(screen.getByLabelText('Delete Account')).toBeTruthy();

    fireEvent.press(screen.getAllByText('Edit profile').at(-1)!);

    expect(screen.getByDisplayValue('Traveler')).toBeTruthy();
    expect(screen.getByDisplayValue('Istanbul')).toBeTruthy();
    expect(screen.getByDisplayValue('Collecting neighborhood memories.')).toBeTruthy();
    expect(screen.queryByText('Save changes')).toBeNull();
  });

  it('saves changes in self mode', async () => {
    const updateCurrentProfile = jest.fn(async () => ({
      ...selfProfile,
      username: 'Traveler Updated',
    }));

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        updateCurrentProfile={updateCurrentProfile}
      />,
    );

    await screen.findByText('Traveler');
    fireEvent.press(screen.getAllByText('Edit profile').at(-1)!);
    fireEvent.changeText(screen.getByLabelText('Username'), 'Traveler Updated');
    expect(await screen.findByText('Save changes')).toBeTruthy();
    fireEvent.press(screen.getByText('Save changes'));

    expect(updateCurrentProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'Traveler Updated',
      }),
    );
    expect(await screen.findByText('Profile updated successfully.')).toBeTruthy();
  });

  it('opens the delete confirmation flow with direct hard delete messaging', async () => {
    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Delete Account'));

    expect(await screen.findByText('This action cannot be undone')).toBeTruthy();
    expect(screen.getByText('Your account will be permanently deleted.')).toBeTruthy();
    expect(screen.getByText('Your stories and related likes will be permanently deleted.')).toBeTruthy();
    expect(screen.queryByLabelText('Also delete all my stories')).toBeNull();
  });

  it('requires password before deleting the account', async () => {
    const deleteAccount = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        deleteAccount={deleteAccount}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Delete Account'));
    fireEvent.press(screen.getByLabelText('Delete My Account'));

    expect(await screen.findByText('Please re-enter your password to confirm account deletion.')).toBeTruthy();
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes the account, shows success toast, and logs out', async () => {
    const deleteAccount = jest.fn(async () => undefined);

    render(
      <ProfileScreen
        mode="self"
        getCurrentProfile={async () => selfProfile}
        deleteAccount={deleteAccount}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Delete Account'));
    fireEvent.changeText(screen.getByLabelText('Account deletion password'), 'Password1');
    fireEvent.press(screen.getByLabelText('Delete My Account'));

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledWith('Password1', true);
    });
    expect(mockToastSuccess).toHaveBeenCalledWith('Your account has been deleted.');
    expect(mockLogout).toHaveBeenCalled();
  });

  it('renders a public profile in read-only mode', async () => {
    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => publicProfile}
      />,
    );

    expect(await screen.findByText('Aylin')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByText('Edit profile')).toBeNull();
    expect(screen.queryByText('Save changes')).toBeNull();
    expect(screen.getByText('Stories are intentionally out of scope for this profile version and will be added later.')).toBeTruthy();
  });

  it('shows anonymous user when the public profile username is hidden', async () => {
    render(
      <ProfileScreen
        mode="public"
        userId="12"
        getPublicProfile={async () => ({
          ...publicProfile,
          username: null,
        })}
      />,
    );

    expect(await screen.findByText('Anonymous user')).toBeTruthy();
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
});
