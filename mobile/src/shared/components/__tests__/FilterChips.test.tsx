import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterChips } from '../FilterChips';

describe('FilterChips', () => {
  it('removes a single active filter chip', () => {
    const onRemove = jest.fn();

    render(
      <FilterChips
        chips={[{ key: 'location', label: 'Location: Beyoglu' }]}
        onRemove={onRemove}
      />,
    );

    fireEvent.press(screen.getByLabelText('Remove Location: Beyoglu'));

    expect(onRemove).toHaveBeenCalledWith('location');
  });

  it('clears all active filters', () => {
    const onClearAll = jest.fn();

    render(
      <FilterChips
        chips={[{ key: 'query', label: 'Search: harbor' }]}
        onRemove={jest.fn()}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.press(screen.getByText('Clear all filters'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
