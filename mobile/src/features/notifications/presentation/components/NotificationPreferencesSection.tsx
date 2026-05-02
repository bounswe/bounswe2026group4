import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, ErrorState, Loader } from '../../../../shared';
import { useAppTheme } from '../../../../core/hooks/useAppTheme';
import { useToast } from '../../../../shared/hooks/useToast';
import { notificationService } from '../../application/services';
import {
  NotificationPreferences,
  NotificationPreferencesEntity,
  NotificationType,
  notificationTypes,
} from '../../domain/entities';
import { NOTIFICATION_TYPE_LABELS } from './NotificationCard';

const DESCRIPTION_BY_TYPE: Record<NotificationType, string> = {
  new_comment: 'New comment on your own story',
  new_like: 'New like on your own story',
  moderation_action: 'Moderation action on your content',
  story_removed: 'Own story removed by moderation',
  report_resolved: 'Report resolution',
  badge_earned: 'New badge earned',
};

interface NotificationPreferencesSectionProps {
  getPreferences?: typeof notificationService.getPreferences;
  updatePreferences?: typeof notificationService.updatePreferences;
}

export function NotificationPreferencesSection({
  getPreferences = notificationService.getPreferences,
  updatePreferences = notificationService.updatePreferences,
}: NotificationPreferencesSectionProps) {
  const { colors, spacing, typography } = useAppTheme();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [savedPreferencesState, setSavedPreferencesState] = useState<NotificationPreferencesEntity>();
  const [preferencesState, setPreferencesState] = useState<NotificationPreferencesEntity>();
  const [draftPreferences, setDraftPreferences] = useState<NotificationPreferences>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();

  const hasChanges = useMemo(() => {
    if (!savedPreferencesState || !preferencesState || !draftPreferences) {
      return false;
    }

    return (
      savedPreferencesState.notificationsMuted !== preferencesState.notificationsMuted ||
      notificationTypes.some((type) => savedPreferencesState.preferences[type] !== draftPreferences[type])
    );
  }, [draftPreferences, preferencesState, savedPreferencesState]);

  const loadPreferences = useCallback(async () => {
    setIsLoading(true);
    setError(undefined);

    try {
      const result = await getPreferences();
      setSavedPreferencesState(result);
      setPreferencesState(result);
      setDraftPreferences(result.preferences);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load notification preferences.');
    } finally {
      setIsLoading(false);
    }
  }, [getPreferences]);

  useEffect(() => {
    if (isExpanded) {
      void loadPreferences();
    }
  }, [isExpanded, loadPreferences]);

  const updateMuted = (notificationsMuted: boolean) => {
    setPreferencesState((current) => (current ? { ...current, notificationsMuted } : current));
  };

  const handleSave = async () => {
    if (!preferencesState || !draftPreferences) {
      return;
    }

    setIsSaving(true);

    try {
      const updatedPreferences = await updatePreferences({
        notificationsMuted: preferencesState.notificationsMuted,
        ...draftPreferences,
      });
      setSavedPreferencesState(updatedPreferences);
      setPreferencesState(updatedPreferences);
      setDraftPreferences(updatedPreferences.preferences);
      toast.success('Notification preferences saved.');
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Unable to save notification preferences.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: spacing.xs }}>
          <Text style={{ color: colors.text, fontSize: typography.subtitle, fontWeight: '800' }}>
            Notification preferences
          </Text>
          <Text style={{ color: colors.muted }}>
            Control which in-app events appear in your notification inbox.
          </Text>
        </View>
        <Button
          variant="outline"
          onPress={() => {
            setError(undefined);
            setIsExpanded((current) => !current);
          }}
        >
          {isExpanded ? 'Close' : 'Edit'}
        </Button>
      </View>

      {isExpanded ? (
        isLoading ? (
          <Loader message="Loading notification preferences..." />
        ) : error || !preferencesState || !draftPreferences ? (
          <ErrorState
            title="Notification preferences unavailable"
            message={error ?? 'Unable to load notification preferences.'}
            retryLabel="Try again"
            onRetry={() => void loadPreferences()}
          />
        ) : (
          <>
            <PreferenceSwitch
              label="Stop all notifications"
              description="Disable every notification type at once."
              value={preferencesState.notificationsMuted}
              onToggle={() => updateMuted(!preferencesState.notificationsMuted)}
            />

            <View style={{ gap: spacing.sm, opacity: preferencesState.notificationsMuted ? 0.55 : 1 }}>
              {notificationTypes.map((type) => (
                <PreferenceSwitch
                  key={type}
                  label={NOTIFICATION_TYPE_LABELS[type]}
                  description={DESCRIPTION_BY_TYPE[type]}
                  value={draftPreferences[type]}
                  disabled={preferencesState.notificationsMuted}
                  onToggle={() =>
                    setDraftPreferences((current) => ({
                      ...(current ?? draftPreferences),
                      [type]: !(current ?? draftPreferences)[type],
                    }))
                  }
                />
              ))}
            </View>

            <Button onPress={() => void handleSave()} disabled={isSaving || !hasChanges}>
              {isSaving ? 'Saving...' : 'Save Notification Preferences'}
            </Button>
          </>
        )
      ) : null}
    </View>
  );
}

function PreferenceSwitch({
  label,
  description,
  value,
  disabled = false,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { colors, spacing, typography } = useAppTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.text, fontSize: typography.body, fontWeight: '700' }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: typography.caption + 1 }}>{description}</Text>
      </View>
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={label}
        accessibilityState={{ checked: value, disabled }}
        disabled={disabled}
        onPress={onToggle}
        style={({ pressed }) => ({
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: value ? colors.primary : colors.border,
          backgroundColor: value ? colors.infoSurface : colors.background,
          opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
        })}
      >
        <Text style={{ color: value ? colors.primary : colors.text, fontWeight: '800' }}>
          {value ? 'On' : 'Off'}
        </Text>
      </Pressable>
    </View>
  );
}
