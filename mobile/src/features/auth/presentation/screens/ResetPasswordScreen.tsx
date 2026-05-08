import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { useToast } from '../../../../shared/hooks/useToast';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';
import { authService } from '../../application/services';
import { getPasswordError, passwordRules } from '../utils/passwordRules';

interface ResetPasswordScreenProps {
  token?: string | null;
  onResetSuccess?: () => void;
  onRequestNewLink?: () => void;
}

export function ResetPasswordScreen({ token, onResetSuccess, onRequestNewLink }: ResetPasswordScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>(
    token ? undefined : 'This reset link is missing a token.',
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const visiblePasswordRules = passwordRules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));

  const validate = () => {
    const nextPasswordError = getPasswordError(password);
    const nextConfirmPasswordError =
      !confirmPassword ? 'Please confirm your password.' : password !== confirmPassword ? 'Passwords do not match.' : undefined;

    setPasswordError(nextPasswordError);
    setConfirmPasswordError(nextConfirmPasswordError);
    setError(undefined);

    return !nextPasswordError && !nextConfirmPasswordError;
  };

  const submit = async () => {
    if (!token) {
      setError('This reset link is missing a token.');
      return;
    }

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    setError(undefined);

    try {
      await authService.resetPassword(token, password);
      toast.success('Password reset successfully. Please log in with your new password.');
      onResetSuccess?.();
    } catch {
      setError('This reset link is invalid or expired.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={spacing.md}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="always"
        contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: 'flex-start' }}
      >
        <View style={{ gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              Reset password
            </Text>
            <Text style={{ color: colors.muted }}>
              Choose a new password for your account.
            </Text>
          </View>

          <View
            style={{
              padding: spacing.lg,
              borderRadius: 20,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.md,
            }}
          >
            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>New password</Text>
              <Input
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setPasswordError(undefined);
                  setConfirmPasswordError(undefined);
                  setError(undefined);
                }}
                placeholder="Create a password"
                secureTextEntry={!isPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                accessibilityLabel="New password"
                editable={!isLoading}
                returnKeyType="next"
                trailingActionLabel={isPasswordVisible ? 'Hide' : 'Show'}
                trailingActionAccessibilityLabel={isPasswordVisible ? 'Hide new password' : 'Show new password'}
                onTrailingActionPress={() => setIsPasswordVisible((current) => !current)}
              />
              {passwordError ? <Text style={{ color: colors.danger }}>{passwordError}</Text> : null}
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Confirm password</Text>
              <Input
                value={confirmPassword}
                onChangeText={(value) => {
                  setConfirmPassword(value);
                  setConfirmPasswordError(undefined);
                  setError(undefined);
                }}
                placeholder="Repeat your password"
                secureTextEntry={!isConfirmPasswordVisible}
                textContentType="newPassword"
                autoComplete="new-password"
                accessibilityLabel="Confirm password"
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={submit}
                trailingActionLabel={isConfirmPasswordVisible ? 'Hide' : 'Show'}
                trailingActionAccessibilityLabel={
                  isConfirmPasswordVisible ? 'Hide confirm password' : 'Show confirm password'
                }
                onTrailingActionPress={() => setIsConfirmPasswordVisible((current) => !current)}
              />
              {confirmPasswordError ? <Text style={{ color: colors.danger }}>{confirmPasswordError}</Text> : null}
            </View>

            <View style={{ gap: spacing.xs }}>
              {visiblePasswordRules.map((rule) => (
                <Text
                  key={rule.id}
                  style={{
                    color: rule.passed ? colors.primary : colors.muted,
                    fontSize: typography.caption,
                  }}
                >
                  {rule.passed ? '[x]' : '[ ]'} {rule.label}
                </Text>
              ))}
            </View>

            {error ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.danger }}>{error}</Text>
                {onRequestNewLink ? (
                  <Pressable disabled={isLoading} onPress={onRequestNewLink} accessibilityRole="button">
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Request a new reset link</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Button onPress={submit} disabled={isLoading || !token}>
              {isLoading ? 'Resetting password...' : 'Reset password'}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
