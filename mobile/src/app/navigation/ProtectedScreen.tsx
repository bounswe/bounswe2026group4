import React, { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { useAuth } from '../../features/auth/context/AuthContext';
import { AuthScreen } from '../../features/auth';
import { Loader } from '../../shared/ui/Loader';
import { useAppTheme } from '../../core/hooks/useAppTheme';

interface ProtectedScreenProps extends PropsWithChildren {
  title: string;
  description: string;
  onAuthenticated?: () => void;
  onRegistrationPending?: (context: { email: string; password: string }) => void;
}

export function ProtectedScreen({
  title,
  description,
  children,
  onAuthenticated,
  onRegistrationPending,
}: ProtectedScreenProps) {
  const { isAuthenticated, loading } = useAuth();
  const { colors, spacing, typography } = useAppTheme();

  if (loading) {
    return <Loader fullScreen message="Checking your session..." />;
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1 }}>
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            padding: spacing.md,
            borderRadius: 16,
            backgroundColor: colors.infoSurface,
          }}
        >
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '700' }}>
            {title}
          </Text>
          <Text style={{ marginTop: spacing.sm, color: colors.muted }}>{description}</Text>
        </View>
        <AuthScreen onAuthenticated={onAuthenticated} onRegistrationPending={onRegistrationPending} />
      </View>
    );
  }

  return <>{children}</>;
}
