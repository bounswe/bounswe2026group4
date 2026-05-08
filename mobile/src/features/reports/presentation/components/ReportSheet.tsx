import React, { useMemo, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';
import { ReportReason, ReportTargetType } from '../../domain/entities';

const reportReasonOptions: Array<{ value: ReportReason; label: string }> = [
  { value: 'spam', label: 'Spam' },
  { value: 'false_content', label: 'False/misleading' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'privacy_violation', label: 'Privacy violation' },
  { value: 'explicit_media', label: 'Explicit media' },
  { value: 'other', label: 'Other' },
];

interface ReportSheetProps {
  visible: boolean;
  targetType?: ReportTargetType;
  isSubmitting?: boolean;
  error?: string;
  onClose: () => void;
  onSubmit: (input: { reason: ReportReason; description?: string }) => void;
}

function getTitle(targetType?: ReportTargetType) {
  return targetType === 'comment' ? 'Report comment' : 'Report story';
}

export function ReportSheet({
  visible,
  targetType,
  isSubmitting = false,
  error,
  onClose,
  onSubmit,
}: ReportSheetProps) {
  const { colors, spacing, typography } = useAppTheme();
  const [selectedReason, setSelectedReason] = useState<ReportReason>();
  const [description, setDescription] = useState('');
  const title = useMemo(() => getTitle(targetType), [targetType]);

  const canSubmit = Boolean(selectedReason) && !isSubmitting;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(10, 10, 10, 0.4)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close report sheet"
          onPress={onClose}
          style={{ flex: 1 }}
        />
        <View
          style={{
            padding: spacing.lg,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
              {title}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close report modal"
              disabled={isSubmitting}
              onPress={onClose}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 999,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                opacity: pressed || isSubmitting ? 0.7 : 1,
              })}
            >
              <X size={19} color={colors.text} strokeWidth={2.4} />
            </Pressable>
          </View>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {reportReasonOptions.map((option) => {
              const selected = selectedReason === option.value;

              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Report reason: ${option.label}`}
                  accessibilityState={{ selected }}
                  disabled={isSubmitting}
                  onPress={() => setSelectedReason(option.value)}
                  style={({ pressed }) => ({
                    minHeight: 48,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.infoSurface : colors.surface,
                    justifyContent: 'center',
                    opacity: pressed || isSubmitting ? 0.75 : 1,
                  })}
                >
                  <Text style={{ color: colors.text, fontWeight: selected ? '800' : '600' }}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {selectedReason === 'other' ? (
            <View style={{ marginTop: spacing.md }}>
              <Input
                value={description}
                onChangeText={setDescription}
                placeholder="Add details (optional)"
                accessibilityLabel="Report details"
                editable={!isSubmitting}
                multiline
                numberOfLines={3}
                style={{ minHeight: 96, alignItems: 'stretch' }}
              />
            </View>
          ) : null}

          {error ? (
            <Text style={{ marginTop: spacing.md, color: colors.danger, fontWeight: '600' }}>
              {error}
            </Text>
          ) : null}

          <View style={{ marginTop: spacing.lg }}>
            <Button
              fullWidth
              disabled={!canSubmit}
              onPress={() => {
                if (selectedReason) {
                  onSubmit({ reason: selectedReason, description });
                }
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit report'}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
