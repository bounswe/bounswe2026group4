import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { FilterPanel } from '../../../../shared/components/FilterPanel';
import { FilterChipItem, FilterChips } from '../../../../shared/components/FilterChips';
import { SearchInput } from '../../../../shared/components/SearchInput';
import { useSearchFilters } from '../context/SearchFiltersContext';

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
}

export function StorySearchControls({ helperText, hideHeading = false }: StorySearchControlsProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { filters, updateFilters, removeFilter, clearFilters } = useSearchFilters();
  const [showFilters, setShowFilters] = useState(false);

  const chips = useMemo(() => buildChips(filters), [filters]);

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
        onSearch={() => updateFilters({ query: filters.query })}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" onPress={() => setShowFilters((current) => !current)}>
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

      {showFilters ? (
        <FilterPanel
          location={filters.location}
          timeFrom={filters.timeFrom}
          timeTo={filters.timeTo}
          onLocationChange={(location) => updateFilters({ location })}
          onTimeFromChange={(timeFrom) => updateFilters({ timeFrom })}
          onTimeToChange={(timeTo) => updateFilters({ timeTo })}
          onClearAll={clearFilters}
        />
      ) : null}

      <FilterChips
        chips={chips}
        onRemove={(key) => removeFilter(key as keyof typeof filters)}
        onClearAll={clearFilters}
      />
    </View>
  );
}
