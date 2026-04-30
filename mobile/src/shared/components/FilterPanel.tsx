import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { Input } from '../ui/Input';

export const DEFAULT_FROM_YEAR = '1980';
export const DEFAULT_TO_YEAR = '2026';
export const MIN_YEAR = 1000;
export const MAX_YEAR = 2030;
export type ProximityRadiusOption = 1 | 10 | 100;

const PROXIMITY_OPTIONS: Array<{ label: string; value?: ProximityRadiusOption }> = [
  { label: 'Anywhere' },
  { label: '1 km', value: 1 },
  { label: '10 km', value: 10 },
  { label: '100 km', value: 100 },
];

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

function clampYearValue(value: string) {
  if (!value.trim()) {
    return value;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return value;
  }

  return String(Math.min(MAX_YEAR, Math.max(MIN_YEAR, parsed)));
}

interface FilterPanelProps {
  location: string;
  timeFrom: string;
  timeTo: string;
  onLocationChange: (value: string) => void;
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  onClearAll: () => void;
  onApply?: () => void;
  proximityRadiusKm?: ProximityRadiusOption;
  onProximityRadiusChange?: (value?: ProximityRadiusOption) => void;
  isProximityResolving?: boolean;
  proximityStatusText?: string;
  isProximityError?: boolean;
  isLocationResolving?: boolean;
  locationStatusText?: string;
  isApplyDisabled?: boolean;
}

export function FilterPanel({
  location,
  timeFrom,
  timeTo,
  onLocationChange,
  onTimeFromChange,
  onTimeToChange,
  onClearAll,
  onApply,
  proximityRadiusKm,
  onProximityRadiusChange,
  isProximityResolving = false,
  proximityStatusText,
  isProximityError = false,
  isLocationResolving = false,
  locationStatusText,
  isApplyDisabled = false,
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

    onTimeFromChange(normalized);
  };

  const handleTimeToChange = (value: string) => {
    const normalized = normalizeYearInput(value);

    if (normalized === null) {
      return;
    }

    onTimeToChange(normalized);
  };

  const stepYear = (
    currentValue: string,
    nextValue: (value: string) => void,
    delta: number,
    fallbackValue: string,
  ) => {
    const baseValue = currentValue.trim() ? Number(currentValue) : Number(fallbackValue);
    const clamped = Math.min(MAX_YEAR, Math.max(MIN_YEAR, baseValue + delta));
    nextValue(String(clamped));
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
          trailingElement={
            isLocationResolving ? (
              <ActivityIndicator
                accessibilityLabel="Resolving location"
                color={colors.primary}
                size="small"
              />
            ) : undefined
          }
        />
        {locationStatusText ? (
          <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
            {locationStatusText}
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Proximity</Text>
          {isProximityResolving ? (
            <ActivityIndicator
              accessibilityLabel="Fetching current location"
              color={colors.primary}
              size="small"
            />
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {PROXIMITY_OPTIONS.map((option) => {
            const isSelected = proximityRadiusKm === option.value || (!proximityRadiusKm && !option.value);

            return (
              <Pressable
                key={option.label}
                accessibilityRole="button"
                accessibilityLabel={`Distance ${option.label}`}
                accessibilityState={{ selected: isSelected, disabled: isProximityResolving }}
                disabled={isProximityResolving}
                onPress={() => onProximityRadiusChange?.(option.value)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: isSelected ? colors.primary : colors.border,
                  backgroundColor: isSelected ? colors.infoSurface : colors.surface,
                  opacity: isProximityResolving ? 0.55 : pressed ? 0.75 : 1,
                })}
              >
                <Text style={{ color: isSelected ? colors.primary : colors.text, fontWeight: '700' }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {proximityStatusText ? (
          <Text
            accessibilityRole={isProximityError ? 'alert' : undefined}
            style={{
              color: isProximityError ? colors.danger : colors.muted,
              fontSize: typography.caption + 1,
            }}
          >
            {proximityStatusText}
          </Text>
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>From year</Text>
          <Input
            value={timeFrom}
            onChangeText={handleTimeFromChange}
            onBlur={() => onTimeFromChange(clampYearValue(timeFrom))}
            placeholder={DEFAULT_FROM_YEAR}
            keyboardType="number-pad"
            accessibilityLabel="Start year"
            trailingElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease start year"
                  onPress={() => stepYear(timeFrom, onTimeFromChange, -1, DEFAULT_FROM_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>-</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase start year"
                  disabled={Number(clampYearValue(timeFrom || DEFAULT_FROM_YEAR)) >= MAX_YEAR}
                  onPress={() => stepYear(timeFrom, onTimeFromChange, 1, DEFAULT_FROM_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity:
                      Number(clampYearValue(timeFrom || DEFAULT_FROM_YEAR)) >= MAX_YEAR ? 0.4 : pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>+</Text>
                </Pressable>
              </View>
            }
          />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>To year</Text>
          <Input
            value={timeTo}
            onChangeText={handleTimeToChange}
            onBlur={() => onTimeToChange(clampYearValue(timeTo))}
            placeholder={DEFAULT_TO_YEAR}
            keyboardType="number-pad"
            accessibilityLabel="End year"
            trailingElement={
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: spacing.xs }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Decrease end year"
                  onPress={() => stepYear(timeTo, onTimeToChange, -1, DEFAULT_TO_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>-</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase end year"
                  disabled={Number(clampYearValue(timeTo || DEFAULT_TO_YEAR)) >= MAX_YEAR}
                  onPress={() => stepYear(timeTo, onTimeToChange, 1, DEFAULT_TO_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity:
                      Number(clampYearValue(timeTo || DEFAULT_TO_YEAR)) >= MAX_YEAR ? 0.4 : pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>+</Text>
                </Pressable>
              </View>
            }
          />
        </View>
      </View>

      {hasInvalidRange ? (
        <Text style={{ color: colors.danger, fontSize: typography.caption + 1 }}>
          Start year cannot be later than end year.
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={onClearAll}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Reset filter form</Text>
        </Pressable>
        {onApply ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
            disabled={isApplyDisabled}
            onPress={onApply}
            style={{
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              backgroundColor: colors.primary,
              opacity: isApplyDisabled ? 0.55 : 1,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Apply</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
