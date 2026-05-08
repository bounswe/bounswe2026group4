import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { validators } from '../../../../shared/forms/validators';
import { useToast } from '../../../../shared/hooks/useToast';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';
import { authService } from '../../application/services';

const confirmationMessage =
  "If an account exists with this email, we've sent a password reset link. Check your inbox.";

interface ForgotPasswordScreenProps {
  initialEmail?: string;
  onBackToLogin?: () => void;
}

export function ForgotPasswordScreen({ initialEmail = '', onBackToLogin }: ForgotPasswordScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [email, setEmail] = useState(initialEmail);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submit = async () => {
    const trimmedEmail = email.trim();

    if (!validators.required(trimmedEmail)) {
      setEmailError('Email is required.');
      setError(undefined);
      return;
    }

    if (!validators.email(trimmedEmail)) {
      setEmailError('Please enter a valid email address.');
      setError(undefined);
      return;
    }

    setIsLoading(true);
    setEmailError(undefined);
    setError(undefined);

    try {
      await authService.forgotPassword(trimmedEmail);
      setIsSubmitted(true);
      toast.success('Password reset email sent.');
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : 'Unable to request a reset link right now.';
      setError(message);
      toast.error(message);
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
              Forgot password
            </Text>
            <Text style={{ color: colors.muted }}>
              Enter the email address for your account.
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
            {isSubmitted ? (
              <View
                style={{
                  borderWidth: 1,
                  borderColor: colors.primary,
                  backgroundColor: colors.infoSurface,
                  borderRadius: 12,
                  padding: spacing.md,
                }}
              >
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{confirmationMessage}</Text>
              </View>
            ) : (
              <>
                <View style={{ gap: spacing.sm }}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>Email</Text>
                  <Input
                    value={email}
                    onChangeText={(value) => {
                      setEmail(value);
                      setEmailError(undefined);
                      setError(undefined);
                    }}
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoComplete="email"
                    accessibilityLabel="Email address"
                    editable={!isLoading}
                    returnKeyType="done"
                    onSubmitEditing={submit}
                  />
                  {emailError ? <Text style={{ color: colors.danger }}>{emailError}</Text> : null}
                </View>

                {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

                <Button onPress={submit} disabled={isLoading}>
                  {isLoading ? 'Sending reset link...' : 'Send reset link'}
                </Button>
              </>
            )}

            {onBackToLogin ? (
              <Pressable disabled={isLoading} onPress={onBackToLogin} accessibilityRole="button">
                <Text style={{ color: colors.muted, textAlign: 'center' }}>
                  Back to <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign in</Text>
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
