import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../core/hooks/useAppTheme';
import { ToastItem, ToastVariant, useToastContext } from '../../toast/ToastContext';

const BOTTOM_CHROME_CLEARANCE = 112;
const FALLBACK_SAFE_AREA_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { colors, spacing, typography } = useAppTheme();
  const variantStyles: Record<
    ToastVariant,
    {
      accent: string;
      background: string;
      Icon: typeof Info;
    }
  > = {
    default: {
      accent: colors.primary,
      background: colors.surface,
      Icon: Info,
    },
    success: {
      accent: colors.success,
      background: colors.successSurface,
      Icon: CheckCircle,
    },
    error: {
      accent: colors.danger,
      background: colors.dangerSurface,
      Icon: AlertCircle,
    },
    info: {
      accent: colors.primary,
      background: colors.infoSurface,
      Icon: Info,
    },
  };
  const styles = variantStyles[toast.variant];
  const Icon = styles.Icon;

  return (
    <View
      style={{
        backgroundColor: styles.background,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm + 4,
        paddingLeft: spacing.sm + 4,
        paddingRight: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 2,
        shadowColor: '#111827',
        shadowOpacity: 0.14,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      }}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <Icon color={styles.accent} size={18} strokeWidth={2.4} />
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontSize: typography.body - 1,
          lineHeight: typography.body + 5,
          fontWeight: '600',
        }}
      >
        {toast.message}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss notification"
        onPress={() => onDismiss(toast.id)}
        hitSlop={8}
        style={({ pressed }) => ({
          width: 30,
          height: 30,
          borderRadius: 15,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <X color={colors.muted} size={18} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastContext();
  const { spacing } = useAppTheme();
  const insets = React.useContext(SafeAreaInsetsContext) ?? FALLBACK_SAFE_AREA_INSETS;

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      testID="toast-container"
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        bottom: insets.bottom + BOTTOM_CHROME_CLEARANCE,
        left: spacing.md,
        right: spacing.md,
        gap: spacing.sm,
        zIndex: 1000,
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </View>
  );
}
