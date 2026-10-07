import { useColorScheme } from 'react-native';
import { usePrefs } from '../store/prefs';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  elevated: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  overlay: string;
  tabBar: string;
  keypad: string;
}

const dark: Palette = {
  bg: '#0B0B12',
  surface: '#14141D',
  surfaceAlt: '#1B1B27',
  elevated: '#1F1F2D',
  border: '#262636',
  borderStrong: '#34344A',
  text: '#F4F4F8',
  textSecondary: '#A9A9BD',
  textMuted: '#6F6F86',
  accent: '#8B7CF6',
  accentSoft: 'rgba(139,124,246,0.16)',
  onAccent: '#FFFFFF',
  success: '#34D399',
  successSoft: 'rgba(52,211,153,0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251,191,36,0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.14)',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: '#101018',
  keypad: '#1B1B27',
};

const light: Palette = {
  bg: '#F5F5FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEFF6',
  elevated: '#FFFFFF',
  border: '#E4E4EE',
  borderStrong: '#D2D2DF',
  text: '#13131C',
  textSecondary: '#55556A',
  textMuted: '#8C8CA1',
  accent: '#6D5CE8',
  accentSoft: 'rgba(109,92,232,0.10)',
  onAccent: '#FFFFFF',
  success: '#059669',
  successSoft: 'rgba(5,150,105,0.10)',
  warning: '#B45309',
  warningSoft: 'rgba(217,119,6,0.12)',
  danger: '#DC2626',
  dangerSoft: 'rgba(220,38,38,0.10)',
  overlay: 'rgba(10,10,20,0.45)',
  tabBar: '#FFFFFF',
  keypad: '#FFFFFF',
};

export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const type = {
  largeTitle: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 24, fontWeight: '800' as const, letterSpacing: -0.3 },
  h2: { fontSize: 19, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21 },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '500' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
  label: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
};

export function useTheme(): { c: Palette; dark: boolean } {
  const pref = usePrefs(s => s.theme);
  const system = useColorScheme();
  const isDark = pref === 'dark' || (pref === 'system' && system !== 'light');
  return { c: isDark ? dark : light, dark: isDark };
}

/** Adds alpha to a #RRGGBB color. */
export function alpha(hex: string, a: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
