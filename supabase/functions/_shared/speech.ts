import { encodeBase64 } from '@std/encoding/base64';

import { HttpError } from './http.ts';
import { isBeginner, type Level } from './policy.ts';
import { requireEnv } from './supabase.ts';

// Розпізнавання й озвучка. Провайдера ще не обрано остаточно (див. PLAN.md, відкриті питання),
// тож уся залежність від нього зібрана тут: заміна провайдера = заміна цього файлу.
// Зараз: OpenAI gpt-4o-mini-transcribe (STT) і gpt-4o-mini-tts (TTS).

const OPENAI_URL = 'https://api.openai.com/v1';
const STT_MODEL = 'gpt-4o-mini-transcribe';
const TTS_MODEL = 'gpt-4o-mini-tts';
const TTS_VOICE = 'coral';

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;

// Без OPENAI_API_KEY сервер працює лише з текстом: розпізнавання й озвучку робить застосунок
// на пристрої (безкоштовно). Ключ можна додати пізніше без змін у коді.
export function serverSpeechEnabled(): boolean {
  return Boolean(Deno.env.get('OPENAI_API_KEY'));
}

export async function transcribe(audio: File, language: string): Promise<string> {
  if (!serverSpeechEnabled()) throw new HttpError(400, 'server_stt_disabled');
  if (audio.size === 0) throw new HttpError(400, 'empty_audio');
  if (audio.size > MAX_AUDIO_BYTES) throw new HttpError(413, 'audio_too_large');

  const form = new FormData();
  form.append('file', audio, audio.name || 'speech.m4a');
  form.append('model', STT_MODEL);
  form.append('language', language);
  form.append('response_format', 'json');

  const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${requireEnv('OPENAI_API_KEY')}` },
    body: form,
  });
  if (!res.ok) {
    console.error('STT failed', res.status, await res.text());
    throw new HttpError(502, 'stt_failed');
  }
  const body = await res.json() as { text?: string };
  return (body.text ?? '').trim();
}

export type SynthesizedAudio = { base64: string; mime: string };

// null — серверна озвучка вимкнена, застосунок озвучує spoken_text сам.
export async function synthesize(text: string, level: Level): Promise<SynthesizedAudio | null> {
  if (!serverSpeechEnabled()) return null;
  const res = await fetch(`${OPENAI_URL}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input: text,
      response_format: 'mp3',
      instructions: isBeginner(level)
        ? 'Warm, friendly tutor. Speak slowly and very clearly, with short pauses between sentences.'
        : 'Warm, friendly tutor. Speak naturally at a relaxed conversational pace.',
    }),
  });
  if (!res.ok) {
    console.error('TTS failed', res.status, await res.text());
    throw new HttpError(502, 'tts_failed');
  }
  return { base64: encodeBase64(new Uint8Array(await res.arrayBuffer())), mime: 'audio/mpeg' };
}

export function replyPayload(text: string, spoken: string, audio: SynthesizedAudio | null) {
  return {
    text,
    spoken_text: spoken,
    audio_base64: audio?.base64 ?? null,
    audio_mime: audio?.mime ?? null,
  };
}

// Квадратні дужки — підказки українською для A1–A2: показуються текстом, але не озвучуються.
export function spokenPart(text: string): string {
  return text.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}
