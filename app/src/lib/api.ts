import { FunctionsHttpError } from '@supabase/supabase-js';

import type { Level } from '@/config/languages';
import { supabase } from '@/lib/supabase';

// Помилка серверної функції з машинним кодом (limit_reached, premium_topic…).
export class ApiError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

async function call<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>(name, { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const res = error.context as Response;
      const payload = await res.json().catch(() => ({})) as { error?: string };
      throw new ApiError(payload.error ?? 'internal_error', res.status);
    }
    throw new ApiError('network_error', 0);
  }
  return data as T;
}

export type Reply = {
  text: string;
  spoken_text: string;
  audio_base64: string | null;
  audio_mime: string | null;
};

export type StartResult = {
  conversation_id: string;
  level: Level;
  model: 'haiku' | 'sonnet';
  reply: Reply;
  remaining_seconds: number;
  remaining_month_seconds: number;
};

export type TurnResult = {
  user_text: string;
  reply: Reply;
  remaining_seconds: number;
  remaining_month_seconds: number;
  should_finish: boolean;
};

export type Mistake = {
  category: string;
  original: string;
  corrected: string;
  explanation_uk: string;
};

export type NewWord = { word: string; translation_uk: string; example: string };

export type FinishResult = {
  conversation_id: string;
  status: 'finished' | 'aborted';
  duration_seconds?: number;
  summary: string | null;
  mistakes: Mistake[];
  new_words: NewWord[];
};

export function startConversation(params: { language: string; topicId?: string; customTopic?: string }) {
  return call<StartResult>('conversation-start', {
    language: params.language,
    topic_id: params.topicId,
    custom_topic: params.customTopic,
  });
}

// Текст набраний або розпізнаний на пристрої. Без durationMs тривалість рахує сервер за словами.
export function sendTurn(conversationId: string, text: string, durationMs?: number) {
  return call<TurnResult>('conversation-turn', { conversation_id: conversationId, text, duration_ms: durationMs });
}

export type Hint = { suggestion: string; translation_uk: string };

export function getHint(conversationId: string) {
  return call<Hint>('conversation-hint', { conversation_id: conversationId });
}

export function finishConversation(conversationId: string) {
  return call<FinishResult>('conversation-finish', { conversation_id: conversationId });
}

export function deleteAccount() {
  return call<{ deleted: boolean }>('delete-account', {});
}
