import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { DEFAULT_FROM_YEAR, DEFAULT_TO_YEAR, FilterPanel } from '../../../../shared/components/FilterPanel';
import { FilterChipItem, FilterChips } from '../../../../shared/components/FilterChips';
import { SearchInput } from '../../../../shared/components/SearchInput';
import { SearchFilterScope, useSearchFilters } from '../context/SearchFiltersContext';

function buildChips(
  filters: ReturnType<typeof useSearchFilters>['filters'],
): FilterChipItem[] {
  const chips: FilterChipItem[] = [];

  if (filters.query.trim()) {
    chips.push({ key: 'query', label: `Search: ${filters.query.trim()}` });
  }

  if (filters.location.trim()) {
    chips.push({ key: 'location', label: `Location: ${filters.location.trim()}` });
  }

  if (filters.timeFrom.trim()) {
    chips.push({ key: 'timeFrom', label: `From: ${filters.timeFrom.trim()}` });
  }

  if (filters.timeTo.trim()) {
    chips.push({ key: 'timeTo', label: `To: ${filters.timeTo.trim()}` });
  }

  return chips;
}

interface StorySearchControlsProps {
  helperText?: string;
  hideHeading?: boolean;
  scope: SearchFilterScope;
}

export function StorySearchControls({ helperText, hideHeading = false, scope }: StorySearchControlsProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, updateFilters, removeFilter, clearFilters, applyFilters } = useSearchFilters(scope);
  const [showFilters, setShowFilters] = useState(false);
  const [draftLocation, setDraftLocation] = useState('');
  const [draftTimeFrom, setDraftTimeFrom] = useState(DEFAULT_FROM_YEAR);
  const [draftTimeTo, setDraftTimeTo] = useState(DEFAULT_TO_YEAR);

  const chips = useMemo(() => buildChips(filters), [filters]);

  const openFilters = () => {
    setDraftLocation(filters.location);
    setDraftTimeFrom(filters.timeFrom || DEFAULT_FROM_YEAR);
    setDraftTimeTo(filters.timeTo || DEFAULT_TO_YEAR);
    setShowFilters(true);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {hideHeading ? null : (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
            Search stories
          </Text>
          {helperText ? <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>{helperText}</Text> : null}
        </View>
      )}

      <SearchInput
        value={filters.query}
        onChangeText={(query) => updateFilters({ query })}
        onSearch={() => applyFilters()}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => (showFilters ? setShowFilters(false) : openFilters())}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>
            {showFilters ? 'Hide filters' : 'Show filters'}
          </Text>
        </Pressable>
        {chips.length > 0 ? (
          <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
            {chips.length} active filter{chips.length === 1 ? '' : 's'}
          </Text>
        ) : null}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={showFilters}
        onRequestClose={() => setShowFilters(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close filters"
          onPress={() => setShowFilters(false)}
          style={{
            flex: 1,
            justifyContent: 'flex-start',
            backgroundColor: 'rgba(17, 24, 39, 0.35)',
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.xl * 2,
          }}
        >
          <Pressable onPress={(event) => event.stopPropagation()} style={{ width: '100%' }}>
            <FilterPanel
              location={draftLocation}
              timeFrom={draftTimeFrom}
              timeTo={draftTimeTo}
              onLocationChange={setDraftLocation}
              onTimeFromChange={setDraftTimeFrom}
              onTimeToChange={setDraftTimeTo}
              onClearAll={() => {
                setDraftLocation('');
                setDraftTimeFrom(DEFAULT_FROM_YEAR);
                setDraftTimeTo(DEFAULT_TO_YEAR);
                clearFilters();
              }}
              onApply={() => {
                updateFilters({
                  location: draftLocation,
                  timeFrom: draftTimeFrom === DEFAULT_FROM_YEAR ? '' : draftTimeFrom,
                  timeTo: draftTimeTo === DEFAULT_TO_YEAR ? '' : draftTimeTo,
                }, { refresh: true });
                applyFilters();
                setShowFilters(false);
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <FilterChips
        chips={chips}
        onRemove={(key) => removeFilter(key as keyof typeof filters)}
        onClearAll={clearFilters}
      />
    </View>
  );
}
