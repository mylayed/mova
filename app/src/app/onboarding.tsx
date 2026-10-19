import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, ErrorText, Loading, OptionRow, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { LANGUAGES, LEVELS, type LanguageCode, type Level } from '@/config/languages';
import { errorText, levelDescription, t } from '@/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

type LanguageRow = { code: LanguageCode; name_uk: string; enabled: boolean };

export default function OnboardingScreen() {
  const { session, refresh } = useSession();
  const [languages, setLanguages] = useState<LanguageRow[] | null>(null);
  const [language, setLanguage] = useState<LanguageCode | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [step, setStep] = useState<'language' | 'level'>('language');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('languages')
      .select('code, name_uk, enabled')
      .order('sort_order')
      .then(({ data }) => {
        // Запасний список з конфігу, якщо база недоступна.
        const rows = (data as LanguageRow[] | null)?.length
          ? (data as LanguageRow[])
          : LANGUAGES.map((l) => ({ code: l.code, name_uk: l.nameUk, enabled: l.enabled }));
        setLanguages(rows);
        setLanguage(rows.find((r) => r.enabled)?.code ?? null);
      });
  }, []);

  async function save() {
    if (!session || !language || !level) return;
    setBusy(true);
    setError(null);
    const { error: langError } = await supabase
      .from('user_languages')
      .upsert({ user_id: session.user.id, language, level }, { onConflict: 'user_id,language' });
    const { error: profileError } = langError
      ? { error: langError }
      : await supabase.from('profiles').update({ active_language: language }).eq('id', session.user.id);
    if (profileError) {
      setBusy(false);
      setError(errorText('generic'));
      return;
    }
    // Після оновлення навігатор сам перейде на головну.
    await refresh();
  }

  if (!languages) return <Screen scroll={false}><Loading /></Screen>;

  if (step === 'language') {
    return (
      <Screen>
        <Title>{t('onboarding.languageTitle')}</Title>
        <View style={styles.list}>
          {languages.map((l) => (
            <OptionRow
              key={l.code}
              title={`${l.code.toUpperCase()} · ${l.name_uk}`}
              selected={language === l.code}
              disabled={!l.enabled}
              badge={l.enabled ? undefined : t('common.soon')}
              onPress={() => setLanguage(l.code)}
            />
          ))}
        </View>
        <PrimaryButton label={t('common.continue')} disabled={!language} onPress={() => setStep('level')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('onboarding.levelTitle')}</Title>
      <Body muted>{t('onboarding.levelHint')}</Body>
      <View style={styles.list}>
        {LEVELS.map((l) => (
          <OptionRow
            key={l}
            title={l}
            subtitle={levelDescription(l)}
            selected={level === l}
            onPress={() => setLevel(l)}
          />
        ))}
      </View>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('onboarding.start')} disabled={!level} loading={busy} onPress={save} />
      <SecondaryButton label={t('common.back')} onPress={() => setStep('language')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
});
