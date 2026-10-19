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
