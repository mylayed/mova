import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { HttpError } from './http.ts';
import { MODEL_IDS, type ModelTier } from './policy.ts';
import { requireEnv } from './supabase.ts';

// Серверний резерв: якщо модель відмовить з міркувань безпеки, API сам повторить запит
// на моделі за замовчуванням. На моделях без підтримки резерву запит виконується як звичайний.
const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

// Нейтральна репліка, якщо відмовили всі моделі: розмова не обривається.
const REFUSAL_REPLY = "Let's talk about something else. What would you like to discuss?";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') });
  return client;
}

export type Turn = { role: 'user' | 'assistant'; text: string };
export type Usage = { inputTokens: number; outputTokens: number };

// Розмовна репліка репетитора: коротка, без розмірковувань — важлива затримка.
export async function tutorReply(model: ModelTier, system: string, turns: Turn[]): Promise<{ text: string; usage: Usage }> {
  const response = await anthropic().beta.messages.create({
    model: MODEL_IDS[model],
    max_tokens: 400,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    // Haiku 5.5 дозволяє вимкнути розмірковування; Sonnet 5.5 — лише between_tools.
    thinking: model === 'haiku' ? { type: 'disabled' } : { type: 'between_tools' },
    output_config: { effort: 'low' },
    // Кеш останнього блоку: системний промпт і вся попередня історія читаються з кешу.
    cache_control: { type: 'ephemeral' },
    system,
    messages: turns.map((t) => ({ role: t.role, content: t.text })),
  });

  const usage = toUsage(response.usage);
  if (response.stop_reason === 'refusal') {
    console.warn('tutor refusal', response.stop_details?.category);
    return { text: REFUSAL_REPLY, usage };
  }
  const text = response.content
    .flatMap((block) => (block.type === 'text' ? [block.text] : []))
    .join(' ')
    .trim();
  return { text: text || REFUSAL_REPLY, usage };
}

const MISTAKE_CATEGORIES = ['articles', 'tenses', 'word_order', 'prepositions', 'vocabulary', 'other'] as const;

export const FeedbackSchema = z.object({
  summary_uk: z.string(),
  mistakes: z.array(z.object({
    line: z.number().int(),
    category: z.enum(MISTAKE_CATEGORIES),
    original: z.string(),
    corrected: z.string(),
    explanation_uk: z.string(),
  })),
  new_words: z.array(z.object({
    word: z.string(),
    translation_uk: z.string(),
    example: z.string(),
  })),
});

export type Feedback = z.infer<typeof FeedbackSchema>;

// Розбір після розмови: структурована відповідь за схемою.
export async function analyzeConversation(
  model: ModelTier,
  system: string,
  transcript: string,
): Promise<{ feedback: Feedback; usage: Usage }> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL_IDS[model],
    max_tokens: 8000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(FeedbackSchema) },
    system,
    messages: [{ role: 'user', content: `Conversation transcript:\n\n${transcript}` }],
  });

  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    console.error('feedback failed', response.stop_reason);
    throw new HttpError(502, 'feedback_failed');
  }
  return { feedback: response.parsed_output, usage: toUsage(response.usage) };
}

export const HintSchema = z.object({
  suggestion: z.string(),
  translation_uk: z.string(),
});

export type Hint = z.infer<typeof HintSchema>;

// Підказка: одна коротка репліка, яку учень може сказати далі. Той самий системний промпт,
// що й у розмові, тож кеш історії використовується повторно.
export async function suggestReply(
  model: ModelTier,
  system: string,
  turns: Turn[],
  level: string,
): Promise<{ hint: Hint; usage: Usage }> {
  const last = turns[turns.length - 1];
  // Останньою має бути репліка репетитора; просимо підказку окремим повідомленням учня.
  const messages = [
    ...turns.map((t) => ({ role: t.role, content: t.text })),
    {
      role: 'user' as const,
      content:
        `[Not part of the conversation: the learner asks for help. Suggest ONE short, natural reply (CEFR ${level}) ` +
        'they could say next in answer to your last line, and its Ukrainian translation. Do not continue the role-play.]',
    },
  ];
  if (last?.role === 'user') messages.splice(messages.length - 1, 0, { role: 'assistant', content: '…' });

  const response = await anthropic().beta.messages.parse({
    model: MODEL_IDS[model],
    max_tokens: 1000,
    betas: [FALLBACK_BETA],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(HintSchema) },
    system,
    messages,
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    throw new HttpError(502, 'hint_failed');
  }
  return { hint: response.parsed_output, usage: toUsage(response.usage) };
}

function toUsage(usage: Anthropic.Beta.BetaUsage): Usage {
  return {
    inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
    outputTokens: usage.output_tokens,
  };
}
