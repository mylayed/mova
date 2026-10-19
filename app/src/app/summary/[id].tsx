import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Card, ErrorText, Loading, OptionRow, PrimaryButton, Screen, SecondaryButton, Title } from '@/components/ui';
import { errorText, t } from '@/i18n';
import { ApiError, finishConversation, type FinishResult } from '@/lib/api';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/theme/tokens';

// Базовий підсумок: розбір, помилки «було → стало», збереження слів. Повний дизайн — крок 5 плану.
export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, activeLanguage } = useSession();
  const [result, setResult] = useState<FinishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    // Повторний виклик безпечний: сервер поверне вже готовий розбір.
    finishConversation(id)
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setSelected(new Set(res.new_words.map((w) => w.word)));
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err instanceof ApiError ? err.code : 'generic'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = () => {
    setError(null);
    setAttempt((n) => n + 1);
  };

  async function saveWords() {
    if (!result || !session || !activeLanguage) return;
    setSaving(true);
    const rows = result.new_words
      .filter((w) => selected.has(w.word))
      .map((w) => ({
        user_id: session.user.id,
        language: activeLanguage.language,
        word: w.word,
        translation_uk: w.translation_uk,
        example: w.example,
        source_conversation_id: result.conversation_id,
      }));
    const { error: err } = await supabase
      .from('vocab_items')
      .upsert(rows, { onConflict: 'user_id,language,word', ignoreDuplicates: true });
    setSaving(false);
    if (err) setError(errorText('generic'));
    else setSaved(true);
  }

  const home = () => router.replace('/');

  if (error && !result) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton label={t('common.retry')} onPress={retry} />
        <SecondaryButton label={t('summary.home')} onPress={home} />
      </Screen>
    );
  }
  if (!result) return <Screen scroll={false}><Loading label={t('summary.loading')} /></Screen>;

  if (result.status === 'aborted') {
    return (
      <Screen>
        <Title>{t('summary.title')}</Title>
        <Body muted>{t('summary.aborted')}</Body>
        <PrimaryButton label={t('summary.home')} onPress={home} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>{t('summary.title')}</Title>
      {result.summary ? <Card><Body>{result.summary}</Body></Card> : null}

      <Body style={styles.section}>{t('summary.mistakes')} · {result.mistakes.length}</Body>
      {result.mistakes.length === 0 ? <Body muted>{t('summary.noMistakes')}</Body> : null}
      {result.mistakes.map((m, i) => (
        <Card key={i}>
          <Text style={styles.original}>{m.original}</Text>
          <Text style={styles.corrected}>→ {m.corrected}</Text>
          <Body muted style={{ fontSize: 14 }}>{m.explanation_uk}</Body>
        </Card>
      ))}

      {result.new_words.length ? (
        <>
          <Body style={styles.section}>{t('summary.words')}</Body>
          <View style={{ gap: spacing.sm }}>
            {result.new_words.map((w) => (
              <OptionRow
                key={w.word}
                title={`${w.word} — ${w.translation_uk}`}
                subtitle={w.example}
                selected={selected.has(w.word)}
                disabled={saved}
                onPress={() =>
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (next.has(w.word)) next.delete(w.word);
                    else next.add(w.word);
                    return next;
                  })
                }
              />
            ))}
          </View>
          {saved ? (
            <Body style={{ color: colors.accent }}>{t('summary.saved')}</Body>
          ) : (
            <SecondaryButton label={t('summary.saveWords')} onPress={saveWords} disabled={saving || selected.size === 0} />
          )}
        </>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('summary.home')} onPress={home} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontFamily: fonts.semibold, fontSize: 17 },
  original: { color: colors.mistake, fontFamily: fonts.regular, fontSize: 16, textDecorationLine: 'line-through' },
  corrected: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 16 },
});
