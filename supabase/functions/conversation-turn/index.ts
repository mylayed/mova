// Обмін репліками: голос/текст користувача → (STT) → Claude → TTS.
// POST multipart/form-data { conversation_id, audio, duration_ms }  — розпізнавання на сервері
//   або JSON { conversation_id, text, duration_ms }                  — розпізнавання на пристрої (безкоштовне)

import { tutorReply } from '../_shared/claude.ts';
import {
  insertMessage,
  loadConversation,
  loadMessages,
  recordUsage,
  systemPromptFor,
  toTurns,
  usageStatus,
} from '../_shared/conversation.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { clampUserSeconds, estimateCost, estimateSpeechSeconds } from '../_shared/policy.ts';
import { replyPayload, spokenPart, synthesize, transcribe } from '../_shared/speech.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

const MAX_TEXT_LENGTH = 1000;

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const input = await readInput(req);

  const conv = await loadConversation(admin, input.conversationId, user.id);
  if (conv.status !== 'active') throw new HttpError(409, 'conversation_finished');

  // Ліміт перевіряємо до будь-яких платних викликів.
  const before = await usageStatus(admin, user.id, conv.id);
  if (before.remaining_seconds <= 0) throw new HttpError(402, 'limit_reached');

  const rawText = input.audio ? await transcribe(input.audio, conv.language) : input.text;
  const userText = rawText.slice(0, MAX_TEXT_LENGTH).trim();
  // Нічого не розпізнано: просимо повторити, хвилини не списуємо.
  if (!userText) throw new HttpError(422, 'nothing_heard');

  const userSeconds = clampUserSeconds(input.durationMs, userText, conv.level);
  const sttSeconds = input.audio ? userSeconds : 0;
  const history = await loadMessages(admin, conv.id);
  await insertMessage(admin, conv.id, 'user', userText, userSeconds * 1000);

  const reply = await tutorReply(conv.model, systemPromptFor(conv), toTurns([...history, { role: 'user', text: userText }]));
  const spoken = spokenPart(reply.text);
  const audio = await synthesize(spoken, conv.level);
  const replySeconds = estimateSpeechSeconds(spoken, conv.level);
  await insertMessage(admin, conv.id, 'assistant', reply.text, replySeconds * 1000);

  const turnSeconds = userSeconds + replySeconds;
  await recordUsage(admin, {
    userId: user.id,
    conversationId: conv.id,
    kind: 'turn',
    seconds: turnSeconds,
    estCost: estimateCost({ model: conv.model, ...reply.usage, ttsSeconds: audio ? replySeconds : 0, sttSeconds }),
  });
  await admin
    .from('conversations')
    .update({ duration_seconds: conv.duration_seconds + turnSeconds })
    .eq('id', conv.id);

  const after = await usageStatus(admin, user.id, conv.id);
  return json({
    user_text: userText,
    reply: replyPayload(reply.text, spoken, audio),
    remaining_seconds: after.remaining_seconds,
    remaining_month_seconds: Math.max(0, after.monthly_limit_seconds - after.used_month_seconds),
    // Час вичерпано: застосунок дограє відповідь і викликає conversation-finish.
    should_finish: after.remaining_seconds <= 0,
  });
}));

type TurnInput = { conversationId: unknown; text: string; audio: File | null; durationMs: unknown };

async function readInput(req: Request): Promise<TurnInput> {
  const type = req.headers.get('content-type') ?? '';
  if (type.startsWith('multipart/form-data')) {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) throw new HttpError(400, 'audio_required');
    return {
      conversationId: form.get('conversation_id'),
      text: '',
      audio,
      durationMs: Number(form.get('duration_ms')),
    };
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (typeof body.text !== 'string') throw new HttpError(400, 'text_or_audio_required');
  return { conversationId: body.conversation_id, text: body.text, audio: null, durationMs: body.duration_ms };
}
