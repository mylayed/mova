// Видалення акаунта (вимога Apple: користувач має могти видалити акаунт у застосунку).
// POST без тіла. Видаляє користувача з auth.users; усі його дані (профіль, мови, розмови, репліки,
// помилки, слова, використання, підписка) видаляються каскадом через зовнішні ключі.

import { handler, json } from '../_shared/http.ts';
import { adminClient, requireUser } from '../_shared/supabase.ts';

Deno.serve(handler(async (req) => {
  const admin = adminClient();
  const user = await requireUser(req, admin);

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) throw error;

  return json({ deleted: true });
}));
