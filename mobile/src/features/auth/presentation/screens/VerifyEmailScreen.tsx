import React, { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';
import { authService } from '../../application/services';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const initialDigits = Array(CODE_LENGTH).fill('');

interface VerifyEmailScreenProps {
  email: string;
  onVerified: () => void;
  onRegisterAgain?: () => void;
}

function readMessage(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }

  return typeof value === 'string' ? value : undefined;
}

function extractVerificationError(error: unknown, fallback: string) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  const data = (error as { response?: { data?: unknown } })?.response?.data;

  if (status === 429) {
    return 'Too many attempts. Please wait a moment and try again.';
  }

  if (!data || typeof data !== 'object') {
    return error instanceof Error ? error.message : fallback;
  }

  const payload = data as Record<string, unknown>;
  const message =
    readMessage(payload.code) ??
    readMessage(payload.email) ??
    readMessage(payload.non_field_errors) ??
    readMessage(payload.detail) ??
    readMessage(payload.message) ??
    fallback;

  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('expired') && !normalizedMessage.includes('invalid')) {
    return 'Code has expired. Tap to resend.';
  }

  return normalizedMessage.includes('invalid') ? 'Invalid verification code. Please try again.' : message;
}

export function VerifyEmailScreen({ email, onVerified, onRegisterAgain }: VerifyEmailScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [digits, setDigits] = useState<string[]>(initialDigits);
  const [apiError, setApiError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const code = useMemo(() => digits.join(''), [digits]);
  const isCodeComplete = digits.every((digit) => /^\d$/.test(digit)) && code.length === CODE_LENGTH;

  useEffect(() => {
    const timer = setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => clearInterval(intervalId);
  }, [cooldown]);

  const updateDigit = (index: number, value: string) => {
    setDigits((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const handleDigitChange = (index: number, rawValue: string) => {
    const value = rawValue.replace(/\D/g, '');
    setApiError(undefined);

    if (!value) {
      updateDigit(index, '');
      return;
    }

    if (value.length === 1) {
      updateDigit(index, value);
      inputRefs.current[Math.min(index + 1, CODE_LENGTH - 1)]?.focus();
      return;
    }

    setDigits((current) => {
      const next = [...current];
      value
        .slice(0, CODE_LENGTH - index)
        .split('')
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      return next;
    });
    inputRefs.current[Math.min(index + value.length, CODE_LENGTH - 1)]?.focus();
  };

  const handleSubmit = async () => {
    if (!isCodeComplete || isSubmitting) {
      return;
    }

    setApiError(undefined);
    setIsSubmitting(true);

    try {
      await authService.verifyEmail(email, code);
      onVerified();
    } catch (error) {
      setApiError(extractVerificationError(error, 'Invalid verification code. Please try again.'));
      setDigits(initialDigits);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || isResending) {
      return;
    }

    setApiError(undefined);
    setIsResending(true);

    try {
      await authService.resendVerificationCode(email);
      setDigits(initialDigits);
      inputRefs.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;
      setApiError(
        status === 429
          ? 'Too many requests. Please wait before requesting another code.'
          : extractVerificationError(error, 'Could not resend code. Please try again.'),
      );
      if (status === 429) {
        setCooldown(RESEND_COOLDOWN_SECONDS);
      }
    } finally {
      setIsResending(false);
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
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          justifyContent: 'center',
        }}
      >
        <View style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              Verify your email
            </Text>
            <Text style={{ color: colors.muted }}>
              We sent a 6-digit code to {email}. Enter it below to activate your account.
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
            <Text style={{ color: colors.text, fontWeight: '600', textAlign: 'center' }}>Verification code</Text>
            <View
              accessibilityLabel="Enter 6-digit verification code"
              style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}
            >
              {digits.map((digit, index) => (
                <Input
                  key={index}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  value={digit}
                  onChangeText={(value) => handleDigitChange(index, value)}
                  placeholder=""
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  accessibilityLabel={`Digit ${index + 1}`}
                  editable={!isSubmitting}
                  inputStyle={{ textAlign: 'center', fontWeight: '800' }}
                  style={{ width: 44 }}
                />
              ))}
            </View>

            {apiError ? (
              <View style={{ gap: spacing.sm }}>
                <Text style={{ color: colors.danger, textAlign: 'center' }}>{apiError}</Text>
                {apiError.toLowerCase().includes('expired') ? (
                  <Pressable accessibilityRole="button" onPress={handleResend} disabled={cooldown > 0 || isResending}>
                    <Text style={{ color: colors.primary, textAlign: 'center', fontWeight: '700' }}>
                      {isResending ? 'Resending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            <Button onPress={handleSubmit} disabled={!isCodeComplete || isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Verify email'}
            </Button>

            <Pressable accessibilityRole="button" onPress={handleResend} disabled={cooldown > 0 || isResending}>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                Didn't receive the code?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  {isResending ? 'Resending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
                </Text>
              </Text>
            </Pressable>

            <Pressable accessibilityRole="button" onPress={onRegisterAgain} disabled={isSubmitting || isResending}>
              <Text style={{ color: colors.muted, textAlign: 'center' }}>
                Wrong email? <Text style={{ color: colors.primary, fontWeight: '700' }}>Register again</Text>
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
