import { getLocales } from 'expo-localization';

import type { Level } from '@/config/languages';

// Мови інтерфейсу: українська (основна) та англійська.
export type UiLanguage = 'uk' | 'en';

const uk = {
  'tabs.home': 'Головна',
  'tabs.profile': 'Профіль',
  'common.soon': 'Незабаром',
  'common.continue': 'Далі',
  'common.back': 'Назад',
  'common.retry': 'Спробувати ще раз',
  'common.minutesShort': 'хв',

  'signIn.title': 'Mova',
  'signIn.subtitle': 'Розмовляйте англійською з ШІ-репетитором голосом',
  'signIn.email': 'Email',
  'signIn.sendCode': 'Отримати код',
  'signIn.codeSent': 'Ми надіслали код на',
  'signIn.code': 'Код з листа',
  'signIn.verify': 'Увійти',
  'signIn.changeEmail': 'Інший email',
  'signIn.invalidEmail': 'Перевірте email',
  'signIn.invalidCode': 'Код неправильний або застарів',
  'signIn.tooMany': 'Забагато спроб. Спробуйте за кілька хвилин',
  'signIn.devNote': 'Вхід через Apple і Google з’явиться пізніше',

  'onboarding.languageTitle': 'Яку мову вивчаємо?',
  'onboarding.levelTitle': 'Ваш рівень',
  'onboarding.levelHint': 'Рівень можна змінити будь-коли в профілі',
  'onboarding.start': 'Почати',

  'home.greeting': 'Привіт!',
  'home.start': 'Почати розмову',
  'home.recommended': 'Рекомендована тема',
  'home.otherTopic': 'Обрати іншу тему',
  'home.minutesLeft': 'Залишилось хвилин',
  'home.streak': 'Серія днів',
  'home.weekMinutes': 'Хвилин за тиждень',
  'home.newWords': 'Нових слів',

  'topics.title': 'Оберіть тему',
  'topics.forLevel': 'Для вашого рівня',
  'topics.other': 'Інші рівні',
  'topics.custom': 'Своя тема',
  'topics.customPlaceholder': 'Наприклад: розповідаю про своє місто',
  'topics.premium': 'Plus',

  'conversation.thinking': 'Emma думає…',
  'conversation.starting': 'Emma готується до розмови…',
  'conversation.placeholder': 'Напишіть відповідь англійською',
  'conversation.send': 'Надіслати',
  'conversation.finish': 'Завершити',
  'conversation.left': 'Залишилось',
  'conversation.timeUp': 'Час розмови вичерпано. Подивимось підсумок?',
  'conversation.toSummary': 'До підсумку',

  'summary.title': 'Підсумок розмови',
  'summary.loading': 'Emma розбирає розмову…',
  'summary.mistakes': 'Помилки',
  'summary.noMistakes': 'Помилок не знайдено — чудово!',
  'summary.words': 'Нові слова',
  'summary.saveWords': 'Зберегти слова',
  'summary.saved': 'Слова збережено',
  'summary.home': 'На головну',
  'summary.aborted': 'Розмова завершилась до вашої першої відповіді, розбирати поки нічого.',

  'profile.title': 'Профіль',
  'profile.myLanguages': 'Мої мови',
  'profile.uiLanguage': 'Мова інтерфейсу',
  'profile.plan': 'Тариф',
  'profile.minutesLeft': 'Хвилин цього місяця',
  'profile.signOut': 'Вийти',
  'profile.deleteAccount': 'Видалити акаунт',

  'error.limit_reached': 'Хвилини розмов на сьогодні або цей місяць закінчились.',
  'error.premium_topic': 'Ця тема доступна на тарифі Plus.',
  'error.conversation_finished': 'Розмова вже завершена.',
  'error.network_error': 'Немає зв’язку з сервером. Перевірте інтернет.',
  'error.generic': 'Щось пішло не так. Спробуйте ще раз.',
};

const en: Record<keyof typeof uk, string> = {
  'tabs.home': 'Home',
  'tabs.profile': 'Profile',
  'common.soon': 'Coming soon',
  'common.continue': 'Continue',
  'common.back': 'Back',
  'common.retry': 'Try again',
  'common.minutesShort': 'min',

  'signIn.title': 'Mova',
  'signIn.subtitle': 'Speak a new language with an AI tutor, out loud',
  'signIn.email': 'Email',
  'signIn.sendCode': 'Get a code',
  'signIn.codeSent': 'We sent a code to',
  'signIn.code': 'Code from the email',
  'signIn.verify': 'Sign in',
  'signIn.changeEmail': 'Use another email',
  'signIn.invalidEmail': 'Check your email',
  'signIn.invalidCode': 'The code is wrong or expired',
  'signIn.tooMany': 'Too many attempts. Try again in a few minutes',
  'signIn.devNote': 'Sign in with Apple and Google is coming later',

  'onboarding.languageTitle': 'Which language are you learning?',
  'onboarding.levelTitle': 'Your level',
  'onboarding.levelHint': 'You can change the level any time in your profile',
  'onboarding.start': 'Start',

  'home.greeting': 'Hi!',
  'home.start': 'Start a conversation',
  'home.recommended': 'Recommended topic',
  'home.otherTopic': 'Choose another topic',
  'home.minutesLeft': 'Minutes left',
  'home.streak': 'Day streak',
  'home.weekMinutes': 'Minutes this week',
  'home.newWords': 'New words',

  'topics.title': 'Choose a topic',
  'topics.forLevel': 'For your level',
  'topics.other': 'Other levels',
  'topics.custom': 'Your own topic',
  'topics.customPlaceholder': 'For example: telling about my city',
  'topics.premium': 'Plus',

  'conversation.thinking': 'Emma is thinking…',
  'conversation.starting': 'Emma is getting ready…',
  'conversation.placeholder': 'Type your answer',
  'conversation.send': 'Send',
  'conversation.finish': 'Finish',
  'conversation.left': 'Left',
  'conversation.timeUp': 'Conversation time is up. See the summary?',
  'conversation.toSummary': 'To summary',

  'summary.title': 'Conversation summary',
  'summary.loading': 'Emma is reviewing the conversation…',
  'summary.mistakes': 'Mistakes',
  'summary.noMistakes': 'No mistakes found — great!',
  'summary.words': 'New words',
  'summary.saveWords': 'Save words',
  'summary.saved': 'Words saved',
  'summary.home': 'Home',
  'summary.aborted': 'The conversation ended before your first answer, nothing to review yet.',

  'profile.title': 'Profile',
  'profile.myLanguages': 'My languages',
  'profile.uiLanguage': 'App language',
  'profile.plan': 'Plan',
  'profile.minutesLeft': 'Minutes this month',
  'profile.signOut': 'Sign out',
  'profile.deleteAccount': 'Delete account',

  'error.limit_reached': 'Your conversation minutes for today or this month are used up.',
  'error.premium_topic': 'This topic is available on the Plus plan.',
  'error.conversation_finished': 'The conversation is already finished.',
  'error.network_error': 'Cannot reach the server. Check your connection.',
  'error.generic': 'Something went wrong. Please try again.',
};

export type TranslationKey = keyof typeof uk;

const dictionaries: Record<UiLanguage, Record<TranslationKey, string>> = { uk, en };

// Українська за замовчуванням; англійська лише якщо система явно англомовна.
export function detectUiLanguage(): UiLanguage {
  const code = getLocales()[0]?.languageCode;
  return code === 'en' ? 'en' : 'uk';
}

let current: UiLanguage = detectUiLanguage();

export function setUiLanguage(lang: UiLanguage) {
  current = lang;
}

export function t(key: TranslationKey): string {
  return dictionaries[current][key];
}

// Текст помилки серверної функції за її кодом.
export function errorText(code: string): string {
  const key = `error.${code}` as TranslationKey;
  return key in uk ? t(key) : t('error.generic');
}

const LEVEL_DESCRIPTIONS: Record<UiLanguage, Record<Level, string>> = {
  uk: {
    A1: 'Початковий: знаю окремі слова й прості фрази',
    A2: 'Елементарний: говорю про себе й побут простими реченнями',
    B1: 'Середній: підтримую розмову на знайомі теми',
    B2: 'Вище середнього: вільно говорю, але роблю помилки',
    C1: 'Просунутий: говорю впевнено на складні теми',
    C2: 'Вільний: майже як носій мови',
  },
  en: {
    A1: 'Beginner: a few words and simple phrases',
    A2: 'Elementary: simple sentences about myself and daily life',
    B1: 'Intermediate: I can keep a conversation on familiar topics',
    B2: 'Upper-intermediate: fluent, but with mistakes',
    C1: 'Advanced: confident on complex topics',
    C2: 'Proficient: almost like a native speaker',
  },
};

export function levelDescription(level: Level): string {
  return LEVEL_DESCRIPTIONS[current][level];
}
