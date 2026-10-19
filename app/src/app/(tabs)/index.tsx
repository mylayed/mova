import { router, useFocusEffect } from 'expo-router';
import { BookOpen, CheckCheck, Flame, MessageCircle, Mic } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { Card, Screen } from '@/components/ui';
import { LANGUAGES } from '@/config/languages';
import { t } from '@/i18n';
import {
  fetchHomeData,
  fetchTopics,
  fetchUsage,
  MISTAKE_LABELS,
  recommendTopic,
  relativeDay,
  type HomeData,
  type Topic,
  type Usage,
} from '@/lib/data';
import { useSession } from '@/lib/session';
import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

const DAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];

export default function HomeScreen() {
  const { activeLanguage } = useSession();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [data, setData] = useState<HomeData | null>(null);
  const [focusCount, setFocusCount] = useState(0);

  // Перечитуємо при кожному поверненні на головну (наприклад, після розмови).
  useFocusEffect(
    useCallback(() => {
      if (!activeLanguage) return;
      let cancelled = false;
      (async () => {
        const [u, topics, d] = await Promise.all([
          fetchUsage(),
          fetchTopics(activeLanguage.language).catch(() => []),
          fetchHomeData(activeLanguage.language).catch(() => null),
        ]);
        if (cancelled) return;
        setUsage(u);
        setTopic(recommendTopic(topics, activeLanguage.level, u?.plan ?? 'free'));
        setData(d);
        setFocusCount((n) => n + 1);
      })();
      return () => {
        cancelled = true;
      };
    }, [activeLanguage]),
  );

  if (!activeLanguage) return null;
  const langName = LANGUAGES.find((l) => l.code === activeLanguage.language)?.nameUk ?? activeLanguage.language;
  const planName = usage ? usage.plan.charAt(0).toUpperCase() + usage.plan.slice(1) : '';
  const start = () => topic && router.push({ pathname: '/conversation', params: { topicId: topic.id, title: topic.title_uk } });
  const today = (new Date().getDay() + 6) % 7;

  const achievements = data
    ? [
        { title: t('home.ach.first'), value: Math.min(data.conversationsCount, 1), target: 1, icon: MessageCircle },
        { title: t('home.ach.streak'), value: Math.min(data.streakDays, 7), target: 7, icon: Flame },
        { title: t('home.ach.words'), value: Math.min(data.vocabTotal, 50), target: 50, icon: BookOpen },
        { title: t('home.ach.articles'), value: Math.min(data.cleanArticlesStreak, 3), target: 3, icon: CheckCheck },
      ]
    : [];

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={styles.hello}>{t('home.greeting')}</Text>
          <Text style={styles.sub}>{langName} · {activeLanguage.level}{planName ? ` · ${planName}` : ''}</Text>
        </View>
        <View style={styles.streak}>
          <AnimatedIcon icon={Flame} size={18} color={colors.mistake} animation="wiggle" trigger={focusCount} />
          <Text style={styles.streakText}>{data?.streakDays ?? 0} {t('home.days')}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLabel}>{t('home.recommendedToday')}</Text>
        <Text style={styles.heroTitle}>{topic?.title_uk ?? '…'}</Text>
        <Text style={styles.sub}>{langName} · {activeLanguage.level} · {t('home.about8')}</Text>
        <Pressable
          accessibilityRole="button"
          disabled={!topic}
          onPress={start}
          style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }, !topic && { opacity: 0.5 }]}
        >
          <AnimatedIcon icon={Mic} size={22} color={colors.onAccent} animation="pulse" trigger={focusCount} />
          <Text style={styles.startLabel}>{t('home.start')}</Text>
        </Pressable>
        <View style={styles.rowBetween}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/topics')} style={{ minHeight: hitTarget, justifyContent: 'center' }}>
            <Text style={styles.link}>{t('home.otherTopic')}</Text>
          </Pressable>
          <Text style={styles.small}>
            {usage ? t('conversation.minutesLeft').replace('{n}', String(Math.floor(usage.remaining_month_seconds / 60))) : ''}
          </Text>
        </View>
      </View>

      <Text style={styles.section}>{t('home.thisWeek')}</Text>
      <View style={styles.stats}>
        <Stat value={data?.weekMinutes} label={t('home.statMinutes')} />
        <Stat value={data?.streakDays} label={t('home.statStreak')} />
        <Stat value={data?.weekWords} label={t('home.statWords')} />
      </View>
      {data ? (
        <Card>
          <WeekChart minutes={data.weekByDay} today={today} />
        </Card>
      ) : null}

      {data?.weakSpots.length ? (
        <>
          <View style={styles.rowBetween}>
            <Text style={styles.section}>{t('home.weakSpots')}</Text>
            <Text style={styles.small}>{t('home.top3')}</Text>
          </View>
          <Card>
            {data.weakSpots.map((w, i) => (
              <View key={w.category} style={[styles.weak, i < data.weakSpots.length - 1 && styles.divider]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.itemTitle}>{MISTAKE_LABELS[w.category] ?? w.category}</Text>
                  <Text style={styles.small}>{w.count} {t('home.mistakesShort')}</Text>
                </View>
                <Progress value={w.count / data.weakSpots[0].count} color={colors.mistake} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {data ? (
        <>
          <Text style={styles.section}>{t('home.achievements')}</Text>
          <View style={styles.grid}>
            {achievements.map((a) => {
              const done = a.value >= a.target;
              return (
                <View key={a.title} style={[styles.ach, done && styles.achDone]}>
                  <View style={[styles.achIcon, done && { backgroundColor: colors.accent }]}>
                    <AnimatedIcon icon={a.icon} size={20} color={done ? colors.onAccent : colors.textMuted} animation="pop" trigger={done ? focusCount : 0} />
                  </View>
                  <Text style={styles.achTitle}>{a.title}</Text>
                  {done ? (
                    <Text style={[styles.small, { color: colors.accent }]}>{t('home.earned')}</Text>
                  ) : (
                    <>
                      <Progress value={a.value / a.target} color={colors.accent} />
                      <Text style={styles.small}>{a.value} {t('home.of')} {a.target}</Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      {data?.recent.length ? (
        <>
          <Text style={styles.section}>{t('home.recent')}</Text>
          <Card>
            {data.recent.map((c, i) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                onPress={() => c.status === 'finished' && router.push({ pathname: '/summary/[id]', params: { id: c.id } })}
                style={[styles.activity, i < data.recent.length - 1 && styles.divider]}
              >
                <View style={styles.activityIcon}>
                  <AnimatedIcon icon={MessageCircle} size={18} color={colors.accent} animation="none" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>«{c.title}» · {Math.max(1, Math.round(c.durationSeconds / 60))} {t('common.minutesShort')}</Text>
                  <Text style={styles.small}>{c.mistakes} {t('home.mistakesShort')}</Text>
                </View>
                <Text style={styles.small}>{relativeDay(c.startedAt)}</Text>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ value, label }: { value: number | undefined; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value ?? '–'}</Text>
      <Text style={styles.small}>{label}</Text>
    </View>
  );
}

function Progress({ value, color }: { value: number; color: string }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

// Хвилини розмов по днях тижня (як у макеті): сьогодні — яскравіше, порожні дні — тонка риска.
function WeekChart({ minutes, today }: { minutes: number[]; today: number }) {
  const W = 318;
  const H = 120;
  const max = Math.max(1, ...minutes);
  const slot = W / 7;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} accessibilityLabel={minutes.map((m, i) => `${DAYS[i]} ${m}`).join(', ')}>
      {minutes.map((m, i) => {
        const x = i * slot + (slot - 26) / 2;
        const h = m > 0 ? Math.max(6, (m / max) * 80) : 4;
        const y = 92 - h;
        return (
          <Rect
            key={i}
            x={x}
            y={y}
            width={26}
            height={h}
            rx={m > 0 ? 6 : 2}
            fill={m > 0 ? colors.accent : colors.cardBorder}
            fillOpacity={m > 0 && i !== today ? 0.5 : 1}
          />
        );
      })}
      {minutes.map((m, i) =>
        m > 0 && i === today ? (
          <SvgText key={`v${i}`} x={i * slot + slot / 2} y={92 - Math.max(6, (m / max) * 80) - 4} fill={colors.text} fontSize={11} fontWeight="600" textAnchor="middle">
            {m}
          </SvgText>
        ) : null,
      )}
      {DAYS.map((d, i) => (
        <SvgText key={d} x={i * slot + slot / 2} y={112} fill={i === today ? colors.text : colors.textMuted} fontSize={11} textAnchor="middle">
          {d}
        </SvgText>
      ))}
    </Svg>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  hello: { color: colors.text, fontFamily: fonts.bold, fontSize: 26 },
  sub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  small: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  link: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  streakText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  hero: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
    gap: 6,
  },
  heroLabel: { color: colors.accent, fontFamily: fonts.medium, fontSize: 13 },
  heroTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  startBtn: {
    marginTop: 14,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  startLabel: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 17 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  section: { color: colors.text, fontFamily: fonts.semibold, fontSize: 20, marginTop: spacing.sm },
  stats: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 2,
  },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 24 },
  weak: { paddingVertical: 10, gap: 8 },
  divider: { borderBottomColor: colors.cardBorder, borderBottomWidth: 1 },
  itemTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.cardBorder, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ach: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 14,
    gap: 10,
  },
  achDone: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder },
  achIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  achTitle: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15, lineHeight: 19 },
  activity: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: hitTarget },
  activityIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
