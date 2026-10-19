import { getLocales } from 'expo-localization';

// Мови інтерфейсу: українська (основна) та англійська.
export type UiLanguage = 'uk' | 'en';

const uk = {
  'tabs.home': 'Головна',
  'tabs.profile': 'Профіль',
  'home.greeting': 'Привіт!',
  'home.start': 'Почати розмову',
  'home.recommended': 'Рекомендована тема',
  'home.minutesLeft': 'Залишилось хвилин',
  'home.streak': 'Серія днів',
  'home.weekMinutes': 'Хвилин за тиждень',
  'home.newWords': 'Нових слів',
  'profile.title': 'Профіль',
  'profile.myLanguages': 'Мої мови',
  'profile.uiLanguage': 'Мова інтерфейсу',
  'profile.plan': 'Тариф',
  'profile.signOut': 'Вийти',
  'profile.deleteAccount': 'Видалити акаунт',
  'common.soon': 'Незабаром',
};

const en: Record<keyof typeof uk, string> = {
  'tabs.home': 'Home',
  'tabs.profile': 'Profile',
  'home.greeting': 'Hi!',
  'home.start': 'Start a conversation',
  'home.recommended': 'Recommended topic',
  'home.minutesLeft': 'Minutes left',
  'home.streak': 'Day streak',
  'home.weekMinutes': 'Minutes this week',
  'home.newWords': 'New words',
  'profile.title': 'Profile',
  'profile.myLanguages': 'My languages',
  'profile.uiLanguage': 'App language',
  'profile.plan': 'Plan',
  'profile.signOut': 'Sign out',
  'profile.deleteAccount': 'Delete account',
  'common.soon': 'Coming soon',
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
