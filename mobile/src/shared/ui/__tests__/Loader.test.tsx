import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Loader } from '../Loader';

describe('Loader', () => {
  it('renders the default loading message', () => {
    render(<Loader />);

    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders a custom message', () => {
    render(<Loader message="Loading stories..." />);

    expect(screen.getByText('Loading stories...')).toBeTruthy();
  });
});
