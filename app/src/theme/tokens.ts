// Візуальний стиль Mova: темна тема, один акцентний колір (див. PLAN.md, розділ дизайну в Notion).
export const colors = {
  bg: '#0E1014',
  card: '#171A21',
  cardBorder: '#2A2F3A',
  surface: '#1E222B',
  text: '#ECEEF3',
  textMuted: '#98A0AE',
  accent: '#5EE0B8',
  onAccent: '#08241C',
  mistake: '#F2B880',
  mistakeBg: 'rgba(242, 184, 128, 0.12)',
} as const;

export const radius = {
  card: 18,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

// Мінімальна ціль натискання.
export const hitTarget = 44;

export const fonts = {
  regular: 'Onest_400Regular',
  medium: 'Onest_500Medium',
  semibold: 'Onest_600SemiBold',
  bold: 'Onest_700Bold',
} as const;
