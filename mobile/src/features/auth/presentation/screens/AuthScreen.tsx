import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Input } from '../../../../shared/ui/Input';
import { Screen } from '../../../../shared/ui/Screen';

interface AuthScreenProps {
  onAuthenticated?: () => void;
}

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { login, loading } = useAuth();
  const { colors, spacing, typography } = useAppTheme();
  const [email, setEmail] = useState('traveler@example.com');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    try {
      setError(null);
      await login({ email, password });
      onAuthenticated?.();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    }
  };

  return (
    <Screen>
      <View style={{ flex: 1, padding: spacing.lg, justifyContent: 'center' }}>
        <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
          Sign in to continue
        </Text>
        <Text style={{ marginTop: spacing.sm, color: colors.muted }}>
          Protected mobile features use a shared auth provider and persisted session state.
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          <Input
            value={email}
            placeholder="Email"
            onChangeText={setEmail}
            autoCapitalize="none"
          />
          <Input
            value={password}
            placeholder="Password"
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>

        {error ? (
          <Text style={{ marginTop: spacing.md, color: colors.danger }}>{error}</Text>
        ) : null}

        <Pressable
          onPress={handleLogin}
          style={{
            marginTop: spacing.xl,
            paddingVertical: spacing.md,
            borderRadius: 14,
            backgroundColor: colors.primary,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.background, fontWeight: '700' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}
