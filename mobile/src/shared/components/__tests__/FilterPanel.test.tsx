import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DEFAULT_FROM_YEAR, DEFAULT_TO_YEAR, FilterPanel, MAX_YEAR } from '../FilterPanel';

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

  it('shows the default years as placeholders until selected', () => {
    render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Start year').props.value).toBe('');
    expect(screen.getByLabelText('Start year').props.placeholder).toBe(DEFAULT_FROM_YEAR);
    expect(screen.getByLabelText('End year').props.value).toBe('');
    expect(screen.getByLabelText('End year').props.placeholder).toBe(DEFAULT_TO_YEAR);
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

  it('clamps manual year entries to the supported bounds on blur', () => {
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom="2050"
        timeTo="0999"
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent(screen.getByLabelText('Start year'), 'blur');
    fireEvent(screen.getByLabelText('End year'), 'blur');

    expect(onTimeFromChange).toHaveBeenCalledWith(String(MAX_YEAR));
    expect(onTimeToChange).toHaveBeenCalledWith('1000');
  });

  it('disables increment once the maximum year is reached', () => {
    render(
      <FilterPanel
        location=""
        timeFrom={String(MAX_YEAR)}
        timeTo={String(MAX_YEAR)}
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onClearAll={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Increase start year').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByLabelText('Increase end year').props.accessibilityState.disabled).toBe(true);
  });

  it('increments and decrements year values with the step buttons', () => {
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom="1980"
        timeTo="2026"
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Increase start year'));
    fireEvent.press(screen.getByLabelText('Decrease end year'));

    expect(onTimeFromChange).toHaveBeenCalledWith('1981');
    expect(onTimeToChange).toHaveBeenCalledWith('2025');
  });

  it('activates placeholder years when step buttons are pressed from an empty value', () => {
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

    fireEvent.press(screen.getByLabelText('Increase start year'));
    fireEvent.press(screen.getByLabelText('Decrease end year'));

    expect(onTimeFromChange).toHaveBeenCalledWith('1981');
    expect(onTimeToChange).toHaveBeenCalledWith('2025');
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
