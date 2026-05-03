import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Input } from '../../../../shared';

export type TimelinePeriodMode = 'all' | 'year' | 'range' | 'decade';

export interface TimelinePeriodSelection {
  mode: TimelinePeriodMode;
  year: string;
  rangeFrom: string;
  rangeTo: string;
  decade: string;
}

interface TimelinePeriodSelectorProps {
  value: TimelinePeriodSelection;
  onChange: (nextValue: TimelinePeriodSelection) => void;
  error?: string;
}

const MODE_OPTIONS: Array<{ mode: TimelinePeriodMode; label: string }> = [
  { mode: 'all', label: 'All' },
  { mode: 'year', label: 'Year' },
  { mode: 'range', label: 'Range' },
  { mode: 'decade', label: 'Decade' },
];

export const EMPTY_TIMELINE_PERIOD_SELECTION: TimelinePeriodSelection = {
  mode: 'all',
  year: '',
  rangeFrom: '',
  rangeTo: '',
  decade: '',
};

function normalizeYearInput(value: string) {
  if (value === '') {
    return value;
  }

  if (!/^\d{0,4}$/.test(value)) {
    return null;
  }

  return value;
}

function mergeSelection(
  current: TimelinePeriodSelection,
  patch: Partial<TimelinePeriodSelection> & { mode?: TimelinePeriodMode },
) {
  return {
    ...current,
    ...patch,
  };
}

export function TimelinePeriodSelector({ value, onChange, error }: TimelinePeriodSelectorProps) {
  const { colors, spacing, typography } = useAppTheme();

  const updateYearField = (field: 'year' | 'rangeFrom' | 'rangeTo' | 'decade') => (nextValue: string) => {
    const normalized = normalizeYearInput(nextValue);

    if (normalized === null) {
      return;
    }

    onChange(mergeSelection(value, { [field]: normalized }));
  };

  const renderModeSpecificControls = () => {
    switch (value.mode) {
      case 'year':
        return (
          <View style={{ gap: spacing.xs }}>
            <Input
              value={value.year}
              onChangeText={updateYearField('year')}
              placeholder="Year, e.g. 1923"
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel="Timeline year"
            />
          </View>
        );
      case 'range':
        return (
          <View style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input
                value={value.rangeFrom}
                onChangeText={updateYearField('rangeFrom')}
                placeholder="Start"
                keyboardType="number-pad"
                returnKeyType="done"
                accessibilityLabel="Timeline start year"
                style={{ flex: 1 }}
              />
              <Input
                value={value.rangeTo}
                onChangeText={updateYearField('rangeTo')}
                placeholder="End"
                keyboardType="number-pad"
                returnKeyType="done"
                accessibilityLabel="Timeline end year"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        );
      case 'decade':
        return (
          <View style={{ gap: spacing.xs }}>
            <Input
              value={value.decade}
              onChangeText={updateYearField('decade')}
              placeholder="Decade, e.g. 1980"
              keyboardType="number-pad"
              returnKeyType="done"
              accessibilityLabel="Timeline decade"
            />
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.sm + 2,
        gap: spacing.sm,
      }}
    >
      <View>
        <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '800' }}>
          Choose a time window
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Timeline period mode" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {MODE_OPTIONS.map((option) => {
          const isSelected = value.mode === option.mode;

          return (
            <Pressable
              key={option.mode}
              accessibilityRole="radio"
              accessibilityLabel={`Timeline mode ${option.label}`}
              accessibilityState={{ selected: isSelected }}
              onPress={() => onChange(mergeSelection(value, { mode: option.mode }))}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.sm + 2,
                paddingVertical: spacing.xs + 2,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: isSelected ? colors.text : colors.border,
                backgroundColor: isSelected ? colors.text : colors.background,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: isSelected ? colors.background : colors.text, fontWeight: '800' }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {renderModeSpecificControls()}

      {error ? (
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: typography.caption + 1 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
