/**
 * Fudget design tokens — aligned to Figma redesign (9NzoMoJJqyC2cA4WH9Czek)
 * Soft gray canvas; forest green accent; white elevated cards.
 */

export const colors = {
  green: {
    950: '#004d00',
    /** Primary interactive — Figma #008438. */
    700: '#008438',
    400: '#66b3a1',
    200: '#b2e0d4',
    /** Selected chip / day tint — Figma #e1f5ec. */
    50: '#e1f5ec',
  },
  /** Warm rust scale — expense amount token + orange wedges. */
  rust: {
    950: '#7c2d12',
    700: '#9a3412',
    500: '#c2410c',
    400: '#ea580c',
    200: '#fdba74',
  },
  /** Cool blues — income chart wedges (with greens). */
  blue: {
    700: '#1d4ed8',
    500: '#2563eb',
    400: '#60a5fa',
    200: '#bfdbfe',
  },
  /** Expense chart — red wedges (distinct from amount `expense` token). */
  chartRed: {
    800: '#9f1239',
    500: '#e11d48',
  },
  /** Expense chart — purple wedges. */
  chartPurple: {
    700: '#7e22ce',
    400: '#a855f7',
  },
  /** Expense chart — deep yellow / amber wedges. */
  chartAmber: {
    700: '#a16207',
    500: '#ca8a04',
  },
  /** Soft gray page background (Figma #f6f7f8). */
  canvas: '#f6f7f8',
  /** Primary body text (Figma #202923). */
  ink: '#202923',
  /** Secondary labels (Figma #717972). */
  inkMuted: '#717972',
  /** Soft / placeholder / weekday (Figma #929a95). */
  inkSoft: '#929a95',
  inkInverse: '#ffffff',
  /** Raised card / chrome surface. */
  surface: '#ffffff',
  /** Input fills / muted wells (matches canvas). */
  surfaceMuted: '#f6f7f8',
  /** Content hairlines (Figma #e3e8e4). */
  border: '#e3e8e4',
  /** Nav / tab chrome — same quiet green-gray as content borders. */
  chromeBorder: '#e3e8e4',
  /** Chart grid lines (Figma #edf0ee). */
  gridLine: '#edf0ee',
  danger: '#b42318',
  warning: '#b54708',
  /** Income amounts (= green.700). */
  income: '#008438',
  /** Expense amounts (Figma #a65335). */
  expense: '#a65335',
  /** Soft fills behind category glyphs. */
  incomeTint: '#e1f5ec',
  expenseTint: '#faeee7',
  overlay: 'rgba(32, 41, 35, 0.45)',
  /** @deprecated Use colors.rust[500] — kept for any stray imports. */
  chartWarm: '#c2410c',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  /** Screen horizontal padding in Figma frames. */
  screen: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  /** Chips / small controls. */
  sm: 9,
  /** Buttons, inputs, month chevrons. */
  md: 12,
  /** Day cells / small tiles. */
  tile: 10,
  /** Cards / sheets (Figma 18). */
  lg: 18,
  /** FAB squircle (Figma 18 on 50px). */
  fab: 18,
  full: 999,
} as const;

/** Loaded via @expo-google-fonts — family names match useFonts keys. */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  /** Screen titles — DM Sans (Figma uses Inter; keep brand fonts). */
  title: 'DMSans_600SemiBold',
  /** Large page titles render closer to Figma Regular 27. */
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
  /** In-page hero title (Transactions / Stats / Planner / Account). */
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

/** Optional elevation only — default UI uses soft card lift, no multi-layer. */
export const shadow = {
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
  /**
   * Scroll-edge cue when content is clipped under the header / above the tab bar.
   * Soft ink wash — not multi-layer chrome elevation.
   */
  scrollEdge: {
    color: 'rgba(32, 41, 35, 0.07)',
    height: 8,
  },
} as const;

/**
 * Shared 1px chrome separators for nav headers + tab bar.
 * Prefer over `StyleSheet.hairlineWidth` so edges stay visible on retina.
 */
export const chromeHairline = {
  width: 1,
  color: colors.chromeBorder,
} as const;

/** Stack / tab header style: soft canvas + bottom chrome hairline, no platform shadow. */
export const navHeaderStyle = {
  backgroundColor: colors.canvas,
  borderBottomWidth: chromeHairline.width,
  borderBottomColor: chromeHairline.color,
  elevation: 0,
  shadowOpacity: 0,
} as const;

/** Navigation / Themed light+dark maps (MVP ships light; dark mapped to brand neutrals). */
export const Colors = {
  light: {
    text: colors.ink,
    background: colors.canvas,
    tint: colors.green[700],
    tabIconDefault: colors.inkMuted,
    tabIconSelected: colors.green[700],
    border: colors.border,
    chromeBorder: colors.chromeBorder,
    surface: colors.surface,
    surfaceMuted: colors.surfaceMuted,
    danger: colors.danger,
    warning: colors.warning,
  },
  dark: {
    text: colors.inkInverse,
    background: colors.green[950],
    tint: colors.green[400],
    tabIconDefault: colors.green[200],
    tabIconSelected: colors.green[400],
    border: colors.green[700],
    chromeBorder: colors.green[700],
    surface: '#0f1c14',
    surfaceMuted: '#1a2a1f',
    danger: '#ff8a80',
    warning: '#fbbf24',
  },
} as const;

export type ThemeColorName = keyof typeof Colors.light;

export const theme = {
  colors,
  space,
  radius,
  fonts,
  typography,
  shadow,
  Colors,
} as const;

export default theme;
