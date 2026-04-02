import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';

export type AuthMode = 'signIn' | 'register';

export interface AuthFieldErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export interface PasswordRule {
  id: string;
  label: string;
  passed: boolean;
}

interface AuthFormCardProps {
  mode: AuthMode;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fieldErrors: AuthFieldErrors;
  error?: string;
  successMessage?: string;
  isLoading: boolean;
  passwordRules: PasswordRule[];
  onUsernameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
}

export function AuthFormCard({
  mode,
  username,
  email,
  password,
  confirmPassword,
  fieldErrors,
  error,
  successMessage,
  isLoading,
  passwordRules,
  onUsernameChange,
  onEmailChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onToggleMode,
}: AuthFormCardProps) {
  const { colors, spacing, typography } = useAppTheme();
  const isRegister = mode === 'register';

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
          {isRegister ? 'Create account' : 'Sign in'}
        </Text>
        <Text style={{ fontSize: typography.body, color: colors.muted }}>
          {isRegister
            ? 'Create your account with the same fields and validation rules used on the web app.'
            : 'Use your backend account email and password to start an authenticated session.'}
        </Text>
      </View>

      {successMessage ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: colors.primary,
            backgroundColor: colors.infoSurface,
            borderRadius: 12,
            padding: spacing.md,
          }}
        >
          <Text style={{ color: colors.primary, fontWeight: '600' }}>{successMessage}</Text>
        </View>
      ) : null}

      {isRegister ? (
        <View style={{ gap: spacing.sm }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>Username</Text>
          <Input
            value={username}
            onChangeText={onUsernameChange}
            placeholder="your_username"
            autoComplete="username"
            textContentType="username"
            autoCapitalize="none"
            accessibilityLabel="Username"
            editable={!isLoading}
          />
          {fieldErrors.username ? <Text style={{ color: colors.danger }}>{fieldErrors.username}</Text> : null}
        </View>
      ) : null}

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
          editable={!isLoading}
        />
        {fieldErrors.email ? <Text style={{ color: colors.danger }}>{fieldErrors.email}</Text> : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text style={{ color: colors.text, fontWeight: '600' }}>Password</Text>
        <Input
          value={password}
          onChangeText={onPasswordChange}
          placeholder={isRegister ? 'Create a password' : 'Enter your password'}
          secureTextEntry
          textContentType="password"
          autoComplete={isRegister ? 'new-password' : 'password'}
          accessibilityLabel="Password"
          editable={!isLoading}
        />
        {fieldErrors.password ? <Text style={{ color: colors.danger }}>{fieldErrors.password}</Text> : null}
      </View>

      {isRegister ? (
        <>
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.text, fontWeight: '600' }}>Confirm password</Text>
            <Input
              value={confirmPassword}
              onChangeText={onConfirmPasswordChange}
              placeholder="Repeat your password"
              secureTextEntry
              textContentType="password"
              autoComplete="new-password"
              accessibilityLabel="Confirm password"
              editable={!isLoading}
            />
            {fieldErrors.confirmPassword ? (
              <Text style={{ color: colors.danger }}>{fieldErrors.confirmPassword}</Text>
            ) : null}
          </View>

          <View style={{ gap: spacing.xs }}>
            {passwordRules.map((rule) => (
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
        </>
      ) : null}

      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

      <Button onPress={onSubmit} disabled={isLoading}>
        {isLoading ? (isRegister ? 'Creating account...' : 'Signing in...') : isRegister ? 'Create account' : 'Sign in'}
      </Button>

      <Pressable disabled={isLoading} onPress={onToggleMode}>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            {isRegister ? 'Sign in' : 'Sign up'}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}
