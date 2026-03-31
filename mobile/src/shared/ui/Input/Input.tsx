import React from 'react';
import {
  KeyboardTypeOptions,
  StyleProp,
  TextInput,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface InputProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions;
  autoCorrect?: boolean;
  editable?: boolean;
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
}

export function Input({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoCorrect = false,
  editable = true,
  textContentType,
  autoComplete,
  accessibilityLabel,
  style,
}: InputProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoCorrect={autoCorrect}
      editable={editable}
      textContentType={textContentType}
      autoComplete={autoComplete}
      accessibilityLabel={accessibilityLabel}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          color: colors.text,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          borderRadius: 12,
          fontSize: typography.body,
        },
        style,
      ]}
    />
  );
}
