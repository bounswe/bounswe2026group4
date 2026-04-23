import React, { ReactNode, forwardRef } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
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
  returnKeyType?: TextInputProps['returnKeyType'];
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle | TextStyle>;
  blurOnSubmit?: TextInputProps['blurOnSubmit'];
  submitBehavior?: TextInputProps['submitBehavior'];
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
  onBlur?: TextInputProps['onBlur'];
  trailingActionLabel?: string;
  trailingActionAccessibilityLabel?: string;
  onTrailingActionPress?: () => void;
  trailingElement?: ReactNode;
  multiline?: boolean;
  numberOfLines?: number;
  inputStyle?: StyleProp<TextStyle>;
}

export const Input = forwardRef<TextInput, InputProps>(function Input({
  value,
  onChangeText,
  onSubmitEditing,
  onBlur,
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
  blurOnSubmit,
  submitBehavior,
  trailingActionLabel,
  trailingActionAccessibilityLabel,
  onTrailingActionPress,
  trailingElement,
  multiline = false,
  numberOfLines,
  inputStyle,
}: InputProps, ref) {
  const { colors, spacing, typography } = useAppTheme();
  const hasTrailingContent = Boolean(trailingElement || (trailingActionLabel && onTrailingActionPress));

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 14,
          backgroundColor: colors.background,
          flexDirection: 'row',
          alignItems: 'center',
        },
        style,
      ]}
    >
      <TextInput
        ref={ref}
        value={value}
        placeholder={placeholder ?? 'Input'}
        placeholderTextColor={colors.muted}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        onBlur={onBlur}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={autoCorrect}
        editable={editable}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textContentType={textContentType}
        autoComplete={autoComplete}
        returnKeyType={returnKeyType}
        accessibilityLabel={accessibilityLabel}
        blurOnSubmit={blurOnSubmit}
        submitBehavior={submitBehavior}
        style={[
          {
            flex: 1,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.md - 2,
            color: colors.text,
            fontSize: typography.body,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          inputStyle,
        ]}
      />
      {trailingElement}
      {!trailingElement && trailingActionLabel && onTrailingActionPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={trailingActionAccessibilityLabel ?? trailingActionLabel}
          disabled={!editable}
          onPress={onTrailingActionPress}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            opacity: !editable ? 0.5 : pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: colors.primary, fontSize: typography.caption, fontWeight: '700' }}>
            {trailingActionLabel}
          </Text>
        </Pressable>
      ) : null}
      {hasTrailingContent ? <View style={{ width: spacing.xs }} /> : null}
    </View>
  );
});
