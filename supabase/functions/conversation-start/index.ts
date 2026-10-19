// Початок розмови: перевірка ліміту → нова розмова → перша репліка репетитора з озвучкою.
// POST JSON { language, level?, topic_id? | custom_topic? }

import { tutorReply } from '../_shared/claude.ts';
import { insertMessage, recordUsage, systemPromptFor, toTurns, usageStatus, type ConversationRow } from '../_shared/conversation.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { estimateCost, estimateSpeechSeconds, isLevel, MIN_SECONDS_TO_START, pickModel, type Level } from '../_shared/policy.ts';
import { spokenPart, synthesize } from '../_shared/speech.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

const MAX_CUSTOM_TOPIC_LENGTH = 200;

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;

  const language = typeof body.language === 'string' ? body.language : '';
  const { data: lang } = await admin.from('languages').select('code, enabled').eq('code', language).maybeSingle();
  if (!lang?.enabled) throw new HttpError(400, 'language_not_available');

  const topicId = typeof body.topic_id === 'string' ? body.topic_id : null;
  const customTopic = typeof body.custom_topic === 'string' ? body.custom_topic.trim().slice(0, MAX_CUSTOM_TOPIC_LENGTH) : '';
  if (!topicId && !customTopic) throw new HttpError(400, 'topic_required');

  const level = await resolveLevel(admin, user.id, language, body.level);

  const usage = await usageStatus(admin, user.id);
  if (usage.remaining_seconds < MIN_SECONDS_TO_START) {
    throw new HttpError(402, 'limit_reached');
  }

  if (topicId) {
    const { data: topic } = await admin.from('topics').select('id, language, is_premium').eq('id', topicId).maybeSingle();
    if (!topic || topic.language !== language) throw new HttpError(400, 'topic_not_found');
    if (topic.is_premium && usage.plan === 'free') throw new HttpError(402, 'premium_topic');
  }

  const model = pickModel(usage.plan, level);
  const { data: conv, error } = await admin
    .from('conversations')
    .insert({
      user_id: user.id,
      language,
      topic_id: topicId,
      custom_topic: topicId ? null : customTopic,
      level,
      model,
    })
    .select('id, user_id, language, level, model, status, custom_topic, duration_seconds, topics(title_en, prompt_hint)')
    .single<ConversationRow>();
  if (error || !conv) throw error ?? new Error('conversation insert failed');

  await admin
    .from('user_languages')
    .update({ last_active_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('language', language);

  const reply = await tutorReply(model, systemPromptFor(conv), toTurns([]));
  const audio = await synthesize(spokenPart(reply.text), level);
  const replySeconds = estimateSpeechSeconds(spokenPart(reply.text), level);

  await insertMessage(admin, conv.id, 'assistant', reply.text, replySeconds * 1000);
  await recordUsage(admin, {
    userId: user.id,
    conversationId: conv.id,
    kind: 'start',
    seconds: replySeconds,
    estCost: estimateCost({ model, ...reply.usage, ttsSeconds: replySeconds, sttSeconds: 0 }),
  });
  await admin.from('conversations').update({ duration_seconds: replySeconds }).eq('id', conv.id);

  const after = await usageStatus(admin, user.id, conv.id);
  return json({
    conversation_id: conv.id,
    level,
    model,
    reply: { text: reply.text, audio_base64: audio.base64, audio_mime: audio.mime },
    remaining_seconds: after.remaining_seconds,
    remaining_month_seconds: Math.max(0, after.monthly_limit_seconds - after.used_month_seconds),
  });
}));

// Рівень із запиту або з user_languages; мову без рівня додаємо до «Моїх мов».
async function resolveLevel(
  admin: ReturnType<typeof adminClient>,
  userId: string,
  language: string,
  requested: unknown,
): Promise<Level> {
  const { data } = await admin
    .from('user_languages')
    .select('level')
    .eq('user_id', userId)
    .eq('language', language)
    .maybeSingle<{ level: Level }>();

  if (isLevel(requested)) {
    if (!data) await admin.from('user_languages').insert({ user_id: userId, language, level: requested });
    return requested;
  }
  if (data) return data.level;
  throw new HttpError(400, 'level_required');
}
