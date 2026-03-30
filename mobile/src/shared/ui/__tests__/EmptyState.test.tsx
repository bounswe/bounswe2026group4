import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders default content', () => {
    render(<EmptyState />);

    expect(screen.getByText('Nothing here yet')).toBeTruthy();
    expect(screen.getByText('Content will appear here when it becomes available.')).toBeTruthy();
  });

  it('renders custom content', () => {
    render(<EmptyState title="No feed items" message="Try refreshing later." />);

    expect(screen.getByText('No feed items')).toBeTruthy();
    expect(screen.getByText('Try refreshing later.')).toBeTruthy();
  });

  it('triggers action callback', () => {
    const onAction = jest.fn();

    render(<EmptyState onAction={onAction} actionLabel="Refresh feed" />);
    fireEvent.press(screen.getByText('Refresh feed'));

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
