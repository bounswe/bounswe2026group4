import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Plus, Search, X } from 'lucide-react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { SearchTag } from '../../features/search/application/services';
import { Input } from '../ui/Input';
import { formatTagLabel, TagChip } from './TagChip';

export const DEFAULT_FROM_YEAR = '1980';
export const DEFAULT_TO_YEAR = '2026';
export const MIN_YEAR = -9999;
export const MAX_YEAR = 2030;
export type ProximityRadiusOption = 0.5 | 1 | 10 | 100;
export interface LocationFilterSuggestion {
  id: string;
  title: string;
  subtitle?: string;
  latitude: number;
  longitude: number;
  bounds?: {
    latMin: number;
    latMax: number;
    lngMin: number;
    lngMax: number;
  };
}

const PROXIMITY_OPTIONS: Array<{ label: string; value?: ProximityRadiusOption }> = [
  { label: 'Anywhere' },
  { label: '500 m', value: 0.5 },
  { label: '1 km', value: 1 },
  { label: '10 km', value: 10 },
  { label: '100 km', value: 100 },
];

function normalizeYearInput(value: string) {
  if (value === '') {
    return value;
  }

  if (!/^-?\d*$/.test(value)) {
    return null;
  }

  if (value.replace('-', '').length > 5) {
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
  selectedTags?: string[];
  tagQuery?: string;
  tagOptions?: SearchTag[];
  isTagsLoading?: boolean;
  hasMedia?: boolean;
  showMediaFilter?: boolean;
  onLocationChange: (value: string) => void;
  locationSuggestions?: LocationFilterSuggestion[];
  onLocationSuggestionPress?: (suggestion: LocationFilterSuggestion) => void;
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  onHasMediaChange?: (value?: boolean) => void;
  onTagQueryChange?: (value: string) => void;
  onToggleTag?: (value: string) => void;
  onRemoveTag?: (value: string) => void;
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
  onTagPickerOpenChange?: (isOpen: boolean) => void;
  extraContent?: React.ReactNode;
}

export function FilterPanel({
  location,
  timeFrom,
  timeTo,
  selectedTags = [],
  tagQuery = '',
  tagOptions = [],
  isTagsLoading = false,
  hasMedia,
  showMediaFilter = false,
  onLocationChange,
  locationSuggestions = [],
  onLocationSuggestionPress,
  onTimeFromChange,
  onTimeToChange,
  onHasMediaChange,
  onTagQueryChange,
  onToggleTag,
  onRemoveTag,
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
  onTagPickerOpenChange,
  extraContent,
}: FilterPanelProps) {
  const { colors, spacing, typography } = useAppTheme();
  const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
  const parsedTimeFrom = timeFrom ? Number(timeFrom) : undefined;
  const parsedTimeTo = timeTo ? Number(timeTo) : undefined;
  const selectableTagOptions = tagOptions.filter((tag) => !selectedTags.includes(tag.name));
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

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Year range</Text>
          <Input
            value={timeFrom}
            onChangeText={handleTimeFromChange}
            onBlur={() => onTimeFromChange(clampYearValue(timeFrom))}
            placeholder="From"
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="From year"
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
                  accessibilityState={{ disabled: Number(timeFrom || DEFAULT_FROM_YEAR) >= MAX_YEAR }}
                  onPress={() => stepYear(timeFrom, onTimeFromChange, 1, DEFAULT_FROM_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: '700' }}>+</Text>
                </Pressable>
              </View>
            }
          />
        </View>
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600', opacity: 0 }}>Year range</Text>
          <Input
            value={timeTo}
            onChangeText={handleTimeToChange}
            onBlur={() => onTimeToChange(clampYearValue(timeTo))}
            placeholder="To"
            keyboardType="numbers-and-punctuation"
            accessibilityLabel="To year"
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
                  accessibilityState={{ disabled: Number(timeTo || DEFAULT_TO_YEAR) >= MAX_YEAR }}
                  onPress={() => stepYear(timeTo, onTimeToChange, 1, DEFAULT_TO_YEAR)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.sm,
                    opacity: pressed ? 0.75 : 1,
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
        <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: typography.caption + 1 }}>
          Start year cannot be later than end year.
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Location</Text>
        <Input
          value={location}
          onChangeText={onLocationChange}
          placeholder="Neighbourhood, district, city..."
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
          <Text
            accessibilityRole={locationStatusText.startsWith('Location not found') ? 'alert' : undefined}
            style={{
              color: locationStatusText.startsWith('Location not found') ? colors.danger : colors.muted,
              fontSize: typography.caption + 1,
            }}
          >
            {locationStatusText}
          </Text>
        ) : null}
        {locationSuggestions.length ? (
          <View
            testID="location-filter-suggestions"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            {locationSuggestions.map((suggestion, index) => (
              <Pressable
                key={suggestion.id}
                accessibilityRole="button"
                accessibilityLabel={`Select location ${suggestion.title}`}
                onPress={() => onLocationSuggestionPress?.(suggestion)}
                style={({ pressed }) => ({
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm + 2,
                  borderTopWidth: index === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.infoSurface : colors.background,
                })}
              >
                <Text style={{ color: colors.text, fontWeight: '700' }}>{suggestion.title}</Text>
                {suggestion.subtitle ? (
                  <Text numberOfLines={2} style={{ marginTop: 2, color: colors.muted, fontSize: typography.caption }}>
                    {suggestion.subtitle}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Distance</Text>
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

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Tags</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {isTagsLoading ? (
              <ActivityIndicator accessibilityLabel="Loading tags" color={colors.primary} size="small" />
            ) : null}
          </View>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {selectedTags.map((tag) => (
            <TagChip
              key={tag}
              label={formatTagLabel(tag)}
              value={tag}
              selected
              removable
              accessibilityLabel={`Remove tag ${formatTagLabel(tag)}`}
              onPress={() => onRemoveTag?.(tag)}
            />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add tag filter"
            accessibilityState={{ expanded: isTagPickerOpen }}
            onTouchStart={(event) => event.stopPropagation()}
            onPress={() => {
              setIsTagPickerOpen((current) => {
                const next = !current;
                onTagPickerOpenChange?.(next);
                return next;
              });
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.sm + spacing.xs,
              paddingVertical: spacing.xs,
              borderRadius: 999,
              borderWidth: 1,
              borderStyle: 'dashed',
              borderColor: colors.muted,
              backgroundColor: colors.background,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Plus size={13} color={colors.muted} strokeWidth={2.4} />
            <Text style={{ color: colors.muted, fontSize: typography.caption + 1, fontWeight: '700' }}>
              Add tag
            </Text>
          </Pressable>
        </View>

        {isTagPickerOpen ? (
          <View
            onTouchStart={(event) => event.stopPropagation()}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 12,
              backgroundColor: colors.background,
              overflow: 'hidden',
            }}
          >
            <View
              onTouchStart={(event) => event.stopPropagation()}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              }}
            >
              <Search size={16} color={colors.muted} strokeWidth={2.2} />
              <TextInput
                value={tagQuery}
                onChangeText={onTagQueryChange ?? (() => {})}
                placeholder="Search tags"
                placeholderTextColor={colors.muted}
                accessibilityLabel="Tag filter search"
                autoCorrect={false}
                autoCapitalize="none"
                style={{
                  flex: 1,
                  minHeight: 40,
                  color: colors.text,
                  fontSize: typography.body,
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close tag picker"
                onPress={() => {
                  setIsTagPickerOpen(false);
                  onTagPickerOpenChange?.(false);
                }}
                style={({ pressed }) => ({
                  padding: spacing.xs,
                  borderRadius: 999,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <X size={14} color={colors.muted} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 220 }}
              contentContainerStyle={{ padding: spacing.xs, gap: spacing.xs }}
              showsVerticalScrollIndicator
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onTouchStart={(event) => event.stopPropagation()}
            >
              {isTagsLoading ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm }}>
                  <ActivityIndicator accessibilityLabel="Loading tags" color={colors.primary} size="small" />
                  <Text style={{ color: colors.muted }}>Loading...</Text>
                </View>
              ) : null}
              {!isTagsLoading && selectableTagOptions.length ? (
                selectableTagOptions.map((tag) => (
                  <Pressable
                    key={tag.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select tag ${tag.name}`}
                    onPress={() => onToggleTag?.(tag.name)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: spacing.xs,
                      borderRadius: 8,
                      backgroundColor: pressed ? colors.infoSurface : colors.background,
                    })}
                  >
                    <TagChip label={formatTagLabel(tag.name)} value={tag.name} />
                    {tag.storyCount !== undefined ? (
                      <Text style={{ color: colors.muted, fontSize: typography.caption }}>
                        {tag.storyCount}
                      </Text>
                    ) : null}
                  </Pressable>
                ))
              ) : null}
              {!isTagsLoading && !selectableTagOptions.length ? (
                <Text style={{ color: colors.muted, padding: spacing.sm }}>No tags found</Text>
              ) : null}
            </ScrollView>
          </View>
        ) : null}
      </View>

      {showMediaFilter ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Image presence</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Only stories with an image"
            accessibilityState={{ selected: hasMedia === true }}
            onPress={() => onHasMediaChange?.(hasMedia === true ? undefined : true)}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: hasMedia === true ? colors.primary : colors.border,
              backgroundColor: hasMedia === true ? colors.infoSurface : colors.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Text style={{ color: hasMedia === true ? colors.primary : colors.text, fontWeight: '700' }}>
              Only stories with an image
            </Text>
          </Pressable>
        </View>
      ) : null}

      {extraContent}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={onClearAll}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Reset filters</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apply filters"
          accessibilityState={{ disabled: isApplyDisabled || hasInvalidRange }}
          disabled={isApplyDisabled || hasInvalidRange}
          onPress={onApply}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: 999,
            backgroundColor: colors.primary,
            opacity: isApplyDisabled || hasInvalidRange ? 0.45 : pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: colors.background, fontWeight: '700' }}>Apply</Text>
        </Pressable>
      </View>
    </View>
  );
}
