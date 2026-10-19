import { Platform } from 'react-native';

// Розпізнавання мовлення на пристрої. Зараз — Web Speech API у браузері (Chrome, Edge, Safari).
// На телефоні потрібен нативний модуль, якого немає в Expo Go: з'явиться у власній збірці.
// До того на телефоні користувач відповідає текстом або диктуванням з клавіатури.

type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const canRecognize = (): boolean => getCtor() !== null;

export type Recognition = {
  // Зупинити й отримати весь розпізнаний текст.
  stop: () => Promise<string>;
  cancel: () => void;
};

export function startRecognition(locale: string, onPartial: (text: string) => void, onError: (code: string) => void): Recognition | null {
  const Ctor = getCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = locale;
  rec.continuous = true;
  rec.interimResults = true;

  const finals: string[] = [];
  let interim = '';
  let resolveEnd: (() => void) | null = null;
  const ended = new Promise<void>((resolve) => {
    resolveEnd = resolve;
  });

  rec.onresult = (e) => {
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finals[i] = r[0].transcript;
      else interim += r[0].transcript;
    }
    onPartial([...finals.filter(Boolean), interim].join(' ').trim());
  };
  rec.onerror = (e) => {
    if (e.error !== 'aborted' && e.error !== 'no-speech') onError(e.error);
  };
  rec.onend = () => resolveEnd?.();
  rec.start();

  return {
    stop: async () => {
      rec.stop();
      await ended;
      return [...finals.filter(Boolean), interim].join(' ').replace(/\s+/g, ' ').trim();
    },
    cancel: () => rec.abort(),
  };
}
