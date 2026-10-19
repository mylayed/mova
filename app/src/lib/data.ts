import { LEVELS, type LanguageCode, type Level } from '@/config/languages';
import { supabase } from '@/lib/supabase';

export type Topic = {
  id: string;
  slug: string;
  title_uk: string;
  title_en: string;
  level_min: Level;
  level_max: Level;
  is_premium: boolean;
};

export type Usage = {
  plan: 'free' | 'plus' | 'pro';
  monthly_limit_seconds: number;
  used_month_seconds: number;
  remaining_month_seconds: number;
  next_conversation_seconds: number;
};

export async function fetchTopics(language: LanguageCode): Promise<Topic[]> {
  const { data, error } = await supabase
    .from('topics')
    .select('id, slug, title_uk, title_en, level_min, level_max, is_premium')
    .eq('language', language)
    .order('sort_order');
  if (error) throw error;
  return (data as Topic[]) ?? [];
}

export function fitsLevel(topic: Pick<Topic, 'level_min' | 'level_max'>, level: Level): boolean {
  const i = LEVELS.indexOf(level);
  return i >= LEVELS.indexOf(topic.level_min) && i <= LEVELS.indexOf(topic.level_max);
}

// Тема дня: доступні за рівнем і тарифом теми по черзі, щоб рекомендація змінювалась щодня.
export function recommendTopic(topics: Topic[], level: Level, plan: Usage['plan'], today = new Date()): Topic | null {
  const options = topics.filter((tp) => fitsLevel(tp, level) && (plan !== 'free' || !tp.is_premium));
  if (!options.length) return null;
  const day = Math.floor(today.getTime() / 86_400_000);
  return options[day % options.length];
}

export async function fetchUsage(): Promise<Usage | null> {
  const { data } = await supabase.rpc('my_usage').maybeSingle<Usage>();
  return data ?? null;
}

export type HomeStats = { streakDays: number; weekMinutes: number; weekWords: number };

export async function fetchHomeStats(language: LanguageCode): Promise<HomeStats> {
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [convs, words] = await Promise.all([
    supabase
      .from('conversations')
      .select('started_at, duration_seconds')
      .eq('language', language)
      .gte('started_at', since60),
    supabase
      .from('vocab_items')
      .select('id', { count: 'exact', head: true })
      .eq('language', language)
      .gte('created_at', since7),
  ]);
  const rows = (convs.data as { started_at: string; duration_seconds: number }[] | null) ?? [];
  const weekSeconds = rows
    .filter((r) => r.started_at >= since7)
    .reduce((sum, r) => sum + r.duration_seconds, 0);
  return {
    streakDays: streakDays(rows.map((r) => new Date(r.started_at))),
    weekMinutes: Math.round(weekSeconds / 60),
    weekWords: words.count ?? 0,
  };
}

// Серія днів поспіль з розмовою; сьогоднішній день ще можна «добрати», тож серія не рветься до кінця дня.
export function streakDays(dates: Date[], today = new Date()): number {
  const days = new Set(dates.map(dayKey));
  const cursor = new Date(today);
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (days.has(dayKey(cursor))) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function formatMinutes(seconds: number): string {
  return String(Math.floor(seconds / 60));
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export type ConversationSummary = {
  id: string;
  title: string;
  status: 'active' | 'finished' | 'aborted';
  startedAt: Date;
  durationSeconds: number;
  mistakes: number;
};

export type MistakeRow = { conversation_id: string; category: string; created_at: string };

export type HomeData = HomeStats & {
  weekByDay: number[]; // хвилини розмов пн..нд поточного тижня
  weakSpots: { category: string; count: number }[];
  recent: ConversationSummary[];
  conversationsCount: number;
  vocabTotal: number;
  cleanArticlesStreak: number;
};

// Усе для головної одним набором запитів до наявних таблиць (без витрат на ШІ).
export async function fetchHomeData(language: LanguageCode): Promise<HomeData> {
  const since60 = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [convs, mistakes, vocabWeek, vocabTotal, convCount] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, started_at, duration_seconds, custom_topic, topics(title_uk)')
      .eq('language', language)
      .gte('started_at', since60)
      .order('started_at', { ascending: false }),
    supabase
      .from('mistakes')
      .select('conversation_id, category, created_at')
      .eq('language', language)
      .gte('created_at', since60),
    supabase.from('vocab_items').select('id', { count: 'exact', head: true }).eq('language', language).gte('created_at', since7),
    supabase.from('vocab_items').select('id', { count: 'exact', head: true }).eq('language', language),
    supabase.from('conversations').select('id', { count: 'exact', head: true }).eq('language', language).eq('status', 'finished'),
  ]);

  type ConvRow = {
    id: string;
    status: ConversationSummary['status'];
    started_at: string;
    duration_seconds: number;
    custom_topic: string | null;
    topics: { title_uk: string } | null;
  };
  const rows = (convs.data as ConvRow[] | null) ?? [];
  const mistakeRows = (mistakes.data as MistakeRow[] | null) ?? [];

  const perConv = new Map<string, number>();
  for (const m of mistakeRows) perConv.set(m.conversation_id, (perConv.get(m.conversation_id) ?? 0) + 1);

  const weekSeconds = rows.filter((r) => r.started_at >= since7).reduce((s, r) => s + r.duration_seconds, 0);

  // Хвилини по днях поточного тижня (з понеділка).
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const weekByDay = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) {
    const d = new Date(r.started_at);
    const idx = Math.floor((d.getTime() - monday.getTime()) / 86_400_000);
    if (idx >= 0 && idx < 7) weekByDay[idx] += r.duration_seconds / 60;
  }

  const weekCounts = new Map<string, number>();
  for (const m of mistakeRows) if (m.created_at >= since7) weekCounts.set(m.category, (weekCounts.get(m.category) ?? 0) + 1);
  const weakSpots = [...weekCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // Скільки останніх завершених розмов поспіль без помилок з артиклями.
  const articleConvs = new Set(mistakeRows.filter((m) => m.category === 'articles').map((m) => m.conversation_id));
  let cleanArticlesStreak = 0;
  for (const r of rows.filter((c) => c.status === 'finished')) {
    if (articleConvs.has(r.id)) break;
    cleanArticlesStreak += 1;
  }

  return {
    streakDays: streakDays(rows.map((r) => new Date(r.started_at))),
    weekMinutes: Math.round(weekSeconds / 60),
    weekWords: vocabWeek.count ?? 0,
    weekByDay: weekByDay.map((m) => Math.round(m)),
    weakSpots,
    recent: rows
      .filter((r) => r.status !== 'aborted')
      .slice(0, 3)
      .map((r) => ({
        id: r.id,
        title: r.topics?.title_uk ?? r.custom_topic ?? '',
        status: r.status,
        startedAt: new Date(r.started_at),
        durationSeconds: r.duration_seconds,
        mistakes: perConv.get(r.id) ?? 0,
      })),
    conversationsCount: convCount.count ?? 0,
    vocabTotal: vocabTotal.count ?? 0,
    cleanArticlesStreak,
  };
}

export function relativeDay(date: Date, today = new Date()): string {
  const a = new Date(date);
  a.setHours(0, 0, 0, 0);
  const b = new Date(today);
  b.setHours(0, 0, 0, 0);
  const days = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  if (days <= 0) return 'сьогодні';
  if (days === 1) return 'вчора';
  if (days < 7) return `${days} дн. тому`;
  return a.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
}

export const MISTAKE_LABELS: Record<string, string> = {
  articles: 'Артиклі',
  tenses: 'Часи',
  word_order: 'Порядок слів',
  prepositions: 'Прийменники',
  vocabulary: 'Лексика',
  other: 'Інше',
};
