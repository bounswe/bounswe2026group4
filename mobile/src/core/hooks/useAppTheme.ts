import { lightColors, spacing, typography } from '../../app/theme';

export function useAppTheme() {
  const colorScheme = 'light';
  const colors = lightColors;

  return { colors, spacing, typography, colorScheme };
}
