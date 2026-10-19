-- Довідкові дані, потрібні і локально, і в продакшені.

-- На запуску активна лише англійська; решта відкриваються прапорцем enabled.
insert into public.languages (code, name_uk, name_en, enabled, sort_order) values
  ('en', 'Англійська',    'English',    true,  1),
  ('es', 'Іспанська',     'Spanish',    false, 2),
  ('de', 'Німецька',      'German',     false, 3),
  ('fr', 'Французька',    'French',     false, 4),
  ('it', 'Італійська',    'Italian',    false, 5),
  ('pl', 'Польська',      'Polish',     false, 6),
  ('ja', 'Японська',      'Japanese',   false, 7),
  ('ko', 'Корейська',     'Korean',     false, 8),
  ('zh', 'Китайська',     'Chinese',    false, 9),
  ('pt', 'Португальська', 'Portuguese', false, 10),
  ('hi', 'Гінді',         'Hindi',      false, 11);

-- Чернетка лімітів: місяць 20 / 120 / 300 хв, одна розмова до 10 хв.
-- Денні ліміти в нотатці не визначені — тимчасові значення, переглянути після бета-тесту.
insert into public.plan_limits (plan, monthly_seconds, per_conversation_seconds, daily_seconds) values
  ('free', 20 * 60,  10 * 60, 10 * 60),
  ('plus', 120 * 60, 10 * 60, 30 * 60),
  ('pro',  300 * 60, 10 * 60, 60 * 60);

-- Стартові теми для англійської: подорожі, співбесіда, робота, побут.
insert into public.topics (slug, language, title_uk, title_en, level_min, level_max, is_premium, prompt_hint, sort_order) values
  ('cafe-order',        'en', 'Замовлення в кафе',          'Ordering at a café',            'A1', 'B1', false, 'You are a friendly barista in a London café. Take the order, suggest something, ask about size and payment.', 1),
  ('airport-checkin',   'en', 'Реєстрація в аеропорту',      'Airport check-in',              'A2', 'B2', false, 'You are an airline check-in agent. Ask for passport, luggage, seat preference; mention a small problem with the booking.', 2),
  ('hotel',             'en', 'Заселення в готель',          'Checking into a hotel',         'A1', 'B1', false, 'You are a hotel receptionist. Check the guest in, explain breakfast and Wi-Fi, handle one request.', 3),
  ('asking-directions', 'en', 'Як пройти?',                  'Asking for directions',         'A1', 'A2', false, 'You are a local in a city centre. The learner is lost; give simple directions and recommend a place nearby.', 4),
  ('job-interview',     'en', 'Співбесіда на роботу',        'Job interview',                 'B1', 'C2', false, 'You are a hiring manager interviewing the learner for a job they choose. Ask about experience, strengths and a difficult situation.', 5),
  ('small-talk-work',   'en', 'Розмова з колегою',           'Small talk with a colleague',   'A2', 'B2', false, 'You are a new friendly colleague at the coffee machine. Chat about the weekend, work and hobbies.', 6),
  ('team-meeting',      'en', 'Робоча нарада',               'Team meeting',                  'B1', 'C1', true,  'You lead a short team meeting. Ask the learner for a status update, disagree politely once, agree on next steps.', 7),
  ('doctor',            'en', 'У лікаря',                    'At the doctor',                 'A2', 'B2', false, 'You are a GP. Ask about symptoms, how long they have lasted, and give simple advice.', 8),
  ('renting-flat',      'en', 'Оренда квартири',             'Renting a flat',                'B1', 'B2', true,  'You are a landlord showing a flat. Answer questions about rent, bills and the contract; negotiate a little.', 9),
  ('shopping-return',   'en', 'Повернення покупки',          'Returning a purchase',          'A2', 'B1', false, 'You are a shop assistant. The learner wants to return an item; ask for the receipt and the reason, offer options.', 10),
  ('about-me',          'en', 'Розкажи про себе',            'Tell me about yourself',        'A1', 'A2', false, 'You are meeting the learner for the first time. Ask simple questions about their name, city, family and hobbies.', 11),
  ('weekend-plans',     'en', 'Плани на вихідні',            'Weekend plans',                 'A1', 'B1', false, 'You are a friend making plans for the weekend. Suggest ideas, ask preferences, agree on time and place.', 12);

-- Перші бейджі етапу 1.
insert into public.achievements (slug, title_uk, description_uk, icon, rule_type, threshold) values
  ('first-conversation', 'Перша розмова',   'Завершіть першу розмову',          'chat',  'conversations_count', 1),
  ('streak-7',           '7 днів поспіль',  'Розмовляйте 7 днів поспіль',        'flame', 'streak_days',         7),
  ('words-50',           '50 нових слів',   'Збережіть 50 слів для повторення',  'book',  'vocab_count',         50),
  ('articles-clean-3',   'Артиклі під контролем', '3 розмови поспіль без помилок з артиклями', 'check', 'clean_category_streak:articles', 3);
