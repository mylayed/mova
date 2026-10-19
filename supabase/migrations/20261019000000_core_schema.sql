-- Mova: схема етапу 1 (голосові розмови). Граматика (grammar_*) — окремою міграцією на етапі 2.
-- Принципи:
--   * користувач бачить лише свої рядки (RLS через auth.uid());
--   * розмови, репліки, розбір, використання й підписки пишуть тільки Edge Functions (service role);
--   * аудіо не зберігається, лише текст;
--   * ліміти хвилин рахуються на користувача, а не на мову.

-- ---------------------------------------------------------------------------
-- Довідники
-- ---------------------------------------------------------------------------

-- Мови вивчення. enabled відкриває мову без оновлення застосунку.
create table public.languages (
  code       text primary key check (code ~ '^[a-z]{2}$' and code <> 'ru'),
  name_uk    text not null,
  name_en    text not null,
  enabled    boolean not null default false,
  sort_order int not null default 0
);

-- Ліміти тарифів (секунди). Чернетка цифр — у PLAN.md / Notion, розділ 5.
create table public.plan_limits (
  plan                     text primary key check (plan in ('free', 'plus', 'pro')),
  monthly_seconds          int not null,
  per_conversation_seconds int not null,
  daily_seconds            int not null
);

create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,
  language    text not null references public.languages (code),
  title_uk    text not null,
  title_en    text not null,
  level_min   text not null check (level_min in ('A1','A2','B1','B2','C1','C2')),
  level_max   text not null check (level_max in ('A1','A2','B1','B2','C1','C2')),
  is_premium  boolean not null default false,
  prompt_hint text not null,
  sort_order  int not null default 0,
  unique (language, slug)
);

create table public.achievements (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  title_uk       text not null,
  description_uk text not null,
  icon           text not null,
  rule_type      text not null,
  threshold      int not null default 1
);

-- ---------------------------------------------------------------------------
-- Користувач
-- ---------------------------------------------------------------------------

create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text,
  native_language text not null default 'uk',
  ui_language     text not null default 'uk' check (ui_language in ('uk', 'en')),
  active_language text references public.languages (code),
  created_at      timestamptz not null default now()
);

create table public.user_languages (
  user_id        uuid not null references auth.users (id) on delete cascade,
  language       text not null references public.languages (code),
  level          text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  started_at     timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  primary key (user_id, language)
);

create table public.subscriptions (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  plan               text not null default 'free' references public.plan_limits (plan),
  status             text not null default 'active' check (status in ('active', 'grace', 'expired', 'cancelled')),
  store              text check (store in ('apple', 'google')),
  product_id         text,
  current_period_end timestamptz,
  -- Докуплені хвилини (+60 хв), діють до кінця поточного місяця.
  extra_seconds      int not null default 0 check (extra_seconds >= 0),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Розмови
-- ---------------------------------------------------------------------------

create table public.conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  language         text not null references public.languages (code),
  topic_id         uuid references public.topics (id) on delete set null,
  custom_topic     text,
  level            text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  model            text not null check (model in ('haiku', 'sonnet')),
  status           text not null default 'active' check (status in ('active', 'finished', 'aborted')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int not null default 0,
  check (topic_id is not null or custom_topic is not null)
);
create index conversations_user_language_idx on public.conversations (user_id, language, started_at desc);

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role            text not null check (role in ('assistant', 'user')),
  text            text not null,
  duration_ms     int,
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- Журнал використання: seconds іде в ліміт, est_cost — для контролю економіки.
create table public.usage_events (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  kind            text not null check (kind in ('start', 'turn', 'finish')),
  seconds         int not null default 0 check (seconds >= 0),
  est_cost        numeric(10, 5) not null default 0,
  created_at      timestamptz not null default now()
);
create index usage_events_user_created_idx on public.usage_events (user_id, created_at);

create table public.feedback_reports (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  summary         text not null,
  created_at      timestamptz not null default now()
);

create table public.mistakes (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  language         text not null references public.languages (code),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  message_id       uuid references public.messages (id) on delete set null,
  category         text not null check (category in ('articles', 'tenses', 'word_order', 'prepositions', 'vocabulary', 'other')),
  original         text not null,
  corrected        text not null,
  explanation_uk   text not null,
  -- FK на grammar_topics додається на етапі 2.
  grammar_topic_id uuid,
  created_at       timestamptz not null default now()
);
create index mistakes_user_language_idx on public.mistakes (user_id, language, created_at desc);

-- Слова для інтервальних повторень. Їх зберігає сам користувач (кнопка «Зберегти слова»).
create table public.vocab_items (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null default auth.uid() references auth.users (id) on delete cascade,
  language               text not null references public.languages (code),
  word                   text not null,
  translation_uk         text not null,
  example                text,
  source_conversation_id uuid references public.conversations (id) on delete set null,
  next_review_at         timestamptz not null default now(),
  interval_days          int not null default 0,
  repetitions            int not null default 0,
  created_at             timestamptz not null default now(),
  unique (user_id, language, word)
);
create index vocab_items_review_idx on public.vocab_items (user_id, language, next_review_at);

create table public.user_achievements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at      timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

-- ---------------------------------------------------------------------------
-- Новий користувач: профіль + безкоштовний тариф
-- ---------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'));

  insert into public.subscriptions (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Ліміти хвилин
-- ---------------------------------------------------------------------------

-- Стан використання для Edge Functions (перед кожним обміном репліками).
-- Місяць — календарний, UTC. Тариф з простроченою підпискою вважається free.
create function public.usage_status(p_user_id uuid, p_conversation_id uuid default null)
returns table (
  plan                        text,
  monthly_limit_seconds       int,
  used_month_seconds          int,
  used_today_seconds          int,
  used_conversation_seconds   int,
  remaining_seconds           int
)
language sql
stable
security definer
set search_path = ''
as $$
  with sub as (
    select
      case
        when s.status in ('active', 'grace')
          and (s.plan = 'free' or s.current_period_end is null or s.current_period_end > now())
        then s.plan
        else 'free'
      end as plan,
      s.extra_seconds
    from public.subscriptions s
    where s.user_id = p_user_id
  ),
  eff as (
    select
      coalesce((select plan from sub), 'free') as plan,
      coalesce((select extra_seconds from sub), 0) as extra_seconds
  ),
  lim as (
    select l.*, eff.extra_seconds
    from public.plan_limits l
    join eff on eff.plan = l.plan
  ),
  used as (
    select
      coalesce(sum(e.seconds) filter (where e.created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'), 0)::int as month,
      coalesce(sum(e.seconds) filter (where e.created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'), 0)::int as today,
      coalesce(sum(e.seconds) filter (where p_conversation_id is not null and e.conversation_id = p_conversation_id), 0)::int as conv
    from public.usage_events e
    where e.user_id = p_user_id
      and e.created_at >= least(
        date_trunc('month', now() at time zone 'utc') at time zone 'utc',
        now() - interval '1 day'
      )
  )
  select
    lim.plan,
    lim.monthly_seconds + lim.extra_seconds,
    used.month,
    used.today,
    used.conv,
    greatest(0, least(
      lim.monthly_seconds + lim.extra_seconds - used.month,
      lim.daily_seconds - used.today,
      case when p_conversation_id is null then lim.per_conversation_seconds
           else lim.per_conversation_seconds - used.conv end
    ))::int
  from lim, used;
$$;

revoke execute on function public.usage_status(uuid, uuid) from public, anon, authenticated;
grant execute on function public.usage_status(uuid, uuid) to service_role;

-- Для головного екрана: власний залишок хвилин за місяць (кільце навколо мікрофона).
create function public.my_usage()
returns table (
  plan                    text,
  monthly_limit_seconds   int,
  used_month_seconds      int,
  remaining_month_seconds int,
  -- Скільки можна говорити в новій розмові з урахуванням денного ліміту й ліміту на розмову.
  next_conversation_seconds int
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    plan,
    monthly_limit_seconds,
    used_month_seconds,
    greatest(0, monthly_limit_seconds - used_month_seconds),
    remaining_seconds
  from public.usage_status(auth.uid());
$$;

revoke execute on function public.my_usage() from public, anon;
grant execute on function public.my_usage() to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.languages         enable row level security;
alter table public.plan_limits       enable row level security;
alter table public.topics            enable row level security;
alter table public.achievements      enable row level security;
alter table public.profiles          enable row level security;
alter table public.user_languages    enable row level security;
alter table public.subscriptions     enable row level security;
alter table public.conversations     enable row level security;
alter table public.messages          enable row level security;
alter table public.usage_events      enable row level security;
alter table public.feedback_reports  enable row level security;
alter table public.mistakes          enable row level security;
alter table public.vocab_items       enable row level security;
alter table public.user_achievements enable row level security;

-- Довідники: читання для авторизованих, запис лише адміністратор (service role).
create policy "languages: read" on public.languages for select to authenticated using (true);
create policy "plan_limits: read" on public.plan_limits for select to authenticated using (true);
create policy "topics: read" on public.topics for select to authenticated using (true);
create policy "achievements: read" on public.achievements for select to authenticated using (true);

-- Профіль: свій рядок, читання і зміна.
create policy "profiles: read own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Мови користувача: повне керування своїми рядками.
create policy "user_languages: read own" on public.user_languages for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_languages: insert own" on public.user_languages for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_languages: update own" on public.user_languages for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_languages: delete own" on public.user_languages for delete to authenticated
  using (user_id = (select auth.uid()));

-- Пишуть лише Edge Functions; клієнт читає свої рядки.
create policy "subscriptions: read own" on public.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "conversations: read own" on public.conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy "messages: read own" on public.messages for select to authenticated
  using (exists (
    select 1 from public.conversations c
    where c.id = messages.conversation_id and c.user_id = (select auth.uid())
  ));
create policy "usage_events: read own" on public.usage_events for select to authenticated
  using (user_id = (select auth.uid()));
create policy "feedback_reports: read own" on public.feedback_reports for select to authenticated
  using (user_id = (select auth.uid()));
create policy "mistakes: read own" on public.mistakes for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_achievements: read own" on public.user_achievements for select to authenticated
  using (user_id = (select auth.uid()));

-- Слова: користувач зберігає, повторює й видаляє сам.
create policy "vocab_items: read own" on public.vocab_items for select to authenticated
  using (user_id = (select auth.uid()));
create policy "vocab_items: insert own" on public.vocab_items for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "vocab_items: update own" on public.vocab_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "vocab_items: delete own" on public.vocab_items for delete to authenticated
  using (user_id = (select auth.uid()));
