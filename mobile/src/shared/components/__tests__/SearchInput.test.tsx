import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  it('renders the current query and forwards text changes', () => {
    const onChangeText = jest.fn();

    render(<SearchInput value="harbor" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByLabelText('Search stories'), 'market');

    expect(onChangeText).toHaveBeenCalledWith('market');
  });

  it('runs the explicit search action from the button', () => {
    const onSearch = jest.fn();

    render(<SearchInput value="" onChangeText={jest.fn()} onSearch={onSearch} />);

    fireEvent.press(screen.getByLabelText('Apply search'));

    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
