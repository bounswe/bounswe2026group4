import { useColorScheme } from 'react-native';
import { darkColors, lightColors, spacing, typography } from '../../app/theme';

export function useAppTheme() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;

  return { colors, spacing, typography, colorScheme };
}
