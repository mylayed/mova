import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Body, Card, Screen, Title } from '@/components/ui';
import { LANGUAGES } from '@/config/languages';
import { t } from '@/i18n';
import { fetchUsage, formatMinutes, type Usage } from '@/lib/data';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { session, languages, activeLanguage } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUsage().then(setUsage);
    }, []),
  );

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>
      <Body muted>{session?.user.email}</Body>

      <Card>
        <Body muted>{t('profile.myLanguages')}</Body>
        {languages.map((l) => (
          <View key={l.language} style={styles.row}>
            <Body>
              {l.language.toUpperCase()} · {LANGUAGES.find((x) => x.code === l.language)?.nameUk ?? l.language}
            </Body>
            <Body style={l.language === activeLanguage?.language ? { color: colors.accent } : undefined}>{l.level}</Body>
          </View>
        ))}
      </Card>

      <Card>
        <Row label={t('profile.uiLanguage')} value="Українська" />
        <Row label={t('profile.plan')} value={usage ? usage.plan.toUpperCase() : '…'} />
        <Row
          label={t('profile.minutesLeft')}
          value={usage ? `${formatMinutes(usage.remaining_month_seconds)} / ${formatMinutes(usage.monthly_limit_seconds)}` : '…'}
        />
      </Card>

      <Card>
        <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.action}>
          <Body>{t('profile.signOut')}</Body>
        </Pressable>
        <View style={[styles.row, styles.action]}>
          <Body style={{ color: colors.mistake }}>{t('profile.deleteAccount')}</Body>
          <Body muted style={{ fontSize: 13 }}>{t('common.soon')}</Body>
        </View>
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Body>{label}</Body>
      <Body muted>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: spacing.sm },
  action: { minHeight: 44, justifyContent: 'center' },
});
