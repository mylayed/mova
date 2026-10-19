import { StyleSheet, View } from 'react-native';

import { Body, Card, Chip, PrimaryButton, Screen, Title } from '@/components/ui';
import { t } from '@/i18n';
import { colors, fonts, spacing } from '@/theme/tokens';

// Тимчасові дані до підключення Supabase (етап 1, бекенд).
const mock = {
  language: 'EN · Англійська · B1',
  topic: 'Співбесіда на роботу',
  minutesLeft: 20,
  streak: 0,
  weekMinutes: 0,
  newWords: 0,
};

export default function HomeScreen() {
  return (
    <Screen>
      <View style={styles.header}>
        <Title>{t('home.greeting')}</Title>
        <Chip label={mock.language} />
      </View>

      <Card>
        <Body muted>{t('home.recommended')}</Body>
        <Body style={styles.topic}>{mock.topic}</Body>
        <PrimaryButton label={t('home.start')} />
        <Body muted style={styles.center}>
          {t('home.minutesLeft')}: {mock.minutesLeft}
        </Body>
      </Card>

      <View style={styles.stats}>
        <Stat label={t('home.streak')} value={mock.streak} />
        <Stat label={t('home.weekMinutes')} value={mock.weekMinutes} />
        <Stat label={t('home.newWords')} value={mock.newWords} />
      </View>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={styles.stat}>
      <Body style={styles.statValue}>{value}</Body>
      <Body muted style={styles.statLabel}>{label}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  topic: { fontFamily: fonts.semibold, fontSize: 20, marginBottom: spacing.sm },
  center: { textAlign: 'center', fontSize: 14 },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fonts.bold, fontSize: 22, color: colors.accent },
  statLabel: { fontSize: 12, textAlign: 'center' },
});
