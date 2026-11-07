/**
 * Fudget design tokens — light + dark palettes from Figma
 * (9NzoMoJJqyC2cA4WH9Czek). Prefer useTheme().colors over the static
 * `colors` export when a screen must react to Appearance preference.
 */

export type ColorSchemePreference = 'light' | 'dark';

/** Shared brand / chart scales that stay fixed across schemes. */
const brandGreens = {
  /** Deepest brand (light pressed / dark on-primary text). */
  950: '#004d00',
  700: '#008438',
  400: '#66b3a1',
  200: '#b2e0d4',
  50: '#e1f5ec',
} as const;

const rust = {
  950: '#7c2d12',
  700: '#9a3412',
  500: '#c2410c',
  400: '#ea580c',
  200: '#fdba74',
} as const;

const blue = {
  700: '#1d4ed8',
  500: '#2563eb',
  400: '#60a5fa',
  200: '#bfdbfe',
} as const;

const chartRed = { 800: '#9f1239', 500: '#e11d48' } as const;
const chartPurple = { 700: '#7e22ce', 400: '#a855f7' } as const;
const chartAmber = { 700: '#a16207', 500: '#ca8a04' } as const;

export type ThemeColors = {
  green: {
    950: string;
    700: string;
    400: string;
    200: string;
    50: string;
  };
  rust: typeof rust;
  blue: typeof blue;
  chartRed: typeof chartRed;
  chartPurple: typeof chartPurple;
  chartAmber: typeof chartAmber;
  canvas: string;
  ink: string;
  inkMuted: string;
  inkSoft: string;
  /** Text/icons on primary CTAs (white in light; deep green on mint in dark). */
  inkInverse: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  chromeBorder: string;
  gridLine: string;
  danger: string;
  warning: string;
  income: string;
  expense: string;
  incomeTint: string;
  expenseTint: string;
  overlay: string;
  chartWarm: string;
  /** Primary CTA pressed fill (deep forest in light; darker mint in dark). */
  primaryPressed: string;
};

/** Light — Figma paper-white redesign (shipped a7551f8). */
export const lightColors: ThemeColors = {
  green: { ...brandGreens },
  rust,
  blue,
  chartRed,
  chartPurple,
  chartAmber,
  canvas: '#f6f7f8',
  ink: '#202923',
  inkMuted: '#717972',
  inkSoft: '#929a95',
  inkInverse: '#ffffff',
  surface: '#ffffff',
  surfaceMuted: '#f6f7f8',
  border: '#e3e8e4',
  chromeBorder: '#e3e8e4',
  gridLine: '#edf0ee',
  danger: '#b42318',
  warning: '#b54708',
  income: '#008438',
  expense: '#a65335',
  incomeTint: '#e1f5ec',
  expenseTint: '#faeee7',
  overlay: 'rgba(32, 41, 35, 0.45)',
  chartWarm: '#c2410c',
  primaryPressed: '#004d00',
};

/**
 * Dark — Figma Dark ·* frames.
 * Primary interactive flips to mint `#62d99c`; CTA label uses deep green.
 */
export const darkColors: ThemeColors = {
  green: {
    /** Emphasis titles that were deep forest in light → mint in dark. */
    950: '#62d99c',
    700: '#62d99c',
    400: '#66b3a1',
    200: '#203e2e',
    50: '#203e2e',
  },
  rust,
  blue,
  chartRed,
  chartPurple,
  chartAmber,
  canvas: '#121815',
  ink: '#eff4f0',
  inkMuted: '#a5b2aa',
  inkSoft: '#85958b',
  /** On mint primary buttons / FAB glyph. */
  inkInverse: '#092b18',
  surface: '#1c2420',
  surfaceMuted: '#252e29',
  border: '#354139',
  chromeBorder: '#354139',
  gridLine: '#354139',
  danger: '#f07167',
  warning: '#f0a081',
  income: '#62d99c',
  expense: '#f0a081',
  incomeTint: '#203e2e',
  expenseTint: '#3b2b24',
  overlay: 'rgba(8, 12, 10, 0.6)',
  chartWarm: '#f0a081',
  primaryPressed: '#3db87a',
};

export const palettes = {
  light: lightColors,
  dark: darkColors,
} as const;

/**
 * Default static export — light palette.
 * Screens that must follow the user preference should use `useTheme().colors`.
 */
export const colors = lightColors;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  screen: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 9,
  md: 12,
  tile: 10,
  lg: 18,
  fab: 18,
  full: 999,
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  title: 'DMSans_600SemiBold',
  pageTitle: 'DMSans_400Regular',
  body: 'DMSans_400Regular',
  bodyStrong: 'DMSans_600SemiBold',
  caption: 'DMSans_500Medium',
  amount: 'DMSans_700Bold',
} as const;

export const typography = {
  display: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 34,
  },
  pageTitle: {
    fontFamily: fonts.pageTitle,
    fontSize: 27,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  title: {
    fontFamily: fonts.title,
    fontSize: 22,
    lineHeight: 28,
  },
  section: {
    fontFamily: fonts.bodyStrong,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  month: {
    fontFamily: fonts.bodyStrong,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.4,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
  },
  bodyStrong: {
    fontFamily: fonts.bodyStrong,
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fonts.caption,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  amount: {
    fontFamily: fonts.amount,
    fontSize: 20,
    lineHeight: 26,
    fontVariant: ['tabular-nums'] as const,
  },
} as const;

export type ThemeShadow = {
  sm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  card: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  scrollEdge: {
    color: string;
    height: number;
  };
};

export const shadow: ThemeShadow = {
  sm: {
    shadowColor: '#202923',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#202923',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollEdge: {
    color: 'rgba(32, 41, 35, 0.07)',
    height: 8,
  },
};

export const darkShadow: ThemeShadow = {
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 1,
  },
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 2,
  },
  scrollEdge: {
    color: 'rgba(0, 0, 0, 0.35)',
    height: 8,
  },
};

export function chromeHairlineFor(c: ThemeColors) {
  return { width: 1, color: c.chromeBorder } as const;
}

export const chromeHairline = {
  width: 1,
  color: lightColors.chromeBorder,
} as const;

export function navHeaderStyleFor(c: ThemeColors) {
  return {
    backgroundColor: c.canvas,
    borderBottomWidth: 1,
    borderBottomColor: c.chromeBorder,
    elevation: 0,
    shadowOpacity: 0,
  } as const;
}

export const navHeaderStyle = navHeaderStyleFor(lightColors);

/** Navigation / Themed maps — keep in sync with palettes. */
export const Colors = {
  light: {
    text: lightColors.ink,
    background: lightColors.canvas,
    tint: lightColors.green[700],
    tabIconDefault: lightColors.inkMuted,
    tabIconSelected: lightColors.green[700],
    border: lightColors.border,
    chromeBorder: lightColors.chromeBorder,
    surface: lightColors.surface,
    surfaceMuted: lightColors.surfaceMuted,
    danger: lightColors.danger,
    warning: lightColors.warning,
  },
  dark: {
    text: darkColors.ink,
    background: darkColors.canvas,
    tint: darkColors.green[700],
    tabIconDefault: darkColors.inkMuted,
    tabIconSelected: darkColors.green[700],
    border: darkColors.border,
    chromeBorder: darkColors.chromeBorder,
    surface: darkColors.surface,
    surfaceMuted: darkColors.surfaceMuted,
    danger: darkColors.danger,
    warning: darkColors.warning,
  },
} as const;

export type ThemeColorName = keyof typeof Colors.light;

export const theme = {
  colors: lightColors,
  palettes,
  space,
  radius,
  fonts,
  typography,
  shadow,
  Colors,
} as const;

export default theme;
