import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { validators } from '../../../../shared/forms/validators';
import { useToast } from '../../../../shared/hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { AuthFieldErrors, AuthFormCard, AuthMode, PasswordRule } from '../components/AuthFormCard';
import { AuthUiState } from '../state/authUiState';
import { getPasswordError, passwordRules } from '../utils/passwordRules';

interface AuthScreenProps {
  onAuthenticated?: (context: { source: 'signIn' | 'register' }) => void;
  onRegistrationPending?: (context: { email: string; password: string }) => void;
  onForgotPassword?: () => void;
}

const initialState: AuthUiState = {
  email: '',
  password: '',
  isLoading: false,
};

const initialFieldErrors: AuthFieldErrors = {
  username: undefined,
  email: undefined,
  password: undefined,
  confirmPassword: undefined,
};

interface AuthFormState extends AuthUiState {
  username: string;
  confirmPassword: string;
  successMessage?: string;
  fieldErrors: AuthFieldErrors;
}

const initialFormState: AuthFormState = {
  ...initialState,
  username: '',
  confirmPassword: '',
  successMessage: undefined,
  fieldErrors: initialFieldErrors,
};

function extractRegisterErrors(error: unknown): {
  error?: string;
  fieldErrors: AuthFieldErrors;
} {
  const defaultError = 'Registration failed. Please try again.';
  const response = (error as { response?: { data?: unknown } })?.response?.data;

  if (!response || typeof response !== 'object') {
    return { error: error instanceof Error ? error.message : defaultError, fieldErrors: initialFieldErrors };
  }

  const payload = response as Record<string, unknown>;
  const nextFieldErrors: AuthFieldErrors = { ...initialFieldErrors };

  const readMessage = (value: unknown) => {
    if (Array.isArray(value) && typeof value[0] === 'string') {
      return value[0];
    }

    return typeof value === 'string' ? value : undefined;
  };

  nextFieldErrors.username = readMessage(payload.username);
  nextFieldErrors.email = readMessage(payload.email);
  nextFieldErrors.password = readMessage(payload.password);
  nextFieldErrors.confirmPassword = readMessage(payload.password_confirmation);

  if (
    nextFieldErrors.username ||
    nextFieldErrors.email ||
    nextFieldErrors.password ||
    nextFieldErrors.confirmPassword
  ) {
    return { fieldErrors: nextFieldErrors };
  }

  const genericError =
    readMessage(payload.non_field_errors) ??
    readMessage(payload.detail) ??
    readMessage(payload.message) ??
    (error instanceof Error ? error.message : defaultError);

  return {
    error: genericError,
    fieldErrors: nextFieldErrors,
  };
}

export function AuthScreen({ onAuthenticated, onRegistrationPending, onForgotPassword }: AuthScreenProps) {
  const { login, register, loading } = useAuth();
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const passwordInputRef = useRef<TextInput>(null);
  const [mode, setMode] = useState<AuthMode>('signIn');
  const [state, setState] = useState<AuthFormState>(initialFormState);

  const isRegister = mode === 'register';
  const visiblePasswordRules: PasswordRule[] = passwordRules.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(state.password),
  }));

  const updateField =
    (field: keyof AuthFormState) =>
    (value: string) => {
      setState((current) => ({
        ...current,
        [field]: value,
        error: undefined,
        successMessage: field === 'email' ? current.successMessage : undefined,
        fieldErrors: {
          ...current.fieldErrors,
          [field]: undefined,
          ...(field === 'password' ? { confirmPassword: undefined } : {}),
        },
      }));
    };

  const toggleMode = () => {
    setMode((current) => (current === 'signIn' ? 'register' : 'signIn'));
    setState((current) => ({
      ...initialFormState,
      email: current.email,
    }));
  };

  const validateSignIn = () => {
    const email = state.email.trim();
    const nextFieldErrors: AuthFieldErrors = {};

    if (!validators.required(email)) {
      nextFieldErrors.email = 'Email is required.';
    } else if (!validators.email(email)) {
      nextFieldErrors.email = 'Please enter a valid email address.';
    }

    if (!validators.required(state.password)) {
      nextFieldErrors.password = 'Password is required.';
    }

    if (nextFieldErrors.email || nextFieldErrors.password) {
      setState((current) => ({
        ...current,
        error: undefined,
        fieldErrors: {
          ...initialFieldErrors,
          ...nextFieldErrors,
        },
      }));
      return false;
    }

    return true;
  };

  const validateRegistration = () => {
    const username = state.username.trim();
    const email = state.email.trim();
    const nextFieldErrors: AuthFieldErrors = {};

    if (!validators.required(username)) {
      nextFieldErrors.username = 'Username is required.';
    }

    if (!validators.required(email)) {
      nextFieldErrors.email = 'Email is required.';
    } else if (!validators.email(email)) {
      nextFieldErrors.email = 'Enter a valid email address.';
    }

    if (!validators.required(state.password)) {
      nextFieldErrors.password = 'Password is required.';
    } else {
      nextFieldErrors.password = getPasswordError(state.password);
    }

    if (!validators.required(state.confirmPassword)) {
      nextFieldErrors.confirmPassword = 'Please confirm your password.';
    } else if (state.password !== state.confirmPassword) {
      nextFieldErrors.confirmPassword = 'Passwords do not match.';
    }

    if (
      nextFieldErrors.username ||
      nextFieldErrors.email ||
      nextFieldErrors.password ||
      nextFieldErrors.confirmPassword
    ) {
      setState((current) => ({
        ...current,
        error: undefined,
        fieldErrors: {
          ...initialFieldErrors,
          ...nextFieldErrors,
        },
      }));
      return false;
    }

    return true;
  };

  const submit = async () => {
    if (isRegister) {
      if (!validateRegistration()) {
        return;
      }
    } else if (!validateSignIn()) {
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
      error: undefined,
      successMessage: undefined,
      fieldErrors: initialFieldErrors,
    }));

    try {
      if (isRegister) {
        const email = state.email.trim();
        const password = state.password;

        const result = await register({
          username: state.username.trim(),
          email,
          password,
          confirmPassword: state.confirmPassword,
        });

        toast.success(result.message || 'Registration successful. Please verify your email.');
        onRegistrationPending?.({ email, password });
        setState(initialFormState);

        return;
      }

      const email = state.email.trim();
      const password = state.password;
      const session = await login({ email, password });
      toast.success(`Welcome back, ${session.user.username}.`);
      onAuthenticated?.({ source: 'signIn' });
      setState(initialFormState);
    } catch (loginError) {
      if (isRegister) {
        const { error, fieldErrors } = extractRegisterErrors(loginError);

        setState((current) => ({
          ...current,
          isLoading: false,
          error,
          fieldErrors,
        }));

        if (error) {
          toast.error(error);
        }
        return;
      }

      const message = loginError instanceof Error ? loginError.message : 'Unable to sign in right now.';
      setState((current) => ({
        ...current,
        isLoading: false,
        error: message,
      }));
      toast.error(message);
      return;
    }

    setState(initialFormState);
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
          <View style={{ gap: spacing.xs }}>
            <Text style={{ color: colors.text, fontSize: typography.title, fontWeight: '800' }}>
              {isRegister ? 'Create account' : 'Sign in'}
            </Text>
          </View>

          <AuthFormCard
            mode={mode}
            username={state.username}
            email={state.email}
            password={state.password}
            confirmPassword={state.confirmPassword}
            fieldErrors={state.fieldErrors}
            error={state.error}
            successMessage={state.successMessage}
            isLoading={state.isLoading || loading}
            passwordRules={visiblePasswordRules}
            onUsernameChange={updateField('username')}
            onEmailChange={updateField('email')}
            onPasswordChange={updateField('password')}
            onConfirmPasswordChange={updateField('confirmPassword')}
            onSubmit={submit}
            passwordInputRef={passwordInputRef}
            onToggleMode={toggleMode}
            onForgotPassword={onForgotPassword}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
