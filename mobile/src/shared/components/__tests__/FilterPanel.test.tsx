import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterPanel } from '../FilterPanel';

describe('FilterPanel', () => {
  it('forwards location and valid year filter updates', () => {
    const onLocationChange = jest.fn();
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        onLocationChange={onLocationChange}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Location filter'), 'Fatih');
    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');

    expect(onLocationChange).toHaveBeenCalledWith('Fatih');
    expect(onTimeFromChange).toHaveBeenCalledWith('1900');
    expect(onTimeToChange).toHaveBeenCalledWith('1950');
  });

  it('accepts only positive four-digit-or-shorter numeric years', () => {
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Start year'), '200');
    fireEvent.changeText(screen.getByLabelText('End year'), '9999');
    fireEvent.changeText(screen.getByLabelText('Start year'), '-200');
    fireEvent.changeText(screen.getByLabelText('Start year'), 'fvbnj');
    fireEvent.changeText(screen.getByLabelText('Start year'), '99999');
    fireEvent.changeText(screen.getByLabelText('End year'), '10000');

    expect(onTimeFromChange).toHaveBeenCalledWith('200');
    expect(onTimeToChange).toHaveBeenCalledWith('9999');
    expect(onTimeFromChange).not.toHaveBeenCalledWith('-200');
    expect(onTimeFromChange).not.toHaveBeenCalledWith('fvbnj');
    expect(onTimeFromChange).not.toHaveBeenCalledWith('99999');
    expect(onTimeToChange).not.toHaveBeenCalledWith('10000');
  });

  it('allows entering an end year even before the start year and shows the range warning', () => {
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    const { rerender } = render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');

    expect(onTimeFromChange).toHaveBeenCalledWith('1900');

    rerender(
      <FilterPanel
        location=""
        timeFrom="1900"
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('End year'), '1800');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');

    expect(onTimeToChange).toHaveBeenCalledWith('1800');
    expect(onTimeToChange).toHaveBeenCalledWith('1950');

    rerender(
      <FilterPanel
        location=""
        timeFrom="1900"
        timeTo="1800"
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    expect(screen.getByText('Start year cannot be later than end year.')).toBeTruthy();
  });

  it('resets the filter form', () => {
    const onClearAll = jest.fn();

    render(
      <FilterPanel
        location="Istanbul"
        timeFrom="1900"
        timeTo="1950"
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onClearAll={onClearAll}
      />,
    );

    fireEvent.press(screen.getByText('Reset filter form'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });
});
