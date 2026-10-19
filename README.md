# Mova

Мобільний застосунок для вивчення мов: голосові розмови з ШІ за темою й рівнем + граматика на основі реальних помилок. План розробки — у [PLAN.md](PLAN.md).

## Структура

- `app/` — застосунок на Expo (SDK 58, Expo Router, TypeScript)
- `supabase/` — міграції бази даних, згодом Edge Functions

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

Вхід через Apple і Google вмикається в панелі Supabase → Authentication → Providers.
