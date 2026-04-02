import React, { forwardRef } from 'react';
import { KeyboardTypeOptions, StyleProp, TextInput, TextInputProps, TextStyle, ViewStyle } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface InputProps {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: KeyboardTypeOptions;
  autoCorrect?: boolean;
  editable?: boolean;
  textContentType?: TextInputProps['textContentType'];
  autoComplete?: TextInputProps['autoComplete'];
  returnKeyType?: TextInputProps['returnKeyType'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
  returnKeyType?: TextInputProps['returnKeyType'];
  blurOnSubmit?: TextInputProps['blurOnSubmit'];
  submitBehavior?: TextInputProps['submitBehavior'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
}

export const Input = forwardRef<TextInput, InputProps>(function Input({
  value,
  onChangeText,
  onSubmitEditing,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  keyboardType = 'default',
  autoCorrect = false,
  editable = true,
  textContentType,
  autoComplete,
  returnKeyType,
  accessibilityLabel,
  style,
  returnKeyType,
  blurOnSubmit,
  submitBehavior,
  onSubmitEditing,
}: InputProps, ref) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <TextInput
      ref={ref}
      value={value}
      placeholder={placeholder ?? 'Input'}
      placeholderTextColor={colors.muted}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      keyboardType={keyboardType}
      autoCorrect={autoCorrect}
      editable={editable}
      textContentType={textContentType}
      autoComplete={autoComplete}
      returnKeyType={returnKeyType}
      accessibilityLabel={accessibilityLabel}
      returnKeyType={returnKeyType}
      blurOnSubmit={blurOnSubmit}
      submitBehavior={submitBehavior}
      onSubmitEditing={onSubmitEditing}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md - 2,
          borderRadius: 12,
          color: colors.text,
          backgroundColor: colors.surface,
          fontSize: typography.body,
        },
        style,
      ]}
    />
  );
});
