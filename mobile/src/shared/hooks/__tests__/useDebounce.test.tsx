import React, { useState } from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { useDebounce } from '../useDebounce';

function DebounceProbe() {
  const [value, setValue] = useState('initial');
  const debouncedValue = useDebounce(value, 200);

  return (
    <>
      <Text testID="debounced-value">{debouncedValue}</Text>
      <Text accessibilityRole="button" onPress={() => setValue('updated')}>
        Update
      </Text>
    </>
  );
}

describe('useDebounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the latest value only after the delay elapses', () => {
    render(<DebounceProbe />);

    expect(screen.getByTestId('debounced-value').props.children).toBe('initial');

    act(() => {
      screen.getByText('Update').props.onPress();
    });

    expect(screen.getByTestId('debounced-value').props.children).toBe('initial');

    act(() => {
      jest.advanceTimersByTime(200);
    });

    expect(screen.getByTestId('debounced-value').props.children).toBe('updated');
  });
});
