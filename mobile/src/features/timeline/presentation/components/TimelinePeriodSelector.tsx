import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Input } from '../../../../shared';
import { TimelinePeriodPosition } from '../../domain/entities';

export type TimelinePeriodMode = 'all' | 'year' | 'range' | 'decade' | 'period';

export interface TimelinePeriodSelection {
  mode: TimelinePeriodMode;
  year: string;
  rangeFrom: string;
  rangeTo: string;
  decade: string;
  century: string;
  position: TimelinePeriodPosition;
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
  { mode: 'period', label: 'Period' },
];

const QUICK_OPTIONS: Array<{ label: string; value: Partial<TimelinePeriodSelection> & { mode: TimelinePeriodMode } }> = [
  { label: '1453', value: { mode: 'year', year: '1453' } },
  { label: '1914-1918', value: { mode: 'range', rangeFrom: '1914', rangeTo: '1918' } },
  { label: '1920s', value: { mode: 'decade', decade: '1920' } },
  { label: 'Early 1900s', value: { mode: 'period', century: '1900', position: 'early' } },
];

const POSITION_OPTIONS: Array<{ value: TimelinePeriodPosition; label: string }> = [
  { value: 'early', label: 'Early' },
  { value: 'mid', label: 'Mid' },
  { value: 'late', label: 'Late' },
];

export const EMPTY_TIMELINE_PERIOD_SELECTION: TimelinePeriodSelection = {
  mode: 'all',
  year: '',
  rangeFrom: '',
  rangeTo: '',
  decade: '',
  century: '1900',
  position: 'early',
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

  const updateYearField = (field: 'year' | 'rangeFrom' | 'rangeTo' | 'decade' | 'century') => (nextValue: string) => {
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
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Specific year</Text>
            <Input
              value={value.year}
              onChangeText={updateYearField('year')}
              placeholder="e.g. 1923"
              keyboardType="number-pad"
              accessibilityLabel="Timeline year"
            />
          </View>
        );
      case 'range':
        return (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Year range</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input
                value={value.rangeFrom}
                onChangeText={updateYearField('rangeFrom')}
                placeholder="Start"
                keyboardType="number-pad"
                accessibilityLabel="Timeline start year"
                style={{ flex: 1 }}
              />
              <Input
                value={value.rangeTo}
                onChangeText={updateYearField('rangeTo')}
                placeholder="End"
                keyboardType="number-pad"
                accessibilityLabel="Timeline end year"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        );
      case 'decade':
        return (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Decade base year</Text>
            <Input
              value={value.decade}
              onChangeText={updateYearField('decade')}
              placeholder="e.g. 1980"
              keyboardType="number-pad"
              accessibilityLabel="Timeline decade"
            />
          </View>
        );
      case 'period':
        return (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Approximate period</Text>
            <Input
              value={value.century}
              onChangeText={updateYearField('century')}
              placeholder="Century base, e.g. 1900"
              keyboardType="number-pad"
              accessibilityLabel="Timeline century"
            />
            <View accessibilityRole="radiogroup" accessibilityLabel="Approximate period position" style={{ flexDirection: 'row', gap: spacing.sm }}>
              {POSITION_OPTIONS.map((option) => {
                const isSelected = value.position === option.value;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityLabel={`Timeline period ${option.label}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => onChange(mergeSelection(value, { position: option.value }))}
                    style={({ pressed }) => ({
                      flex: 1,
                      alignItems: 'center',
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: isSelected ? colors.text : colors.border,
                      backgroundColor: isSelected ? colors.text : colors.surface,
                      opacity: pressed ? 0.82 : 1,
                    })}
                  >
                    <Text style={{ color: isSelected ? colors.background : colors.text, fontWeight: '800' }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      default:
        return (
          <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
            Showing the full timeline. Use a mode or quick chip to narrow the period.
          </Text>
        );
    }
  };

  return (
    <View
      style={{
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        padding: spacing.md,
        gap: spacing.md,
      }}
    >
      <View style={{ gap: spacing.xs }}>
        <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
          Choose a time window
        </Text>
        <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
          Jump to a year, compare a range, or browse an approximate era.
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Timeline period mode" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
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
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
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

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {QUICK_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityLabel={`Select period ${option.label}`}
            onPress={() => onChange(mergeSelection(value, option.value))}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs + 2,
              borderRadius: 999,
              backgroundColor: colors.background,
              borderWidth: 1,
              borderColor: colors.border,
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontSize: typography.caption + 1, fontWeight: '700' }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
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
