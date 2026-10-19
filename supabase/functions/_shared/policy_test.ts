import { assert, assertEquals } from '@std/assert';

import { clampUserSeconds, estimateCost, estimateSpeechSeconds, MAX_USER_TURN_SECONDS, pickModel } from './policy.ts';
import { formatTranscript, tutorSystemPrompt } from './prompts.ts';
import { spokenPart } from './speech.ts';
import { toTurns } from './conversation.ts';

Deno.test('pickModel: Haiku для Free і A1–B1, Sonnet для B2+ і Pro', () => {
  assertEquals(pickModel('free', 'C2'), 'haiku');
  assertEquals(pickModel('plus', 'A1'), 'haiku');
  assertEquals(pickModel('plus', 'B1'), 'haiku');
  assertEquals(pickModel('plus', 'B2'), 'sonnet');
  assertEquals(pickModel('plus', 'C1'), 'sonnet');
  assertEquals(pickModel('pro', 'A1'), 'sonnet');
});

Deno.test('estimateSpeechSeconds: початківцям повільніше, мінімум 1 с', () => {
  const text = 'one two three four five six seven eight nine ten';
  assertEquals(estimateSpeechSeconds(text, 'B1'), 4);
  assertEquals(estimateSpeechSeconds(text, 'A1'), 5);
  assertEquals(estimateSpeechSeconds('', 'B1'), 1);
});

Deno.test('clampUserSeconds: тривалість з клієнта обмежена, без неї — за текстом', () => {
  assertEquals(clampUserSeconds(3200, 'hi', 'B1'), 4);
  assertEquals(clampUserSeconds(10 * 60 * 1000, 'hi', 'B1'), MAX_USER_TURN_SECONDS);
  assertEquals(clampUserSeconds(undefined, 'one two three four five', 'B1'), 2);
  assertEquals(clampUserSeconds(-5, 'hi', 'B1'), 1);
  assertEquals(clampUserSeconds(NaN, 'hi', 'B1'), 1);
});

Deno.test('estimateCost: хвилина розмови на Sonnet близько $0.04 (як у плані)', () => {
  // ~5.4 тис. вхідних і 200 вихідних токенів на хвилину, озвучка й розпізнавання за повну хвилину.
  const cost = estimateCost({ model: 'sonnet', inputTokens: 5400, outputTokens: 200, ttsSeconds: 60, sttSeconds: 60 });
  assert(cost > 0.025 && cost < 0.045, `cost ${cost}`);
  const haiku = estimateCost({ model: 'haiku', inputTokens: 5400, outputTokens: 200, ttsSeconds: 0, sttSeconds: 0 });
  assert(haiku < 0.002, `haiku ${haiku}`);
});

Deno.test('tutorSystemPrompt: підказки українською лише на A1–A2', () => {
  const a1 = tutorSystemPrompt({ language: 'en', level: 'A1', topicTitle: 'Ordering at a café', topicHint: 'Barista' });
  const b2 = tutorSystemPrompt({ language: 'en', level: 'B2', topicTitle: 'Job interview', topicHint: null });
  assert(a1.includes('Підказка'));
  assert(!b2.includes('Підказка'));
  assert(a1.includes('CEFR level A1') && a1.includes('English'));
  // Стабільний промпт для кешу: однакові входи → однаковий текст.
  assertEquals(b2, tutorSystemPrompt({ language: 'en', level: 'B2', topicTitle: 'Job interview', topicHint: null }));
});

Deno.test('spokenPart: підказки в дужках не озвучуються', () => {
  assertEquals(spokenPart('Hello! [Підказка: скажіть «Hi»] How are you?'), 'Hello! How are you?');
});

Deno.test('toTurns: розмова починається з репліки користувача-стартера', () => {
  const turns = toTurns([{ role: 'assistant', text: 'Hi!' }, { role: 'user', text: 'Hello' }]);
  assertEquals(turns.map((t) => t.role), ['user', 'assistant', 'user']);
});

Deno.test('formatTranscript: нумерація рядків з 1', () => {
  assertEquals(
    formatTranscript([{ role: 'assistant', text: 'Hi' }, { role: 'user', text: 'I am go' }]),
    '1. Tutor: Hi\n2. Learner: I am go',
  );
});
