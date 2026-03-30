import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';
import { ToastItem, ToastVariant, useToastContext } from '../../toast/ToastContext';

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { colors, spacing, typography } = useAppTheme();
  const variantStyles: Record<
    ToastVariant,
    {
      accent: string;
      background: string;
    }
  > = {
    default: {
      accent: colors.primary,
      background: colors.infoSurface,
    },
    success: {
      accent: colors.success,
      background: colors.successSurface,
    },
    error: {
      accent: colors.danger,
      background: colors.dangerSurface,
    },
    info: {
      accent: colors.primary,
      background: colors.infoSurface,
    },
  };
  const styles = variantStyles[toast.variant];

  return (
    <View
      style={{
        backgroundColor: styles.background,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        paddingVertical: spacing.sm + 2,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        shadowColor: '#111827',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: styles.accent,
        }}
      />
      <Text
        style={{
          flex: 1,
          color: colors.text,
          fontSize: typography.body,
        }}
      >
        {toast.message}
      </Text>
      <Pressable onPress={() => onDismiss(toast.id)} hitSlop={8}>
        <Text style={{ color: colors.muted, fontSize: typography.body }}>x</Text>
      </Pressable>
    </View>
  );
}

export function Toaster() {
  const { toasts, removeToast } = useToastContext();
  const { spacing } = useAppTheme();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: spacing.lg,
        left: spacing.md,
        right: spacing.md,
        gap: spacing.sm,
      }}
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={removeToast} />
      ))}
    </View>
  );
}
