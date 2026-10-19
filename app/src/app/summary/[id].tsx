import { router, useLocalSearchParams } from 'expo-router';
import { Check, Plus, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { ErrorText, Loading, PrimaryButton, Screen, SecondaryButton } from '@/components/ui';
import { LANGUAGES } from '@/config/languages';
import { errorText, t } from '@/i18n';
import { ApiError, finishConversation, type FinishResult, type NewWord } from '@/lib/api';
import { fetchUsage, formatClock, MISTAKE_LABELS, type Usage } from '@/lib/data';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

type Meta = { title: string; level: string; language: string; userLines: number };

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, activeLanguage } = useSession();
  const [result, setResult] = useState<FinishResult | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Повторний виклик безпечний: сервер поверне вже готовий розбір.
    finishConversation(id)
      .then(async (res) => {
        const [conv, lines, u] = await Promise.all([
          supabase.from('conversations').select('level, language, custom_topic, topics(title_uk)').eq('id', id).maybeSingle(),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', id).eq('role', 'user'),
          fetchUsage(),
        ]);
        if (cancelled) return;
        const c = conv.data as { level: string; language: string; custom_topic: string | null; topics: { title_uk: string } | null } | null;
        setResult(res);
        setUsage(u);
        setMeta({
          title: c?.topics?.title_uk ?? c?.custom_topic ?? '',
          level: c?.level ?? '',
          language: LANGUAGES.find((l) => l.code === c?.language)?.nameUk.toLowerCase() ?? '',
          userLines: lines.count ?? 0,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(errorText(err instanceof ApiError ? err.code : 'generic'));
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  async function save(words: NewWord[]) {
    if (!result || !session || !activeLanguage) return;
    const rows = words
      .filter((w) => !saved.has(w.word))
      .map((w) => ({
        user_id: session.user.id,
        language: activeLanguage.language,
        word: w.word,
        translation_uk: w.translation_uk,
        example: w.example,
        source_conversation_id: result.conversation_id,
      }));
    if (!rows.length) return;
    const { error: err } = await supabase
      .from('vocab_items')
      .upsert(rows, { onConflict: 'user_id,language,word', ignoreDuplicates: true });
    if (err) setError(errorText('generic'));
    else setSaved((prev) => new Set([...prev, ...rows.map((r) => r.word)]));
  }

  const home = () => router.replace('/');

  if (error && !result) {
    return (
      <Screen>
        <ErrorText>{error}</ErrorText>
        <PrimaryButton
          label={t('common.retry')}
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
        <SecondaryButton label={t('summary.home')} onPress={home} />
      </Screen>
    );
  }
  if (!result || !meta) return <Screen scroll={false}><Loading label={t('summary.loading')} /></Screen>;

  const header = (
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('summary.close')} onPress={home} style={styles.iconBtn}>
        <AnimatedIcon icon={X} animation="none" />
      </Pressable>
      <Text style={styles.headerTitle}>{t('summary.title')}</Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (result.status === 'aborted') {
    return (
      <Screen>
        {header}
        <Text style={styles.body}>{t('summary.aborted')}</Text>
        <PrimaryButton label={t('summary.home')} onPress={home} />
      </Screen>
    );
  }

  const mistakes = showAll ? result.mistakes : result.mistakes.slice(0, 3);
  const allSaved = result.new_words.every((w) => saved.has(w.word));

  return (
    <Screen>
      {header}
      <View style={{ gap: 6 }}>
        <Text style={styles.headline}>{result.mistakes.length <= 2 ? t('summary.great') : t('summary.good')}</Text>
        <Text style={styles.sub}>{meta.title} · {meta.level} · {meta.language}</Text>
      </View>

      <View style={styles.stats}>
        <Stat value={formatClock(result.duration_seconds ?? 0)} label={t('summary.duration')} />
        <Stat value={String(meta.userLines)} label={t('summary.lines')} />
        <Stat value={String(result.mistakes.length)} label={t('summary.mistakesCount')} />
      </View>

      {result.summary ? <Text style={styles.body}>{result.summary}</Text> : null}

      <Text style={styles.section}>{t('summary.mistakes')}</Text>
      {result.mistakes.length === 0 ? <Text style={styles.sub}>{t('summary.noMistakes')}</Text> : null}
      {mistakes.map((m, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.chip}>{MISTAKE_LABELS[m.category] ?? m.category}</Text>
          <Text style={styles.sentence}>
            <Text style={styles.del}>{m.original}</Text>
            {'  '}
            <Text style={styles.ins}> {m.corrected} </Text>
          </Text>
          <Text style={styles.explain}>{m.explanation_uk}</Text>
        </View>
      ))}
      {!showAll && result.mistakes.length > 3 ? (
        <Pressable accessibilityRole="button" onPress={() => setShowAll(true)} style={styles.dashed}>
          <Text style={styles.dashedText}>{t('summary.showMore').replace('{n}', String(result.mistakes.length - 3))}</Text>
        </Pressable>
      ) : null}

      {result.new_words.length ? (
        <>
          <Text style={styles.section}>{t('summary.words')}</Text>
          {result.new_words.map((w) => {
            const isSaved = saved.has(w.word);
            return (
              <View key={w.word} style={styles.wordRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.word}>{w.word}</Text>
                  <Text style={styles.sub}>{w.translation_uk}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('summary.saveWord')} ${w.word}`}
                  disabled={isSaved}
                  onPress={() => save([w])}
                  style={styles.plus}
                >
                  <AnimatedIcon icon={isSaved ? Check : Plus} size={22} color={colors.accent} animation="pop" trigger={isSaved} />
                </Pressable>
              </View>
            );
          })}
          {allSaved ? (
            <Text style={[styles.sub, { color: colors.accent, textAlign: 'center' }]}>{t('summary.saved')}</Text>
          ) : (
            <SecondaryButton label={t('summary.saveAll')} onPress={() => save(result.new_words)} />
          )}
        </>
      ) : null}

      {usage?.plan === 'free' ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>
            {t('summary.freeLeft').replace('{n}', String(Math.floor(usage.remaining_month_seconds / 60)))}
          </Text>
          <Text style={styles.sub}>{t('summary.plusPitch')}</Text>
        </View>
      ) : null}

      {error ? <ErrorText>{error}</ErrorText> : null}
      <PrimaryButton label={t('summary.newConversation')} onPress={() => router.replace('/topics')} />
      <SecondaryButton label={t('summary.done')} onPress={home} />
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  headline: { color: colors.text, fontFamily: fonts.bold, fontSize: 28, lineHeight: 34 },
  sub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 15 },
  small: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  body: { color: colors.text, fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 16, padding: 14 },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 10,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mistakeBg,
    color: colors.mistake,
    fontFamily: fonts.medium,
    fontSize: 12,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  sentence: { color: colors.text, fontFamily: fonts.regular, fontSize: 16, lineHeight: 24 },
  del: { color: colors.textMuted, textDecorationLine: 'line-through' },
  ins: { color: colors.accent, backgroundColor: colors.accentTint, fontFamily: fonts.medium },
  explain: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  dashed: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dashedText: { color: colors.accent, fontFamily: fonts.medium, fontSize: 15 },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  word: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  plus: {
    width: hitTarget,
    height: hitTarget,
    borderRadius: hitTarget / 2,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 4,
  },
  bannerTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
});
