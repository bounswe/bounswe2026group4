import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { Input } from '../ui/Input';

interface SearchInputProps {
  value: string;
  onChangeText: (value: string) => void;
  onSearch?: () => void;
  placeholder?: string;
}

export function SearchInput({
  value,
  onChangeText,
  onSearch,
  placeholder = 'Search by story title or place',
}: SearchInputProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      <View style={{ flex: 1 }}>
        <Input
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          accessibilityLabel="Search stories"
          returnKeyType="search"
          onSubmitEditing={onSearch}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply search"
        onPress={onSearch}
        style={({ pressed }) => ({
          minWidth: 72,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primary,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Search</Text>
      </Pressable>
    </View>
  );
}
