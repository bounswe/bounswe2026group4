import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Session } from '../../../../core/auth/session';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { validators } from '../../../../shared/forms/validators';
import { useToast } from '../../../../shared/hooks/useToast';
import { loginWithEmailPassword } from '../../application/useCases';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from '../components/AuthCard';
import { AuthUiState } from '../state/authUiState';

interface AuthScreenProps {
  onAuthenticated?: (session: Session) => void;
}

const initialState: AuthUiState = {
  email: '',
  password: '',
  isLoading: false,
};

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const { setSession } = useAuth();
  const [state, setState] = useState<AuthUiState>(initialState);
  const passwordInputRef = useRef<TextInput>(null);

  const submit = async () => {
    const email = state.email.trim();
    const password = state.password;

    if (!validators.required(email) || !validators.required(password)) {
      setState((current) => ({
        ...current,
        error: 'Email and password are required.',
      }));
      return;
    }

    if (!validators.email(email)) {
      setState((current) => ({
        ...current,
        error: 'Please enter a valid email address.',
      }));
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
    }));

    try {
      const session = await loginWithEmailPassword({ email, password });
      toast.success(`Welcome back, ${session.user.username}.`);
      setSession(session);
      onAuthenticated?.(session);
      setState(initialState);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in right now.';
      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
      }));
      toast.error(message);
      return;
    }

    setState(initialState);
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
        contentContainerStyle={{
          flexGrow: 1,
          padding: spacing.lg,
          justifyContent: 'flex-start',
        }}
      >
        <View
          style={{
            gap: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xl,
          }}
        >
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Local History Story Map</Text>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              Sign in to the mobile app
            </Text>
            <Text style={{ color: colors.muted, fontSize: typography.body }}>
              This screen sends your credentials to the Django backend and stores the issued JWT
              session locally for the current app run.
            </Text>
          </View>

          <AuthCard
            email={state.email}
            password={state.password}
            error={state.error}
            isLoading={state.isLoading}
            onEmailChange={(email) => setState((current) => ({ ...current, email }))}
            onPasswordChange={(password) => setState((current) => ({ ...current, password }))}
            onSubmit={submit}
            passwordInputRef={passwordInputRef}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
