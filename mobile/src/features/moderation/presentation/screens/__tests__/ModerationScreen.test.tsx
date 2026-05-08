import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ModerationScreen } from '../ModerationScreen';
import { AdminPage, AdminReport, AdminStory, AdminTag, adminService } from '../../../application/services';

const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
let mockRole: 'user' | 'admin' = 'admin';

jest.mock('../../../../auth', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'admin@example.com',
      username: 'Admin',
      role: mockRole,
    },
  }),
}));

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

const report: AdminReport = {
  id: '10',
  reporter: {
    id: '2',
    username: 'Reporter',
    email: 'reporter@example.com',
  },
  targetType: 'story',
  targetId: '7',
  reason: 'spam',
  description: 'Promotional content',
  status: 'pending',
  createdAt: '2026-05-01T12:00:00Z',
};

const story: AdminStory = {
  id: '7',
  title: 'Unsafe Story',
  contributorName: 'Writer',
  locationName: 'Istanbul',
  status: 'published',
  submittedAt: '2026-05-01T12:00:00Z',
};

const tag: AdminTag = {
  id: '5',
  name: 'spam-tag',
  storyCount: 3,
};

function page<T>(items: T[], overrides: Partial<AdminPage<T>> = {}): AdminPage<T> {
  return {
    items,
    page: 1,
    totalCount: items.length,
    hasNextPage: false,
    ...overrides,
  };
}

function createService(overrides: Partial<typeof adminService> = {}): typeof adminService {
  return {
    getReports: jest.fn(async () => page([report])),
    resolveReport: jest.fn(async () => ({
      ...report,
      status: 'resolved' as const,
      resolutionOutcome: 'No action',
    })),
    getStories: jest.fn(async () => page([story])),
    removeStory: jest.fn(async () => undefined),
    banUser: jest.fn(async () => undefined),
    getTags: jest.fn(async () => page([tag])),
    removeTag: jest.fn(async () => undefined),
    ...overrides,
  };
}

describe('ModerationScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRole = 'admin';
  });

  it('blocks non-admin users', () => {
    mockRole = 'user';

    render(<ModerationScreen service={createService()} />);

    expect(screen.getByText('Not authorized')).toBeTruthy();
    expect(screen.getByText('Only admins can access moderation tools.')).toBeTruthy();
  });

  it('lists reports, filters by status, and resolves a report', async () => {
    const service = createService();
    const onOpenStory = jest.fn();

    render(<ModerationScreen service={service} onOpenStory={onOpenStory} />);

    expect(await screen.findByText('story #7')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open reported story 7'));
    expect(onOpenStory).toHaveBeenCalledWith('7');

    expect(service.getReports).toHaveBeenLastCalledWith({ page: 1, status: 'pending' });

    fireEvent.press(screen.getByLabelText('Report status: All'));

    await waitFor(() => {
      expect(service.getReports).toHaveBeenLastCalledWith({ page: 1, status: 'all' });
    });

    fireEvent.press(screen.getByLabelText('Resolve report 10 with no action'));

    await waitFor(() => {
      expect(service.resolveReport).toHaveBeenCalledWith('10', 'no_action');
      expect(mockToastSuccess).toHaveBeenCalledWith('Report resolved.');
    });
  });

  it('opens reported comments on their parent story when story metadata is available', async () => {
    const commentReport: AdminReport = {
      ...report,
      id: '11',
      targetType: 'comment',
      targetId: '99',
      targetStoryId: '7',
    };
    const service = createService({
      getReports: jest.fn(async () => page([commentReport])),
    });
    const onOpenComment = jest.fn();

    render(<ModerationScreen service={service} onOpenComment={onOpenComment} />);

    expect(await screen.findByText('comment #99')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open reported comment 99'));

    expect(onOpenComment).toHaveBeenCalledWith('7', '99');
  });

  it('requires a reason before removing a story', async () => {
    const service = createService();
    const onOpenStory = jest.fn();

    render(<ModerationScreen service={service} onOpenStory={onOpenStory} />);

    fireEvent.press(await screen.findByLabelText('Stories tab'));
    expect(await screen.findByText('Unsafe Story')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Open story Unsafe Story'));
    expect(onOpenStory).toHaveBeenCalledWith('7');

    fireEvent.press(screen.getByLabelText('Remove story Unsafe Story'));
    fireEvent.press(screen.getByText('Remove story'));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('A removal reason is required.');
    });
    expect(service.removeStory).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByLabelText('Removal reason'), 'Harassment');
    fireEvent.press(screen.getByText('Remove story'));

    await waitFor(() => {
      expect(service.removeStory).toHaveBeenCalledWith('7', 'Harassment');
      expect(mockToastSuccess).toHaveBeenCalledWith('Story removed.');
    });
  });

  it('removes tags after confirmation', async () => {
    const service = createService();

    render(<ModerationScreen service={service} />);

    fireEvent.press(await screen.findByLabelText('Tags tab'));
    expect(await screen.findByText('spam-tag')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove tag spam-tag'));
    fireEvent.press(screen.getByText('Remove tag'));

    await waitFor(() => {
      expect(service.removeTag).toHaveBeenCalledWith('5');
      expect(mockToastSuccess).toHaveBeenCalledWith('Tag removed.');
    });
  });
});
