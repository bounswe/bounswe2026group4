import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { lightColors } from '../../../../../app/theme/colors';
import { ToastProvider } from '../../../../../shared/toast/ToastProvider';
import { ROUTES } from '../../../../../app/navigation/routes';
import { navigationRef } from '../../../../../app/navigation/navigationRef';
import { submissionsService } from '../../../application/services';
import { SubmissionScreen } from '../SubmissionScreen';

jest.mock('../../../../../shared/components/WebMapView', () => {
  const React = require('react');
  const { Pressable } = require('react-native');

  return {
    WebMapView: ({ onMapPress }: { onMapPress?: (coords: { latitude: number; longitude: number }) => void }) => (
      <Pressable
        testID="story-location-map"
        onPress={(event: { nativeEvent?: { coordinate?: { latitude: number; longitude: number } } }) => {
          const coordinate = event.nativeEvent?.coordinate;

          if (coordinate) {
            onMapPress?.(coordinate);
          }
        }}
      />
    ),
  };
});

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

type TestInstanceWithParent = {
  props: { style?: unknown };
  parent: TestInstanceWithParent | null;
};

function renderSubmissionScreen() {
  return render(
    <ToastProvider>
      <SubmissionScreen />
    </ToastProvider>,
  );
}

function getInputShellStyle(accessibilityLabel: string) {
  let inputShell = screen.getByLabelText(accessibilityLabel).parent as TestInstanceWithParent | null;

  while (inputShell) {
    const style = StyleSheet.flatten(inputShell.props.style) as ViewStyle | undefined;

    if (style?.borderWidth) {
      return style;
    }

    inputShell = inputShell.parent;
  }

  throw new Error(`Missing shell for input: ${accessibilityLabel}`);
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

  it('marks blank required inputs with red outer borders', async () => {
    renderSubmissionScreen();

    fireEvent.press(screen.getByText('Submit story'));

    expect(await screen.findByText('Title is required.')).toBeTruthy();
    expect(getInputShellStyle('Story title').borderColor).toBe(lightColors.danger);
    expect(getInputShellStyle('Place name').borderColor).toBe(lightColors.danger);
    expect(getInputShellStyle('Year').borderColor).toBe(lightColors.danger);
  });

  it('scrolls to the topmost missing required field on failed submit', async () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());

    try {
      renderSubmissionScreen();

      fireEvent(screen.getByTestId('submission-field-title'), 'layout', {
        nativeEvent: { layout: { y: 80 } },
      });
      fireEvent(screen.getByTestId('submission-field-narrative'), 'layout', {
        nativeEvent: { layout: { y: 240 } },
      });
      fireEvent(screen.getByTestId('submission-field-location'), 'layout', {
        nativeEvent: { layout: { y: 430 } },
      });
      fireEvent.changeText(screen.getByLabelText('Story title'), 'The City Walls');

      fireEvent.press(screen.getByText('Submit story'));

      expect(await screen.findByText('Narrative text is required.')).toBeTruthy();
      expect(scrollToSpy).toHaveBeenCalledWith({ y: 224, animated: true });
    } finally {
      scrollToSpy.mockRestore();
    }
  });

  it('scrolls to the year field when only year is missing', async () => {
    const scrollToSpy = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(jest.fn());

    try {
      renderSubmissionScreen();

      fireEvent(screen.getByTestId('submission-field-time'), 'layout', {
        nativeEvent: { layout: { y: 520 } },
      });
      fireEvent(screen.getByTestId('submission-field-year'), 'layout', {
        nativeEvent: { layout: { y: 76 } },
      });
      fireEvent.changeText(screen.getByLabelText('Story title'), 'The City Walls');
      fireEvent.changeText(screen.getByLabelText('Story narrative'), 'A story about the old city walls.');
      fireEvent(screen.getByTestId('story-location-map'), 'press', {
        nativeEvent: { coordinate: { latitude: 41.0082, longitude: 28.9784 } },
      });
      fireEvent.changeText(screen.getByLabelText('Place name'), 'Old City');

      fireEvent.press(screen.getByText('Submit story'));

      expect(await screen.findByText('Year is required.')).toBeTruthy();
      expect(scrollToSpy).toHaveBeenCalledWith({ y: 580, animated: true });
      expect(submissionsService.createStory).not.toHaveBeenCalled();
    } finally {
      scrollToSpy.mockRestore();
    }
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
