import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ToastProvider } from '../../../../../shared/toast/ToastProvider';
import { ROUTES } from '../../../../../app/navigation/routes';
import { navigationRef } from '../../../../../app/navigation/navigationRef';
import { submissionsService } from '../../../application/services';
import { SubmissionScreen } from '../SubmissionScreen';

jest.mock('../../../application/services', () => ({
  submissionsService: {
    createStory: jest.fn(),
  },
}));

jest.mock('../../../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      show: jest.fn(),
    },
  }),
}));

function renderSubmissionScreen() {
  return render(
    <ToastProvider>
      <SubmissionScreen />
    </ToastProvider>,
  );
}

describe('SubmissionScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    navigationRef.navigate = jest.fn();
  });

  it('shows inline validation errors when required fields are missing', async () => {
    renderSubmissionScreen();

    fireEvent.press(screen.getByText('Submit story'));

    expect(await screen.findByText('Title is required.')).toBeTruthy();
    expect(screen.getByText('Narrative text is required.')).toBeTruthy();
    expect(screen.getByText('Select a story location on the map.')).toBeTruthy();
    expect(screen.getByText('Place name is required.')).toBeTruthy();
    expect(screen.getByText('Year is required.')).toBeTruthy();
    expect(submissionsService.createStory).not.toHaveBeenCalled();
  });

  it('submits the story payload and returns the user to the feed on success', async () => {
    (submissionsService.createStory as jest.Mock).mockResolvedValue({ id: 12 });
    renderSubmissionScreen();

    fireEvent.changeText(screen.getByLabelText('Story title'), 'The City Walls');
    fireEvent.changeText(screen.getByLabelText('Story narrative'), 'A story about the old city walls.');
    fireEvent(screen.getByTestId('story-location-map'), 'press', {
      nativeEvent: { coordinate: { latitude: 41.0082, longitude: 28.9784 } },
    });
    fireEvent.changeText(screen.getByLabelText('Place name'), 'Old City');
    fireEvent.changeText(screen.getByLabelText('Year'), '1453');
    fireEvent.press(screen.getByText('Architecture'));

    fireEvent.press(screen.getByText('Submit story'));

    await waitFor(() => {
      expect(submissionsService.createStory).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'The City Walls',
          narrative: 'A story about the old city walls.',
          placeName: 'Old City',
          timeType: 'exact_year',
          year: 1453,
          tags: ['architecture'],
          location: { latitude: 41.0082, longitude: 28.9784 },
        }),
      );
    });

    expect(navigationRef.navigate).toHaveBeenCalledWith(ROUTES.FEED);
  });

  it('shows an inline image validation error for oversized uploads', async () => {
    jest.spyOn(ImagePicker, 'launchImageLibraryAsync').mockResolvedValue({
      canceled: false,
      assets: [
        {
          uri: 'file:///story.png',
          fileName: 'story.png',
          fileSize: 3 * 1024 * 1024,
          mimeType: 'image/png',
          width: 100,
          height: 100,
          type: 'image',
          assetId: 'asset-1',
          duration: null,
          base64: null,
          exif: null,
          file: undefined,
          pairedVideoAsset: undefined,
        },
      ],
    } as ImagePicker.ImagePickerSuccessResult);

    renderSubmissionScreen();
    fireEvent.press(screen.getByText('Choose image'));

    expect(await screen.findByText('Image must be smaller than 2MB.')).toBeTruthy();
  });
});
