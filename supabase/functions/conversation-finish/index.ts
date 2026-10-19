// Завершення розмови: підсумок, помилки й слова для повторення.
// POST JSON { conversation_id }. Повторний виклик повертає вже готовий розбір.

import { analyzeConversation, type Feedback } from '../_shared/claude.ts';
import { loadConversation, loadMessages, recordUsage, type ConversationRow, type MessageRow } from '../_shared/conversation.ts';
import { handler, json } from '../_shared/http.ts';
import { estimateCost } from '../_shared/policy.ts';
import { feedbackSystemPrompt, formatTranscript } from '../_shared/prompts.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const conv = await loadConversation(admin, body.conversation_id, user.id);

  const existing = await loadReport(admin, conv.id);
  if (existing) return json(existing);

  const messages = await loadMessages(admin, conv.id);
  const endedAt = new Date().toISOString();

  // Користувач нічого не сказав — розбирати нічого, просто закриваємо розмову.
  if (!messages.some((m) => m.role === 'user')) {
    await admin.from('conversations').update({ status: 'aborted', ended_at: endedAt }).eq('id', conv.id);
    return json({ conversation_id: conv.id, status: 'aborted', summary: null, mistakes: [], new_words: [] });
  }

  // Ставимо статус одразу, щоб паралельні conversation-turn більше не приймали репліки.
  await admin.from('conversations').update({ status: 'finished', ended_at: endedAt }).eq('id', conv.id);

  const { feedback, usage } = await analyzeConversation(
    conv.model,
    feedbackSystemPrompt(conv.language, conv.level),
    formatTranscript(messages),
  );

  await saveReport(admin, conv, user.id, messages, feedback);
  await recordUsage(admin, {
    userId: user.id,
    conversationId: conv.id,
    kind: 'finish',
    seconds: 0,
    estCost: estimateCost({ model: conv.model, ...usage, ttsSeconds: 0, sttSeconds: 0 }),
  });

  return json({
    conversation_id: conv.id,
    status: 'finished',
    duration_seconds: conv.duration_seconds,
    summary: feedback.summary_uk,
    mistakes: feedback.mistakes.map(({ line: _line, ...m }) => m),
    // Слова не зберігаються автоматично: користувач обирає їх кнопкою «Зберегти слова» (vocab_items).
    new_words: feedback.new_words,
  });
}));

type Admin = ReturnType<typeof adminClient>;

async function saveReport(admin: Admin, conv: ConversationRow, userId: string, messages: MessageRow[], feedback: Feedback) {
  const { error: reportError } = await admin.from('feedback_reports').insert({
    conversation_id: conv.id,
    user_id: userId,
    summary: feedback.summary_uk,
    new_words: feedback.new_words,
  });
  if (reportError) throw reportError;

  // Номер рядка в транскрипті → id репліки; помилки лише в репліках користувача.
  const rows = feedback.mistakes.map((m) => {
    const message = messages[m.line - 1];
    return {
      user_id: userId,
      language: conv.language,
      conversation_id: conv.id,
      message_id: message?.role === 'user' ? message.id : null,
      category: m.category,
      original: m.original,
      corrected: m.corrected,
      explanation_uk: m.explanation_uk,
    };
  });
  if (rows.length) {
    const { error } = await admin.from('mistakes').insert(rows);
    if (error) throw error;
  }
}

async function loadReport(admin: Admin, conversationId: string) {
  const { data: report } = await admin
    .from('feedback_reports')
    .select('summary, new_words')
    .eq('conversation_id', conversationId)
    .maybeSingle<{ summary: string; new_words: Feedback['new_words'] }>();
  if (!report) return null;

  const { data: mistakes } = await admin
    .from('mistakes')
    .select('category, original, corrected, explanation_uk')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  const { data: conv } = await admin
    .from('conversations')
    .select('duration_seconds')
    .eq('id', conversationId)
    .single<{ duration_seconds: number }>();

  return {
    conversation_id: conversationId,
    status: 'finished',
    duration_seconds: conv?.duration_seconds ?? 0,
    summary: report.summary,
    mistakes: mistakes ?? [],
    new_words: report.new_words,
  };
}
