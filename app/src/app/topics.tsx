import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Card, Loading, OptionRow, PrimaryButton, Screen, SecondaryButton, TextField, Title } from '@/components/ui';
import { t } from '@/i18n';
import { fetchTopics, fetchUsage, fitsLevel, type Topic, type Usage } from '@/lib/data';
import { useSession } from '@/lib/session';
import { fonts, spacing } from '@/theme/tokens';

export default function TopicsScreen() {
  const { activeLanguage } = useSession();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [plan, setPlan] = useState<Usage['plan']>('free');
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (!activeLanguage) return;
    fetchTopics(activeLanguage.language).then(setTopics).catch(() => setTopics([]));
    fetchUsage().then((u) => u && setPlan(u.plan));
  }, [activeLanguage]);

  if (!activeLanguage || !topics) return <Screen scroll={false}><Loading /></Screen>;

  const level = activeLanguage.level;
  const mine = topics.filter((tp) => fitsLevel(tp, level));
  const other = topics.filter((tp) => !fitsLevel(tp, level));

  const start = (tp: Topic) =>
    router.replace({ pathname: '/conversation', params: { topicId: tp.id, title: tp.title_uk } });

  const renderTopic = (tp: Topic) => {
    const locked = tp.is_premium && plan === 'free';
    return (
      <OptionRow
        key={tp.id}
        title={tp.title_uk}
        subtitle={`${tp.title_en} · ${tp.level_min}–${tp.level_max}`}
        badge={tp.is_premium ? t('topics.premium') : undefined}
        disabled={locked}
        onPress={() => start(tp)}
      />
    );
  };

  return (
    <Screen>
      <Title>{t('topics.title')}</Title>

      <Card>
        <Body style={styles.section}>{t('topics.custom')}</Body>
        <TextField
          value={custom}
          onChangeText={setCustom}
          placeholder={t('topics.customPlaceholder')}
          maxLength={200}
        />
        <PrimaryButton
          label={t('home.start')}
          disabled={custom.trim().length < 3}
          onPress={() => router.replace({ pathname: '/conversation', params: { customTopic: custom.trim(), title: custom.trim() } })}
        />
      </Card>

      <Body style={styles.section}>{t('topics.forLevel')} ({level})</Body>
      <View style={styles.list}>{mine.map(renderTopic)}</View>

      {other.length ? (
        <>
          <Body style={styles.section}>{t('topics.other')}</Body>
          <View style={styles.list}>{other.map(renderTopic)}</View>
        </>
      ) : null}

      <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.semibold, fontSize: 17 },
  list: { gap: spacing.sm },
});
