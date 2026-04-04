import React from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
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
  const handleSearch = () => {
    Keyboard.dismiss();
    onSearch?.();
  };

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
      <View style={{ flex: 1 }}>
        <View style={{ position: 'relative', justifyContent: 'center' }}>
          <Input
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel="Search stories"
            returnKeyType="search"
            onSubmitEditing={handleSearch}
            style={{ paddingRight: value ? 44 : spacing.md }}
          />
          {value ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => {
                onChangeText('');
              }}
              style={{
                position: 'absolute',
                right: spacing.sm,
                width: 28,
                height: 28,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
              }}
            >
              <Text style={{ color: colors.muted, fontWeight: '700' }}>x</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Apply search"
        onPress={handleSearch}
        style={({ pressed }) => ({
          minWidth: 72,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          borderRadius: 14,
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
