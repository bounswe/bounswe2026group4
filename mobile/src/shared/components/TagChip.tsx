import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useAppTheme } from '../../core/hooks/useAppTheme';

const TAG_PALETTE = [
  { background: '#FFE4E6', text: '#BE123C', border: '#FDA4AF' },
  { background: '#FFEDD5', text: '#C2410C', border: '#FDBA74' },
  { background: '#FEF3C7', text: '#B45309', border: '#FCD34D' },
  { background: '#FEF9C3', text: '#A16207', border: '#FDE047' },
  { background: '#ECFCCB', text: '#4D7C0F', border: '#BEF264' },
  { background: '#DCFCE7', text: '#15803D', border: '#86EFAC' },
  { background: '#CCFBF1', text: '#0F766E', border: '#5EEAD4' },
  { background: '#E0F2FE', text: '#0369A1', border: '#7DD3FC' },
  { background: '#DBEAFE', text: '#1D4ED8', border: '#93C5FD' },
  { background: '#EDE9FE', text: '#6D28D9', border: '#C4B5FD' },
  { background: '#F3E8FF', text: '#7E22CE', border: '#D8B4FE' },
  { background: '#FCE7F3', text: '#BE185D', border: '#F9A8D4' },
];

function getTagColors(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

export function formatTagLabel(value: string) {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

interface TagChipProps {
  label: string;
  value: string;
  selected?: boolean;
  removable?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
  onPress?: ((event?: { stopPropagation?: () => void }) => void) | (() => void);
}

export function TagChip({
  label,
  value,
  selected = false,
  removable = false,
  disabled = false,
  accessibilityLabel,
  testID,
  onPress,
}: TagChipProps) {
  const { spacing, typography } = useAppTheme();
  const colors = getTagColors(value);
  const isInteractive = Boolean(onPress) && !disabled;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Text
        style={{
          color: colors.text,
          fontSize: typography.caption + 1,
          fontWeight: '700',
          lineHeight: typography.caption + 1,
          includeFontPadding: false,
        }}
      >
        {label}
      </Text>
      {removable ? (
        <View style={{ width: 12, height: 12, alignItems: 'center', justifyContent: 'center' }}>
          <X size={12} color={colors.text} strokeWidth={2.5} />
        </View>
      ) : null}
    </View>
  );

  if (!isInteractive) {
    return (
      <View
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.sm + spacing.xs,
          paddingVertical: spacing.xs,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: selected ? colors.border : 'transparent',
          backgroundColor: colors.background,
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      testID={testID}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm + spacing.xs,
        paddingVertical: spacing.xs,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? colors.border : 'transparent',
        backgroundColor: colors.background,
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      {content}
    </Pressable>
  );
}
