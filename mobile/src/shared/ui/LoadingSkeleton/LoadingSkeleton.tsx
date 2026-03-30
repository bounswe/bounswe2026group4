import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useAppTheme } from '../../../core/hooks/useAppTheme';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
}

interface SkeletonCardProps {
  showMedia?: boolean;
}

interface SkeletonPageProps {
  cardCount?: number;
}

function SkeletonBlock({
  width = '100%',
  height = 16,
  borderRadius = 8,
}: SkeletonProps) {
  const { colors } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius,
        backgroundColor: colors.border,
        opacity,
      }}
    />
  );
}

export function Skeleton(props: SkeletonProps) {
  return <SkeletonBlock {...props} />;
}

export function SkeletonCard({ showMedia = true }: SkeletonCardProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View
      style={{
        padding: spacing.md,
        borderRadius: 16,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        gap: spacing.sm,
      }}
    >
      {showMedia ? <SkeletonBlock height={160} borderRadius={12} /> : null}
      <SkeletonBlock width="78%" height={18} />
      <SkeletonBlock width="100%" />
      <SkeletonBlock width="66%" />
    </View>
  );
}

export function SkeletonPage({ cardCount = 3 }: SkeletonPageProps) {
  const { colors, spacing } = useAppTheme();

  return (
    <View style={{ padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background }}>
      <SkeletonBlock width="42%" height={28} />
      <SkeletonBlock width="100%" />
      <SkeletonBlock width="84%" />
      <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
        {Array.from({ length: cardCount }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </View>
    </View>
  );
}
