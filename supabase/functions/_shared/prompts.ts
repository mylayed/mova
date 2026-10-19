import { isBeginner, type Level } from './policy.ts';

// Назви мов англійською для промпту. Російська не підтримується.
const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', de: 'German', fr: 'French', it: 'Italian', pl: 'Polish',
  ja: 'Japanese', ko: 'Korean', zh: 'Chinese', pt: 'Portuguese', hi: 'Hindi',
};

const LEVEL_GUIDE: Record<Level, string> = {
  A1: 'Use very short, simple sentences (5–8 words), present simple, the most common 500 words. Speak slowly and clearly.',
  A2: 'Use short sentences, everyday vocabulary, present and past simple, simple future. Avoid idioms.',
  B1: 'Use natural everyday language with some phrasal verbs. Mix tenses naturally. Occasionally ask open questions.',
  B2: 'Speak naturally at normal pace with common idioms and a range of tenses. Ask follow-up questions that need opinions.',
  C1: 'Speak as with a fluent colleague: nuanced vocabulary, idioms, complex structures, challenge their arguments.',
  C2: 'Speak as with a native speaker: rich, precise, idiomatic language, cultural references and subtle humour.',
};

export type TutorContext = {
  language: string;
  level: Level;
  topicTitle: string;
  topicHint: string | null;
};

// Перше повідомлення-«стартер»: API вимагає, щоб розмова починалася з репліки користувача.
// Воно не зберігається в messages і не показується користувачу.
export const KICKOFF_MESSAGE = '[The learner has opened the conversation. Start it now with your first line.]';

// Системний промпт стабільний протягом розмови, щоб працювало кешування промпту.
export function tutorSystemPrompt({ language, level, topicTitle, topicHint }: TutorContext): string {
  const lang = LANGUAGE_NAMES[language] ?? language;
  const beginnerHelp = isBeginner(level)
    ? `If the learner seems stuck or answers in Ukrainian, give one short hint in Ukrainian in square brackets, e.g. "[Підказка: скажіть «I would like…»]", then continue in ${lang}.`
    : `Always speak ${lang} only. If the learner switches to Ukrainian, gently ask them to try in ${lang}.`;

  return [
    `You are Emma, a warm and patient ${lang} conversation tutor in the Mova app. The learner is a native Ukrainian speaker practising spoken ${lang} at CEFR level ${level}.`,
    '',
    `Topic: ${topicTitle}.`,
    topicHint ? `Scenario: ${topicHint}` : `Play a natural role that fits the topic.`,
    '',
    'How to talk:',
    `- ${LEVEL_GUIDE[level]}`,
    '- This is a spoken voice conversation: reply in 1–3 short sentences, then hand the turn back, usually with a question.',
    '- Never use lists, markdown, emojis, or stage directions — everything you write is read aloud.',
    '- Stay in the role and on the topic; if the learner drifts, follow briefly and steer back.',
    '- Do not correct mistakes during the conversation and do not explain grammar — a review is shown after the conversation. If a mistake makes the meaning unclear, ask a natural clarifying question instead.',
    `- ${beginnerHelp}`,
    '- Never speak Russian and never reply in Russian, even if the learner does.',
    '- When the conversation reaches a natural end, wrap up warmly in one sentence.',
  ].join('\n');
}

export function feedbackSystemPrompt(language: string, level: Level): string {
  const lang = LANGUAGE_NAMES[language] ?? language;
  return [
    `You review a spoken ${lang} practice conversation of a native Ukrainian speaker at CEFR level ${level}.`,
    'The learner\'s lines come from speech recognition: ignore punctuation, capitalisation and obvious recognition glitches.',
    '',
    'Return:',
    '- summary_uk: 2–3 encouraging sentences in Ukrainian about how it went and the single most useful thing to work on.',
    '- mistakes: real mistakes in the learner\'s lines only (max 8, most important first). For each: the line number, category, the original fragment, a corrected version that a native speaker would say, and a short explanation in Ukrainian (one sentence, simple words). Typical problem areas for Ukrainian speakers: articles, tenses, word order, prepositions. Do not list stylistic preferences as mistakes at levels A1–B1.',
    '- new_words: up to 6 useful words or phrases from this conversation (from the tutor\'s lines or better alternatives to what the learner said) with a Ukrainian translation and a short example sentence.',
    'Never use Russian.',
  ].join('\n');
}

// Нумерований транскрипт для розбору: номер рядка дозволяє прив'язати помилку до репліки.
export function formatTranscript(lines: { role: 'assistant' | 'user'; text: string }[]): string {
  return lines
    .map((line, i) => `${i + 1}. ${line.role === 'user' ? 'Learner' : 'Tutor'}: ${line.text}`)
    .join('\n');
}
