import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { Input } from '../ui/Input';

function normalizeYearInput(value: string) {
  if (value === '') {
    return value;
  }

  if (!/^\d*$/.test(value)) {
    return null;
  }

  if (value.length > 4) {
    return null;
  }

  return value;
}

interface FilterPanelProps {
  location: string;
  timeFrom: string;
  timeTo: string;
  onLocationChange: (value: string) => void;
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  onClearAll: () => void;
}

export function FilterPanel({
  location,
  timeFrom,
  timeTo,
  onLocationChange,
  onTimeFromChange,
  onTimeToChange,
  onClearAll,
}: FilterPanelProps) {
  const { colors, spacing, typography } = useAppTheme();
  const parsedTimeFrom = timeFrom ? Number(timeFrom) : undefined;
  const parsedTimeTo = timeTo ? Number(timeTo) : undefined;
  const hasInvalidRange =
    parsedTimeFrom !== undefined &&
    Number.isFinite(parsedTimeFrom) &&
    parsedTimeTo !== undefined &&
    Number.isFinite(parsedTimeTo) &&
    parsedTimeFrom > parsedTimeTo;

  const handleTimeFromChange = (value: string) => {
    const normalized = normalizeYearInput(value);

    if (normalized === null) {
      return;
    }

    if (normalized && timeTo && Number(normalized) > Number(timeTo)) {
      return;
    }

    onTimeFromChange(normalized);
  };

  const handleTimeToChange = (value: string) => {
    const normalized = normalizeYearInput(value);

    if (normalized === null) {
      return;
    }

    if (normalized && timeFrom && Number(normalized) < Number(timeFrom)) {
      return;
    }

    onTimeToChange(normalized);
  };

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
          Filters
        </Text>
        <Text style={{ color: colors.muted }}>
          Search and all selected filters combine with AND logic.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Location</Text>
        <Input
          value={location}
          onChangeText={onLocationChange}
          placeholder="Neighborhood, district, or city"
          accessibilityLabel="Location filter"
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>From year</Text>
          <Input
            value={timeFrom}
            onChangeText={handleTimeFromChange}
            placeholder="1900"
            keyboardType="number-pad"
            accessibilityLabel="Start year"
          />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>To year</Text>
          <Input
            value={timeTo}
            onChangeText={handleTimeToChange}
            placeholder="2024"
            keyboardType="number-pad"
            accessibilityLabel="End year"
          />
        </View>
      </View>

      {hasInvalidRange ? (
        <Text style={{ color: colors.danger, fontSize: typography.caption + 1 }}>
          Start year cannot be later than end year.
        </Text>
      ) : null}

      <Pressable accessibilityRole="button" onPress={onClearAll}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>Reset filter form</Text>
      </Pressable>
    </View>
  );
}
