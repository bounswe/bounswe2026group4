import React from 'react';
import { TextInput } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface InputProps {
  value?: string;
  placeholder?: string;
  onChangeText?: (value: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Input({
  value,
  placeholder,
  onChangeText,
  secureTextEntry = false,
  autoCapitalize = 'sentences',
}: InputProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <TextInput
      value={value}
      placeholder={placeholder ?? 'Input'}
      placeholderTextColor={colors.muted}
      onChangeText={onChangeText}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.md,
        borderRadius: 12,
        color: colors.text,
        backgroundColor: colors.surface,
        fontSize: typography.body,
      }}
    />
  );
}
