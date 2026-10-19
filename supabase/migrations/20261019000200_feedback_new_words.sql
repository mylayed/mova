-- Запропоновані слова з розбору зберігаються разом із підсумком,
-- щоб повторне відкриття підсумку показувало той самий список (у vocab_items — лише збережені користувачем).
alter table public.feedback_reports
  add column new_words jsonb not null default '[]'::jsonb;
