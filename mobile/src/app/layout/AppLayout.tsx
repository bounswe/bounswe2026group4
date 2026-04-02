import React, { PropsWithChildren } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../core/hooks/useAppTheme';
import { Button } from '../../shared';
import { useAuth } from '../../features/auth/presentation/context/AuthContext';
import { AppRoute, AUTH_ACTION_ROUTES, MAIN_NAV_ROUTES } from '../navigation/routes';
import { useAppNavigation } from '../providers/NavigationProvider';

function RouteButton({
  label,
  isActive,
  onPress,
  testID,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => ({
        minHeight: 52,
        flex: 1,
        borderRadius: 16,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isActive ? colors.primary : colors.surface,
        borderWidth: 1,
        borderColor: isActive ? colors.primary : colors.border,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: isActive ? '#FFFFFF' : colors.text,
          fontSize: typography.caption + 1,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppLayout({ children }: PropsWithChildren) {
  const { colors, spacing, typography } = useAppTheme();
  const { session, isAuthenticated, isLoggingOut, signOut } = useAuth();
  const { currentRoute, navigate } = useAppNavigation();

  const visibleMainRoutes = MAIN_NAV_ROUTES.filter((route) => !route.requiresAuth || isAuthenticated);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, paddingTop: spacing.sm }}>
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            gap: spacing.md,
          }}
        >
          <View
            style={{
              borderRadius: 24,
              padding: spacing.md,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              gap: spacing.md,
            }}
          >
            <View style={{ gap: spacing.xs }}>
              <Text style={{ color: colors.primary, fontWeight: '800' }}>Local History Story Map</Text>
              <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
                Shared mobile shell
              </Text>
              <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
                Navigate between the core screens from a consistent mobile layout.
              </Text>
            </View>

            {isAuthenticated ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: '700' }}>{session?.user.username}</Text>
                  <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>
                    Signed in as {session?.user.email}
                  </Text>
                </View>
                <Button onPress={signOut} disabled={isLoggingOut} variant="secondary">
                  {isLoggingOut ? 'Logging out...' : 'Logout'}
                </Button>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {AUTH_ACTION_ROUTES.map((route) => (
                  <View key={route.key} style={{ flex: 1 }}>
                    <RouteButton
                      label={route.label}
                      isActive={currentRoute === route.key}
                      onPress={() => navigate(route.key)}
                      testID={`auth-route-${route.key}`}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
          <View
            style={{
              flex: 1,
              borderRadius: 28,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            {children}
          </View>
        </View>

        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: spacing.md + spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {visibleMainRoutes.map((route) => (
              <RouteButton
                key={route.key}
                label={route.tabLabel}
                isActive={currentRoute === route.key}
                onPress={() => navigate(route.key as AppRoute)}
                testID={`main-route-${route.key}`}
              />
            ))}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
