import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NotificationPreferencesSection } from '../NotificationPreferencesSection';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('../../../../../shared/hooks/useToast', () => ({
  useToast: () => ({
    toast: {
      success: mockToastSuccess,
      error: mockToastError,
      info: jest.fn(),
      show: jest.fn(),
    },
  }),
}));

const preferences = {
  notificationsMuted: false,
  preferences: {
    new_comment: true,
    new_like: true,
    moderation_action: true,
    story_removed: true,
    report_resolved: true,
    badge_earned: true,
  },
};

describe('NotificationPreferencesSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all supported notification type toggles and saves changes', async () => {
    const updatePreferences = jest.fn(async (input) => ({
      notificationsMuted: Boolean(input.notificationsMuted),
      preferences: {
        ...preferences.preferences,
        new_like: Boolean(input.new_like),
      },
    }));

    render(
      <NotificationPreferencesSection
        getPreferences={async () => preferences}
        updatePreferences={updatePreferences}
      />,
    );

    expect(await screen.findByText('Notification preferences')).toBeTruthy();
    expect(screen.queryByLabelText('Like')).toBeNull();
    fireEvent.press(screen.getByText('Edit'));

    expect(await screen.findByLabelText('Comment')).toBeTruthy();
    expect(screen.getByLabelText('Like')).toBeTruthy();
    expect(screen.getByLabelText('Moderation')).toBeTruthy();
    expect(screen.getByLabelText('Removed story')).toBeTruthy();
    expect(screen.getByLabelText('Report update')).toBeTruthy();
    expect(screen.getByLabelText('Badge')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Like'));
    fireEvent.press(screen.getByText('Save Notification Preferences'));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ new_like: false }));
      expect(mockToastSuccess).toHaveBeenCalledWith('Notification preferences saved.');
    });
  });

  it('supports the global stop all notifications toggle', async () => {
    const updatePreferences = jest.fn(async (input) => ({
      notificationsMuted: Boolean(input.notificationsMuted),
      preferences: preferences.preferences,
    }));

    render(
      <NotificationPreferencesSection
        getPreferences={async () => preferences}
        updatePreferences={updatePreferences}
      />,
    );

    fireEvent.press(await screen.findByText('Edit'));
    fireEvent.press(await screen.findByLabelText('Stop all notifications'));
    fireEvent.press(screen.getByText('Save Notification Preferences'));

    await waitFor(() => {
      expect(updatePreferences).toHaveBeenCalledWith(expect.objectContaining({ notificationsMuted: true }));
    });
  });

  it('collapses preferences when closed', async () => {
    render(<NotificationPreferencesSection getPreferences={async () => preferences} />);

    fireEvent.press(await screen.findByText('Edit'));
    expect(await screen.findByLabelText('Like')).toBeTruthy();

    fireEvent.press(screen.getByText('Close'));

    expect(screen.queryByLabelText('Like')).toBeNull();
  });
});
