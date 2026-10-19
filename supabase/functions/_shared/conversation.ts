import type { SupabaseClient } from '@supabase/supabase-js';

import type { Turn } from './claude.ts';
import { HttpError } from './http.ts';
import type { Level, ModelTier, Plan } from './policy.ts';
import { KICKOFF_MESSAGE, tutorSystemPrompt } from './prompts.ts';

export type UsageStatus = {
  plan: Plan;
  monthly_limit_seconds: number;
  used_month_seconds: number;
  used_today_seconds: number;
  used_conversation_seconds: number;
  remaining_seconds: number;
};

export async function usageStatus(admin: SupabaseClient, userId: string, conversationId?: string): Promise<UsageStatus> {
  const { data, error } = await admin
    .rpc('usage_status', { p_user_id: userId, p_conversation_id: conversationId ?? null })
    .single<UsageStatus>();
  if (error || !data) throw error ?? new Error('usage_status returned nothing');
  return data;
}

export type ConversationRow = {
  id: string;
  user_id: string;
  language: string;
  level: Level;
  model: ModelTier;
  status: 'active' | 'finished' | 'aborted';
  custom_topic: string | null;
  duration_seconds: number;
  topics: { title_en: string; prompt_hint: string } | null;
};

export async function loadConversation(admin: SupabaseClient, id: unknown, userId: string): Promise<ConversationRow> {
  if (typeof id !== 'string' || !id) throw new HttpError(400, 'conversation_id_required');
  const { data, error } = await admin
    .from('conversations')
    .select('id, user_id, language, level, model, status, custom_topic, duration_seconds, topics(title_en, prompt_hint)')
    .eq('id', id)
    .maybeSingle<ConversationRow>();
  if (error) throw error;
  // Чужа розмова виглядає як неіснуюча.
  if (!data || data.user_id !== userId) throw new HttpError(404, 'conversation_not_found');
  return data;
}

export function systemPromptFor(conv: ConversationRow): string {
  return tutorSystemPrompt({
    language: conv.language,
    level: conv.level,
    topicTitle: conv.topics?.title_en ?? conv.custom_topic ?? 'Free conversation',
    topicHint: conv.topics?.prompt_hint ?? null,
  });
}

export type MessageRow = { id: string; role: 'assistant' | 'user'; text: string };

export async function loadMessages(admin: SupabaseClient, conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await admin
    .from('messages')
    .select('id, role, text')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Історія для Claude: стартер + збережені репліки (перша репліка завжди від репетитора).
export function toTurns(messages: Pick<MessageRow, 'role' | 'text'>[]): Turn[] {
  return [{ role: 'user', text: KICKOFF_MESSAGE }, ...messages.map((m) => ({ role: m.role, text: m.text }))];
}

export async function insertMessage(
  admin: SupabaseClient,
  conversationId: string,
  role: 'assistant' | 'user',
  text: string,
  durationMs: number | null,
): Promise<string> {
  const { data, error } = await admin
    .from('messages')
    .insert({ conversation_id: conversationId, role, text, duration_ms: durationMs })
    .select('id')
    .single<{ id: string }>();
  if (error || !data) throw error ?? new Error('message insert failed');
  return data.id;
}

export async function recordUsage(
  admin: SupabaseClient,
  event: { userId: string; conversationId: string; kind: 'start' | 'turn' | 'finish'; seconds: number; estCost: number },
): Promise<void> {
  const { error } = await admin.from('usage_events').insert({
    user_id: event.userId,
    conversation_id: event.conversationId,
    kind: event.kind,
    seconds: event.seconds,
    est_cost: event.estCost,
  });
  if (error) throw error;
}
