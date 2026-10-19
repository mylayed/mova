// Чисті правила без мережі й БД: вибір моделі, оцінка часу й вартості. Покриті тестами.

export type Plan = 'free' | 'plus' | 'pro';
export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
export type ModelTier = 'haiku' | 'sonnet';

export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const MODEL_IDS: Record<ModelTier, string> = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
};

// Ціни за мільйон токенів, USD (без кешу — верхня межа).
const MODEL_PRICES: Record<ModelTier, { input: number; output: number }> = {
  haiku: { input: 0.1, output: 0.5 },
  sonnet: { input: 2, output: 10 },
};

// Ціни озвучки й розпізнавання за хвилину (gpt-4o-mini-tts / gpt-4o-mini-transcribe).
// Перевірити у провайдера перед запуском.
const TTS_PER_MINUTE = 0.015;
const STT_PER_MINUTE = 0.003;

// Розмова не починається, якщо лишилось менше за цей час.
export const MIN_SECONDS_TO_START = 15;

// Максимум, який зараховуємо за одну репліку користувача (захист від хибної тривалості з клієнта).
export const MAX_USER_TURN_SECONDS = 120;

export function isLevel(value: unknown): value is Level {
  return typeof value === 'string' && (LEVELS as string[]).includes(value);
}

// Haiku для Free та A1–B1, Sonnet для B2+ і для Pro.
export function pickModel(plan: Plan, level: Level): ModelTier {
  if (plan === 'pro') return 'sonnet';
  if (plan === 'free') return 'haiku';
  return LEVELS.indexOf(level) >= LEVELS.indexOf('B2') ? 'sonnet' : 'haiku';
}

// Субтитри й підказки українською — лише на A1–A2.
export function isBeginner(level: Level): boolean {
  return level === 'A1' || level === 'A2';
}

// Тривалість озвучки за кількістю слів: ~150 слів/хв, для початківців повільніше.
export function estimateSpeechSeconds(text: string, level: Level): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerSecond = isBeginner(level) ? 2 : 2.5;
  return Math.max(1, Math.ceil(words / wordsPerSecond));
}

export function clampUserSeconds(durationMs: unknown, transcript: string, level: Level): number {
  const reported = typeof durationMs === 'number' && Number.isFinite(durationMs) ? Math.ceil(durationMs / 1000) : 0;
  // Якщо клієнт не передав тривалість, рахуємо за текстом, щоб хвилини не були безкоштовними.
  const seconds = reported > 0 ? reported : estimateSpeechSeconds(transcript, level);
  return Math.min(MAX_USER_TURN_SECONDS, Math.max(1, seconds));
}

export type CostInput = {
  model: ModelTier;
  inputTokens: number;
  outputTokens: number;
  ttsSeconds: number;
  sttSeconds: number;
};

export function estimateCost({ model, inputTokens, outputTokens, ttsSeconds, sttSeconds }: CostInput): number {
  const price = MODEL_PRICES[model];
  const llm = (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
  const speech = (ttsSeconds / 60) * TTS_PER_MINUTE + (sttSeconds / 60) * STT_PER_MINUTE;
  return Math.round((llm + speech) * 100_000) / 100_000;
}
