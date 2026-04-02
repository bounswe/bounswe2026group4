import React, { RefObject } from 'react';
import { Text, View } from 'react-native';
import { TextInput } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';

interface AuthCardProps {
  email: string;
  password: string;
  error?: string;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  passwordInputRef?: RefObject<TextInput | null>;
}

export function AuthCard({
  email,
  password,
  error,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  passwordInputRef,
}: AuthCardProps) {
  const { colors, spacing, typography } = useAppTheme();

  return (
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
      <View style={{ gap: spacing.xs }}>
        <Text style={{ fontSize: typography.subtitle, fontWeight: '700', color: colors.text }}>
          Sign in
        </Text>
        <Text style={{ fontSize: typography.body, color: colors.muted }}>
          Use your backend account email and password to start an authenticated session.
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Email</Text>
        <Input
          value={email}
          onChangeText={onEmailChange}
          placeholder="you@example.com"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          accessibilityLabel="Email address"
          returnKeyType="next"
          blurOnSubmit={false}
          submitBehavior="submit"
          onSubmitEditing={() => passwordInputRef?.current?.focus()}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Password</Text>
        <Input
          ref={passwordInputRef}
          value={password}
          onChangeText={onPasswordChange}
          placeholder="Enter your password"
          secureTextEntry
          textContentType="password"
          autoComplete="password"
          accessibilityLabel="Password"
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          onSubmitEditing={onSubmit}
        />
      </View>

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button onPress={onSubmit} disabled={isLoading}>
        {isLoading ? 'Signing in...' : 'Sign in'}
      </Button>
    </View>
  );
}
