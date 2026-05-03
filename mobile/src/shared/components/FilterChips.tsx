import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { formatTagLabel, TagChip } from './TagChip';

export interface FilterChipItem {
  key: string;
  label: string;
  visual?: 'redPin' | 'bluePin';
  visualAccessibilityLabel?: string;
  showRemoveGlyph?: boolean;
}

interface FilterChipsProps {
  chips: FilterChipItem[];
  onRemove: (key: string) => void;
  onClearAll?: () => void;
}

export function FilterChips({ chips, onRemove, onClearAll }: FilterChipsProps) {
  const { colors, spacing, typography } = useAppTheme();

  if (chips.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {chips.map((chip) => (
          chip.key.startsWith('tag:') ? (
            <TagChip
              key={chip.key}
              label={formatTagLabel(chip.key.slice(4))}
              value={chip.key.slice(4)}
              removable
              selected
              accessibilityLabel={`Remove ${chip.label}`}
              onPress={() => onRemove(chip.key)}
            />
          ) : (
            <Pressable
              key={chip.key}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${chip.label}${chip.visualAccessibilityLabel ? ` ${chip.visualAccessibilityLabel}` : ''}`}
              onPress={() => onRemove(chip.key)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              <Text style={{ color: colors.text, fontSize: typography.caption + 1, fontWeight: '600' }}>
                {chip.label}
              </Text>
              {chip.visual === 'redPin' ? (
                <MapPin color="#dc2626" fill="#dc2626" size={16} strokeWidth={2.2} />
              ) : null}
              {chip.visual === 'bluePin' ? (
                <MapPin color="#1d4ed8" fill="#1d4ed8" size={16} strokeWidth={2.2} />
              ) : null}
              {chip.showRemoveGlyph === false ? null : (
                <Text style={{ color: colors.text, fontSize: typography.caption + 1, fontWeight: '600' }}>x</Text>
              )}
            </Pressable>
          )
        ))}
      </View>
      {onClearAll ? (
        <Pressable accessibilityRole="button" onPress={onClearAll}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Clear all filters</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
