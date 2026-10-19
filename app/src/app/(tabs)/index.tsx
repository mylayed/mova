import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Card, Chip, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { LANGUAGES } from '@/config/languages';
import { t } from '@/i18n';
import { fetchHomeStats, fetchTopics, fetchUsage, formatMinutes, recommendTopic, type HomeStats, type Topic, type Usage } from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, fonts, spacing } from '@/theme/tokens';

export default function HomeScreen() {
  const { activeLanguage } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [stats, setStats] = useState<HomeStats | null>(null);

  // Перечитуємо при кожному поверненні на головну (наприклад, після розмови).
  useFocusEffect(
    useCallback(() => {
      if (!activeLanguage) return;
      let cancelled = false;
      (async () => {
        const [u, topics, s] = await Promise.all([
          fetchUsage(),
          fetchTopics(activeLanguage.language).catch(() => []),
          fetchHomeStats(activeLanguage.language).catch(() => null),
        ]);
        if (cancelled) return;
        setUsage(u);
        setTopic(recommendTopic(topics, activeLanguage.level, u?.plan ?? 'free'));
        setStats(s);
      })();
      return () => {
        cancelled = true;
      };
    }, [activeLanguage]),
  );

  if (!activeLanguage) return null;
  const langName = LANGUAGES.find((l) => l.code === activeLanguage.language)?.nameUk ?? activeLanguage.language;

  return (
    <Screen>
      <View style={styles.header}>
        <Title>{t('home.greeting')}</Title>
        <Chip label={`${activeLanguage.language.toUpperCase()} · ${langName} · ${activeLanguage.level}`} />
      </View>

      <Card>
        <Body muted>{t('home.recommended')}</Body>
        <Body style={styles.topic}>{topic?.title_uk ?? '…'}</Body>
        <PrimaryButton
          label={t('home.start')}
          disabled={!topic}
          onPress={() => topic && router.push({ pathname: '/conversation', params: { topicId: topic.id, title: topic.title_uk } })}
        />
        <SecondaryButton label={t('home.otherTopic')} onPress={() => router.push('/topics')} />
        <Body muted style={styles.center}>
          {t('home.minutesLeft')}: {usage ? formatMinutes(usage.remaining_month_seconds) : '…'}
        </Body>
      </Card>

      <View style={styles.stats}>
        <Stat label={t('home.streak')} value={stats?.streakDays} />
        <Stat label={t('home.weekMinutes')} value={stats?.weekMinutes} />
        <Stat label={t('home.newWords')} value={stats?.weekWords} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <Card style={styles.stat}>
      <Body style={styles.statValue}>{value ?? '–'}</Body>
      <Body muted style={styles.statLabel}>{label}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  topic: { fontFamily: fonts.semibold, fontSize: 20, marginBottom: spacing.sm },
  center: { textAlign: 'center', fontSize: 14 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.accent },
  statLabel: { fontSize: 12, textAlign: 'center' },
});
