# Mova

Мобільний застосунок для вивчення мов: голосові розмови з ШІ за темою й рівнем + граматика на основі реальних помилок. План розробки — у [PLAN.md](PLAN.md).

## Структура

- `app/` — застосунок на Expo (SDK 58, Expo Router, TypeScript)
- `supabase/` — міграції бази даних і Edge Functions

## Застосунок

```bash
cd app
npm install
cp .env.example .env.local   # URL і anon key проєкту Supabase
npm run web                  # або npm run android / npm run ios
npm run typecheck
npm run lint
```

## Supabase

Міграції в `supabase/migrations`:

- `*_core_schema.sql` — таблиці етапу 1, RLS, тригер нового користувача (профіль + тариф free), функції лімітів `usage_status` (для Edge Functions) і `my_usage` (для застосунку)
- `*_reference_data.sql` — мови, ліміти тарифів, стартові теми, бейджі

Застосувати до хмарного проєкту:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase db push
```

Вхід через Google: у Google Cloud Console створіть OAuth Client ID (тип Web application) з redirect URI `https://<ref>.supabase.co/auth/v1/callback`, потім у Supabase → Authentication → Sign In / Providers → Google вставте Client ID і Client Secret. У Redirect URLs мають бути `http://localhost:8081`, `exp://**` і `mova://**`. Apple — пізніше, потрібен акаунт Apple Developer.

## Edge Functions

| Функція | Запит | Що робить |
|---|---|---|
| `conversation-start` | JSON `{ language, level?, topic_id? | custom_topic? }` | перевіряє ліміт, створює розмову, повертає першу репліку Emma з озвучкою |
| `conversation-turn` | multipart `{ conversation_id, audio, duration_ms }` або JSON `{ conversation_id, text, duration_ms }` | розпізнає мовлення (або бере текст з пристрою), відповідає й озвучує, списує секунди |
| `conversation-finish` | JSON `{ conversation_id }` | підсумок, помилки й нові слова; повторний виклик повертає готовий розбір |
| `conversation-hint` | JSON `{ conversation_id }` | підказка: що можна сказати далі, з перекладом; хвилини не списує |
| `delete-account` | POST без тіла | видаляє користувача й усі його дані (каскадом) |

Помилки повертаються як `{ error: "<код>" }`: `limit_reached` (402), `premium_topic` (402), `nothing_heard` (422), `conversation_finished` (409) тощо.

Моделі: Claude Haiku 5.5 для Free і рівнів A1–B1, Claude Sonnet 5.5 для B2+ і Pro (`_shared/policy.ts`). Розпізнавання й озвучка на сервері — через OpenAI (`_shared/speech.ts`), провайдера можна замінити в одному файлі. **`OPENAI_API_KEY` необовʼязковий:** без нього сервер працює лише з текстом — застосунок розпізнає мовлення на пристрої й надсилає `text`, а репліку озвучує сам за полем `reply.spoken_text` (`audio_base64` тоді `null`). Аудіо без ключа відхиляється з кодом `server_stt_disabled`.

```bash
cd supabase/functions
cp .env.example .env              # ANTHROPIC_API_KEY, OPENAI_API_KEY
npx deno task check               # перевірка типів
npx deno task test                # тести правил
npx supabase secrets set --env-file .env
npx supabase functions deploy
```
