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

  it('blocks negative, non-numeric, and 5-digit year input', () => {
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

    fireEvent.changeText(screen.getByLabelText('Start year'), '-200');
    fireEvent.changeText(screen.getByLabelText('Start year'), 'fvbnj');
    fireEvent.changeText(screen.getByLabelText('Start year'), '99999');
    fireEvent.changeText(screen.getByLabelText('End year'), '10000');

    expect(onTimeFromChange).not.toHaveBeenCalled();
    expect(onTimeToChange).not.toHaveBeenCalled();
  });

  it('allows a start year without an end year and blocks end years earlier than the start year', () => {
    const onTimeToChange = jest.fn();

    const { rerender } = render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Start year'), '1900');
    expect(onTimeToChange).not.toHaveBeenCalled();

    rerender(
      <FilterPanel
        location=""
        timeFrom="1900"
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('End year'), '1800');
    fireEvent.changeText(screen.getByLabelText('End year'), '1950');

    expect(onTimeToChange).not.toHaveBeenCalledWith('1800');
    expect(onTimeToChange).toHaveBeenCalledWith('1950');
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
