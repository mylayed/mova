// Підказка в розмові: що користувач може сказати далі (з перекладом українською).
// POST JSON { conversation_id }. Нічого не пише в розмову й не списує хвилини.

import { suggestReply } from '../_shared/claude.ts';
import { loadConversation, loadMessages, recordUsage, systemPromptFor, toTurns } from '../_shared/conversation.ts';
import { handler, HttpError, json } from '../_shared/http.ts';
import { estimateCost } from '../_shared/policy.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const conv = await loadConversation(admin, body.conversation_id, user.id);
  if (conv.status !== 'active') throw new HttpError(409, 'conversation_finished');

  const messages = await loadMessages(admin, conv.id);
  const { hint, usage } = await suggestReply(conv.model, systemPromptFor(conv), toTurns(messages), conv.level);

  // Вартість враховуємо для контролю економіки, секунди — ні.
  await recordUsage(admin, {
    userId: user.id,
    conversationId: conv.id,
    kind: 'turn',
    seconds: 0,
    estCost: estimateCost({ model: conv.model, ...usage, ttsSeconds: 0, sttSeconds: 0 }),
  });

  return json(hint);
}));
