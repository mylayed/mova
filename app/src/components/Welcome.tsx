import AsyncStorage from '@react-native-async-storage/async-storage';
import { BookOpen, CheckCheck, Mic, type LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { PrimaryButton } from '@/components/ui';
import { t, type TranslationKey } from '@/i18n';
import { colors, fonts, spacing } from '@/theme/tokens';

const SEEN_KEY = 'mova.welcomeSeen';

const SLIDES: { icon: LucideIcon; title: TranslationKey; text: TranslationKey }[] = [
  { icon: Mic, title: 'welcome.1.title', text: 'welcome.1.text' },
  { icon: CheckCheck, title: 'welcome.2.title', text: 'welcome.2.text' },
  { icon: BookOpen, title: 'welcome.3.title', text: 'welcome.3.text' },
];

// Чи показувати вітальні слайди (лише до першого входу на цьому пристрої).
export function useWelcomeSeen(): [boolean | null, () => void] {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(SEEN_KEY)
      .then((v) => setSeen(v === '1'))
      .catch(() => setSeen(true));
  }, []);
  const markSeen = () => {
    setSeen(true);
    AsyncStorage.setItem(SEEN_KEY, '1').catch(() => {});
  };
  return [seen, markSeen];
}

export function Welcome({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={onDone} style={styles.skip}>
          <Text style={styles.skipText}>{t('welcome.skip')}</Text>
        </Pressable>
      </View>

      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <AnimatedIcon icon={slide.icon} size={44} color={colors.onAccent} animation="pop" trigger={index} />
        </View>
        <Text style={styles.title}>{t(slide.title)}</Text>
        <Text style={styles.text}>{t(slide.text)}</Text>
      </View>

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton label={last ? t('welcome.start') : t('common.continue')} onPress={() => (last ? onDone() : setIndex(index + 1))} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, minHeight: 600 },
  top: { alignItems: 'flex-end' },
  skip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  skipText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, textAlign: 'center', lineHeight: 34 },
  text: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 17, textAlign: 'center', lineHeight: 25, maxWidth: 340 },
  bottom: { gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cardBorder },
  dotActive: { width: 24, backgroundColor: colors.accent },
});
