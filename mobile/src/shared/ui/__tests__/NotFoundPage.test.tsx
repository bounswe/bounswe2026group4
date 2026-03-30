import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { NotFoundPage } from '../NotFoundPage';

describe('NotFoundPage', () => {
  it('renders default content', () => {
    render(<NotFoundPage />);

    expect(screen.getByText('404')).toBeTruthy();
    expect(screen.getByText('Page not found')).toBeTruthy();
  });

  it('renders custom content', () => {
    render(<NotFoundPage title="Story missing" message="This story no longer exists." />);

    expect(screen.getByText('Story missing')).toBeTruthy();
    expect(screen.getByText('This story no longer exists.')).toBeTruthy();
  });

  it('triggers go back callback', () => {
    const onGoBack = jest.fn();

    render(<NotFoundPage onGoBack={onGoBack} actionLabel="Back to feed" />);
    fireEvent.press(screen.getByText('Back to feed'));

    expect(onGoBack).toHaveBeenCalledTimes(1);
  });
});
