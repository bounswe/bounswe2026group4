import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';

export interface FilterChipItem {
  key: string;
  label: string;
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
          <Pressable
            key={chip.key}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${chip.label}`}
            onPress={() => onRemove(chip.key)}
            style={({ pressed }) => ({
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
              {chip.label} x
            </Text>
          </Pressable>
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
