import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterPanel, MAX_YEAR, MIN_YEAR } from '../FilterPanel';

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
    fireEvent.changeText(screen.getByLabelText('From year'), '1900');
    fireEvent.changeText(screen.getByLabelText('To year'), '1950');

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

    expect(screen.getByLabelText('From year').props.value).toBe('');
    expect(screen.getByLabelText('From year').props.placeholder).toBe('From');
    expect(screen.getByLabelText('To year').props.value).toBe('');
    expect(screen.getByLabelText('To year').props.placeholder).toBe('To');
  });

  it('accepts signed five-digit-or-shorter numeric years for BC ranges', () => {
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

    fireEvent.changeText(screen.getByLabelText('From year'), '200');
    fireEvent.changeText(screen.getByLabelText('To year'), '9999');
    fireEvent.changeText(screen.getByLabelText('From year'), '-200');
    fireEvent.changeText(screen.getByLabelText('From year'), 'fvbnj');
    fireEvent.changeText(screen.getByLabelText('From year'), '999999');
    fireEvent.changeText(screen.getByLabelText('To year'), '-100000');

    expect(onTimeFromChange).toHaveBeenCalledWith('200');
    expect(onTimeToChange).toHaveBeenCalledWith('9999');
    expect(onTimeFromChange).toHaveBeenCalledWith('-200');
    expect(onTimeFromChange).not.toHaveBeenCalledWith('fvbnj');
    expect(onTimeFromChange).not.toHaveBeenCalledWith('999999');
    expect(onTimeToChange).not.toHaveBeenCalledWith('-100000');
  });

  it('clamps manual year entries to the supported bounds on blur', () => {
    const onTimeFromChange = jest.fn();
    const onTimeToChange = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom="2050"
        timeTo="-12000"
        onLocationChange={jest.fn()}
        onTimeFromChange={onTimeFromChange}
        onTimeToChange={onTimeToChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent(screen.getByLabelText('From year'), 'blur');
    fireEvent(screen.getByLabelText('To year'), 'blur');

    expect(onTimeFromChange).toHaveBeenCalledWith(String(MAX_YEAR));
    expect(onTimeToChange).toHaveBeenCalledWith(String(MIN_YEAR));
  });

  it('toggles the with image filter', () => {
    const onHasMediaChange = jest.fn();

    const { rerender } = render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        hasMedia={undefined}
        showMediaFilter
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onHasMediaChange={onHasMediaChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Only stories with an image'));

    expect(onHasMediaChange).toHaveBeenCalledWith(true);

    rerender(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        hasMedia
        showMediaFilter
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onHasMediaChange={onHasMediaChange}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Only stories with an image'));

    expect(onHasMediaChange).toHaveBeenCalledWith(undefined);
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

  it('allows entering a to year even before the from year and shows the range warning', () => {
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

    fireEvent.changeText(screen.getByLabelText('From year'), '1900');

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

    fireEvent.changeText(screen.getByLabelText('To year'), '1800');
    fireEvent.changeText(screen.getByLabelText('To year'), '1950');

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

    fireEvent.press(screen.getByText('Reset filters'));

    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('supports tag search, selection, and chip removal', () => {
    const onTagQueryChange = jest.fn();
    const onToggleTag = jest.fn();
    const onRemoveTag = jest.fn();

    render(
      <FilterPanel
        location=""
        timeFrom=""
        timeTo=""
        selectedTags={['folklore']}
        tagQuery=""
        tagOptions={[
          { id: 'folklore', name: 'folklore', storyCount: 2 },
          { id: 'ottoman-era', name: 'ottoman-era', storyCount: 5 },
        ]}
        onLocationChange={jest.fn()}
        onTimeFromChange={jest.fn()}
        onTimeToChange={jest.fn()}
        onTagQueryChange={onTagQueryChange}
        onToggleTag={onToggleTag}
        onRemoveTag={onRemoveTag}
        onClearAll={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Add tag filter'));
    fireEvent.changeText(screen.getByLabelText('Tag filter search'), 'ottoman');
    fireEvent.press(screen.getByLabelText('Select tag ottoman-era'));
    fireEvent.press(screen.getByLabelText('Remove tag Folklore'));

    expect(screen.getByText('5')).toBeTruthy();
    expect(onTagQueryChange).toHaveBeenCalledWith('ottoman');
    expect(onToggleTag).toHaveBeenCalledWith('ottoman-era');
    expect(onRemoveTag).toHaveBeenCalledWith('folklore');
  });
});
