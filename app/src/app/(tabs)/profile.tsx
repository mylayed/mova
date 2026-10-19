import { useFocusEffect } from 'expo-router';
import { Gauge, Languages, LogOut, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { Body, Card, Chip, ErrorText, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { LANGUAGES, LEVELS, type Level } from '@/config/languages';
import { errorText, t } from '@/i18n';
import { ApiError, deleteAccount } from '@/lib/api';
import { fetchUsage, formatMinutes, type Usage } from '@/lib/data';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/theme/tokens';

export default function ProfileScreen() {
  const { session, languages, activeLanguage, refresh } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchUsage().then(setUsage);
    }, []),
  );

  async function changeLevel(level: Level) {
    if (!session || !activeLanguage || level === activeLanguage.level) return;
    const { error: err } = await supabase
      .from('user_languages')
      .update({ level })
      .eq('user_id', session.user.id)
      .eq('language', activeLanguage.language);
    if (err) setError(errorText('generic'));
    else await refresh();
  }

  async function removeAccount() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      // Сесія вже недійсна; вихід очистить її на пристрої, і навігатор поверне на екран входу.
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      setDeleting(false);
      setError(errorText(err instanceof ApiError ? err.code : 'generic'));
    }
  }

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>
      <Body muted>{session?.user.email}</Body>

      <Card>
        <View style={styles.sectionHead}>
          <AnimatedIcon icon={Languages} size={20} color={colors.accent} animation="none" />
          <Body style={styles.sectionTitle}>{t('profile.myLanguages')}</Body>
        </View>
        {languages.map((l) => (
          <View key={l.language} style={styles.row}>
            <Body>
              {l.language.toUpperCase()} · {LANGUAGES.find((x) => x.code === l.language)?.nameUk ?? l.language}
            </Body>
            <Body style={l.language === activeLanguage?.language ? { color: colors.accent } : undefined}>{l.level}</Body>
          </View>
        ))}
        <Body muted style={{ fontSize: 13 }}>{t('profile.level')}</Body>
        <View style={styles.chips}>
          {LEVELS.map((level) => (
            <Chip key={level} label={level} selected={activeLanguage?.level === level} onPress={() => changeLevel(level)} />
          ))}
        </View>
      </Card>

      <Card>
        <View style={styles.sectionHead}>
          <AnimatedIcon icon={Gauge} size={20} color={colors.accent} animation="none" />
          <Body style={styles.sectionTitle}>{t('profile.plan')}: {usage ? usage.plan.toUpperCase() : '…'}</Body>
        </View>
        <Row
          label={t('profile.minutesLeft')}
          value={usage ? `${formatMinutes(usage.remaining_month_seconds)} / ${formatMinutes(usage.monthly_limit_seconds)}` : '…'}
        />
        <Row label={t('profile.uiLanguage')} value="Українська" />
      </Card>

      <Card>
        <Pressable accessibilityRole="button" onPress={() => supabase.auth.signOut()} style={styles.action}>
          <AnimatedIcon icon={LogOut} size={20} color={colors.text} animation="none" />
          <Body>{t('profile.signOut')}</Body>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setConfirmDelete(true)} style={styles.action}>
          <AnimatedIcon icon={Trash2} size={20} color={colors.mistake} animation="wiggle" trigger={confirmDelete} />
          <Body style={{ color: colors.mistake }}>{t('profile.deleteAccount')}</Body>
        </Pressable>
        {confirmDelete ? (
          <View style={styles.confirm}>
            <Body>{t('profile.deleteWarning')}</Body>
            <PrimaryButton label={t('profile.deleteConfirm')} onPress={removeAccount} loading={deleting} />
            <SecondaryButton label={t('profile.deleteCancel')} onPress={() => setConfirmDelete(false)} disabled={deleting} />
          </View>
        ) : null}
        {error ? <ErrorText>{error}</ErrorText> : null}
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
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { fontFamily: fonts.semibold },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 36, gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  action: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  confirm: { gap: spacing.sm, paddingTop: spacing.sm, borderTopColor: colors.cardBorder, borderTopWidth: 1 },
});
