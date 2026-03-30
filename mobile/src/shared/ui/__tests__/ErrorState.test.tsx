import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
  it('renders default content', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Please try again in a moment.')).toBeTruthy();
  });

  it('renders custom content', () => {
    render(<ErrorState title="Failed to load stories" message="Server unavailable." />);

    expect(screen.getByText('Failed to load stories')).toBeTruthy();
    expect(screen.getByText('Server unavailable.')).toBeTruthy();
  });

  it('triggers retry callback', () => {
    const onRetry = jest.fn();

    render(<ErrorState onRetry={onRetry} retryLabel="Retry request" />);
    fireEvent.press(screen.getByText('Retry request'));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
