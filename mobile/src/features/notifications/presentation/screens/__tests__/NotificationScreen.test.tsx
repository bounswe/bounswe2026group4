import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NotificationScreen } from '../NotificationScreen';
import { NotificationEntity } from '../../../domain/entities';

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

const unreadLike: NotificationEntity = {
  id: '1',
  type: 'new_like',
  message: 'Aylin liked your story.',
  actor: { id: '12', username: 'Aylin' },
  storyId: '44',
  isRead: false,
  createdAt: '2026-04-30T12:00:00Z',
};

const readBadge: NotificationEntity = {
  id: '2',
  type: 'badge_earned',
  message: 'You earned the Archivist badge.',
  actor: null,
  isRead: true,
  createdAt: '2026-04-29T12:00:00Z',
};

describe('NotificationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notifications newest first with unread count and event labels', async () => {
    render(
      <NotificationScreen
        getNotifications={async () => [readBadge, unreadLike]}
      />,
    );

    expect(await screen.findByText('1 unread')).toBeTruthy();
    expect(screen.getByText('Like')).toBeTruthy();
    expect(screen.getByText('Badge')).toBeTruthy();
    expect(screen.getByText('Aylin liked your story.')).toBeTruthy();
    expect(screen.getByText('You earned the Archivist badge.')).toBeTruthy();

    const notificationRows = screen.getAllByRole('button').filter((row) =>
      String(row.props.accessibilityLabel ?? '').includes('notification:'),
    );
    expect(notificationRows[0].props.accessibilityLabel).toContain('Aylin liked your story.');
  });

  it('marks an individual notification as read and navigates to related story', async () => {
    const markAsRead = jest.fn(async () => ({ ...unreadLike, isRead: true }));
    const onOpenStory = jest.fn();
    const onNotificationsChanged = jest.fn();

    render(
      <NotificationScreen
        getNotifications={async () => [unreadLike]}
        markAsRead={markAsRead}
        onOpenStory={onOpenStory}
        onNotificationsChanged={onNotificationsChanged}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Unread notification: Aylin liked your story.'));

    await waitFor(() => {
      expect(markAsRead).toHaveBeenCalledWith('1');
      expect(onOpenStory).toHaveBeenCalledWith('44');
      expect(onNotificationsChanged).toHaveBeenLastCalledWith([{ ...unreadLike, isRead: true }]);
    });
  });

  it('marks all notifications as read', async () => {
    const markAllAsRead = jest.fn(async () => [{ ...unreadLike, isRead: true }, readBadge]);

    render(
      <NotificationScreen
        getNotifications={async () => [unreadLike, readBadge]}
        markAllAsRead={markAllAsRead}
      />,
    );

    fireEvent.press(await screen.findByLabelText('Mark all notifications as read'));

    await waitFor(() => {
      expect(markAllAsRead).toHaveBeenCalledTimes(1);
      expect(screen.getByText('All caught up')).toBeTruthy();
      expect(mockToastSuccess).toHaveBeenCalledWith('All notifications marked as read.');
    });
  });

  it('shows an empty state when there are no notifications', async () => {
    render(<NotificationScreen getNotifications={async () => []} />);

    expect(await screen.findByText('No notifications yet')).toBeTruthy();
  });
});
