import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ProfileCompletionScreen } from '../ProfileCompletionScreen';

const mockToastSuccess = jest.fn();

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

describe('ProfileCompletionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(ImagePicker, 'requestMediaLibraryPermissionsAsync').mockResolvedValue({
      granted: true,
      canAskAgain: true,
      expires: 'never',
      status: 'granted' as ImagePicker.PermissionStatus,
      accessPrivileges: 'all',
    });
  });

  it('validates required fields before allowing submission', async () => {
    const updateCurrentProfile = jest.fn();

    render(<ProfileCompletionScreen updateCurrentProfile={updateCurrentProfile} />);

    fireEvent.press(screen.getByText('Continue'));

    expect(await screen.findByText('Name is required.')).toBeTruthy();
    expect(screen.getByText('Surname is required.')).toBeTruthy();
    expect(updateCurrentProfile).not.toHaveBeenCalled();
  });

  it('submits only required fields when skipping optional sections', async () => {
    const updateCurrentProfile = jest.fn(async () => ({
      id: '7',
      username: 'Traveler',
      totalPoints: 5,
      firstName: 'Ada',
      lastName: 'Lovelace',
      isNamePublic: true,
    }));
    const onCompleted = jest.fn();

    render(
      <ProfileCompletionScreen
        updateCurrentProfile={updateCurrentProfile}
        onCompleted={onCompleted}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Name'), 'Ada');
    fireEvent.changeText(screen.getByLabelText('Surname'), 'Lovelace');
    fireEvent.press(screen.getByText('Skip optional for now'));

    await waitFor(() => {
      expect(updateCurrentProfile).toHaveBeenCalledWith({
        firstName: 'Ada',
        lastName: 'Lovelace',
        isNamePublic: true,
        location: '',
        birthDate: null,
        bio: '',
        isLocationPublic: true,
        isBirthDatePublic: false,
        isPhotoPublic: true,
      });
    });

    expect(mockToastSuccess).toHaveBeenCalledWith('Profile saved. You are all set.');
    expect(onCompleted).toHaveBeenCalled();
  });

  it('uploads a selected photo after saving the profile payload', async () => {
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

    const updateCurrentProfile = jest.fn(async () => ({
      id: '7',
      username: 'Traveler',
      totalPoints: 5,
      firstName: 'Ada',
      lastName: 'Lovelace',
    }));
    const uploadProfilePhoto = jest.fn(async () => ({
      id: '7',
      username: 'Traveler',
      totalPoints: 5,
      firstName: 'Ada',
      lastName: 'Lovelace',
      profilePhoto: 'https://cdn.example.com/photo.jpg',
    }));

    render(
      <ProfileCompletionScreen
        updateCurrentProfile={updateCurrentProfile}
        uploadProfilePhoto={uploadProfilePhoto}
      />,
    );

    fireEvent.press(screen.getByLabelText('Add Profile photo'));
    fireEvent.press(screen.getByText('Choose photo'));

    await waitFor(() => {
      expect(screen.getByLabelText('Selected profile photo')).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText('Name'), 'Ada');
    fireEvent.changeText(screen.getByLabelText('Surname'), 'Lovelace');
    fireEvent.press(screen.getByText('Continue'));

    await waitFor(() => {
      expect(updateCurrentProfile).toHaveBeenCalled();
      expect(uploadProfilePhoto).toHaveBeenCalledWith({
        uri: 'file:///picked.jpg',
        fileName: 'picked.jpg',
        fileSize: 350_000,
        previewUri: 'file:///picked.jpg',
        mimeType: 'image/jpeg',
      });
    });
  });
});
