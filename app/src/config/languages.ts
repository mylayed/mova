// Мови вивчення. Прапорець enabled дублюється в таблиці public.languages,
// щоб відкривати нові мови без оновлення застосунку; тут — запасні значення.
// Російська не підтримується ніде.
export type LanguageCode =
  | 'en' | 'es' | 'de' | 'fr' | 'it' | 'pl'
  | 'ja' | 'ko' | 'zh' | 'pt' | 'hi';

export type Level = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const LEVELS: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export type LanguageInfo = {
  code: LanguageCode;
  nameUk: string;
  nameEn: string;
  enabled: boolean;
};

export const LANGUAGES: LanguageInfo[] = [
  { code: 'en', nameUk: 'Англійська', nameEn: 'English', enabled: true },
  { code: 'es', nameUk: 'Іспанська', nameEn: 'Spanish', enabled: false },
  { code: 'de', nameUk: 'Німецька', nameEn: 'German', enabled: false },
  { code: 'fr', nameUk: 'Французька', nameEn: 'French', enabled: false },
  { code: 'it', nameUk: 'Італійська', nameEn: 'Italian', enabled: false },
  { code: 'pl', nameUk: 'Польська', nameEn: 'Polish', enabled: false },
  { code: 'ja', nameUk: 'Японська', nameEn: 'Japanese', enabled: false },
  { code: 'ko', nameUk: 'Корейська', nameEn: 'Korean', enabled: false },
  { code: 'zh', nameUk: 'Китайська', nameEn: 'Chinese', enabled: false },
  { code: 'pt', nameUk: 'Португальська', nameEn: 'Portuguese', enabled: false },
  { code: 'hi', nameUk: 'Гінді', nameEn: 'Hindi', enabled: false },
];
