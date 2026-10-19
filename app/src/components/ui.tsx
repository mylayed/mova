import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {scroll ? <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">{children}</ScrollView> : children}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

type TextProps = { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean };

export function Title({ children, style }: TextProps) {
  return <Text style={[styles.title, style]}>{children}</Text>;
}

export function Body({ children, style, muted }: TextProps) {
  return <Text style={[styles.body, muted && styles.muted, style]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Text style={styles.error}>{children}</Text>;
}

type ButtonProps = { label: string; onPress?: () => void; disabled?: boolean; loading?: boolean };

export function PrimaryButton({ label, onPress, disabled, loading }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }, inactive && { opacity: 0.5 }]}
    >
      {loading ? <ActivityIndicator color={colors.onAccent} /> : <Text style={styles.primaryLabel}>{label}</Text>}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, disabled }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.7 }, disabled && { opacity: 0.5 }]}
    >
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

export function Chip({ label, onPress, selected }: { label: string; onPress?: () => void; selected?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, selected && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

// Рядок-вибір у списку (мова, рівень, тема).
export function OptionRow({
  title,
  subtitle,
  selected,
  disabled,
  badge,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  disabled?: boolean;
  badge?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionSelected,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.45 },
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.optionSubtitle}>{subtitle}</Text> : null}
      </View>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </Pressable>
  );
}

export function TextField(props: TextInputProps) {
  return <TextInput placeholderTextColor={colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
      {label ? <Body muted>{label}</Body> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  body: { color: colors.text, fontFamily: fonts.regular, fontSize: 16 },
  muted: { color: colors.textMuted },
  error: { color: colors.mistake, fontFamily: fonts.medium, fontSize: 14 },
  primary: {
    minHeight: hitTarget + 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryLabel: { color: colors.onAccent, fontFamily: fonts.semibold, fontSize: 17 },
  secondary: {
    minHeight: hitTarget,
    borderRadius: radius.pill,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  chip: {
    minHeight: hitTarget,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  option: {
    minHeight: hitTarget + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  optionSelected: { borderColor: colors.accent },
  optionTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  optionSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  badge: {
    color: colors.accent,
    fontFamily: fonts.semibold,
    fontSize: 12,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  input: {
    minHeight: hitTarget + 4,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 16,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg },
});
