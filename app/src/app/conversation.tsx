import * as Speech from 'expo-speech';
import { router, useLocalSearchParams } from 'expo-router';
import { Captions, CaptionsOff, ChevronLeft, Keyboard, Lightbulb, Send, Square } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { ErrorText, Loading, PrimaryButton, SecondaryButton, TextField } from '@/components/ui';
import { MicButton, StateIndicator, type VoiceState } from '@/components/VoiceControls';
import { LANGUAGES, SPEECH_LOCALES } from '@/config/languages';
import { errorText, t } from '@/i18n';
import { ApiError, getHint, sendTurn, startConversation, type Hint } from '@/lib/api';
import { fetchUsage } from '@/lib/data';
import { canRecognize, startRecognition, type Recognition } from '@/lib/recognizer';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Line = { id: string; role: 'assistant' | 'user'; text: string };

// Голосова розмова. Emma говорить голосом пристрою (expo-speech). Користувач говорить через
// розпізнавання в браузері; на телефоні в Expo Go — текстом або диктуванням з клавіатури.
export default function ConversationScreen() {
  const params = useLocalSearchParams<{ topicId?: string; customTopic?: string; title?: string }>();
  const { activeLanguage } = useSession();
  const language = activeLanguage?.language ?? 'en';
  const level = activeLanguage?.level ?? 'B1';
  const locale = SPEECH_LOCALES[language];
  const beginner = level === 'A1' || level === 'A2';
  const voiceInput = canRecognize();

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [state, setState] = useState<VoiceState>('idle');
  const [partial, setPartial] = useState('');
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(!voiceInput);
  const [subtitles, setSubtitles] = useState(beginner);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [hint, setHint] = useState<Hint | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [remainingMonth, setRemainingMonth] = useState<number | null>(null);
  const [monthLimit, setMonthLimit] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedRef = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const pressStartRef = useRef(0);

  const speak = (text: string) => {
    Speech.stop();
    setState('speaking');
    Speech.speak(text, {
      language: locale,
      rate: beginner ? 0.85 : 1,
      onDone: () => setState('idle'),
      onStopped: () => setState('idle'),
      onError: () => setState('idle'),
    });
  };

  useEffect(() => {
    if (startedRef.current || !activeLanguage) return;
    startedRef.current = true;
    fetchUsage().then((u) => u && setMonthLimit(u.monthly_limit_seconds));
    startConversation({ language, topicId: params.topicId, customTopic: params.customTopic })
      .then((res) => {
        setConversationId(res.conversation_id);
        setLines([{ id: 'a0', role: 'assistant', text: res.reply.text }]);
        setRemainingMonth(res.remaining_month_seconds);
        speak(res.reply.spoken_text);
      })
      .catch((err) => setError(errorText(err instanceof ApiError ? err.code : 'generic')));
    return () => {
      Speech.stop();
      recognitionRef.current?.cancel();
    };
    // speak залежить лише від локалі й рівня, які не змінюються під час розмови.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLanguage]);

  async function submit(text: string, durationMs?: number) {
    if (!text || !conversationId) return;
    setError(null);
    setHint(null);
    setLines((prev) => [...prev, { id: `u${prev.length}`, role: 'user', text }]);
    setState('thinking');
    try {
      const res = await sendTurn(conversationId, text, durationMs);
      setLines((prev) => [...prev, { id: `a${prev.length}`, role: 'assistant', text: res.reply.text }]);
      setRemainingMonth(res.remaining_month_seconds);
      if (res.should_finish) setTimeUp(true);
      speak(res.reply.spoken_text);
    } catch (err) {
      setState('idle');
      const code = err instanceof ApiError ? err.code : 'generic';
      if (code === 'limit_reached') setTimeUp(true);
      else {
        setError(errorText(code));
        setLines((prev) => prev.slice(0, -1));
        if (typing) setDraft(text);
      }
    }
  }

  function micDown() {
    if (!voiceInput) {
      // На телефоні без розпізнавання — відкриваємо поле, де можна диктувати з клавіатури.
      setTyping(true);
      return;
    }
    if (state === 'thinking' || !conversationId) return;
    Speech.stop();
    setError(null);
    setPartial('');
    pressStartRef.current = Date.now();
    recognitionRef.current = startRecognition(locale, setPartial, () => setError(t('conversation.micError')));
    setState('listening');
  }

  async function micUp() {
    const rec = recognitionRef.current;
    if (!rec) return;
    recognitionRef.current = null;
    const durationMs = Date.now() - pressStartRef.current;
    const text = await rec.stop();
    setPartial('');
    if (!text) {
      setState('idle');
      setError(t('conversation.nothingHeard'));
      return;
    }
    submit(text, durationMs);
  }

  function sendTyped() {
    const text = draft.trim();
    if (!text || state === 'thinking') return;
    setDraft('');
    submit(text);
  }

  async function askHint() {
    if (!conversationId || hintLoading) return;
    setHintLoading(true);
    try {
      setHint(await getHint(conversationId));
    } catch (err) {
      setError(errorText(err instanceof ApiError ? err.code : 'generic'));
    } finally {
      setHintLoading(false);
    }
  }

  function finish() {
    Speech.stop();
    recognitionRef.current?.cancel();
    if (conversationId) router.replace({ pathname: '/summary/[id]', params: { id: conversationId } });
    else router.back();
  }

  const langName = LANGUAGES.find((l) => l.code === language)?.nameUk ?? language;
  const stateLabel =
    state === 'listening' ? t('conversation.listening')
    : state === 'thinking' ? t('conversation.thinking')
    : state === 'speaking' ? t('conversation.speaking')
    : '';
  const minutesLeft = remainingMonth !== null ? Math.floor(remainingMonth / 60) : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={finish} style={styles.iconBtn}>
          <AnimatedIcon icon={ChevronLeft} animation="none" />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.topic} numberOfLines={1}>{params.title ?? ''}</Text>
          <Text style={styles.meta}>{langName} · {level}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('conversation.subtitles')}
          accessibilityState={{ selected: subtitles }}
          onPress={() => setSubtitles((s) => !s)}
          style={styles.iconBtn}
        >
          <AnimatedIcon icon={subtitles ? Captions : CaptionsOff} color={subtitles ? colors.accent : colors.textMuted} animation="pop" trigger={subtitles} />
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!conversationId && !error ? (
          <Loading label={t('conversation.starting')} />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.lines}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {lines.map((line) => (
              <Bubble
                key={line.id}
                line={line}
                hidden={line.role === 'assistant' && !subtitles && !revealed.has(line.id)}
                onReveal={() => setRevealed((prev) => new Set(prev).add(line.id))}
              />
            ))}
            {partial ? <Bubble line={{ id: 'partial', role: 'user', text: partial }} draft /> : null}
            {hint ? (
              <View style={styles.hintCard}>
                <Text style={styles.hintLabel}>{t('conversation.hintLabel')}</Text>
                <Text style={styles.hintText}>{hint.suggestion}</Text>
                <Text style={styles.hintTranslation}>{hint.translation_uk}</Text>
              </View>
            ) : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
          </ScrollView>
        )}

        {timeUp ? (
          <View style={styles.footer}>
            <Text style={[styles.meta, { textAlign: 'center' }]}>{t('conversation.timeUp')}</Text>
            <PrimaryButton label={t('conversation.toSummary')} onPress={finish} />
          </View>
        ) : conversationId ? (
          <View style={styles.footer}>
            <StateIndicator state={state} />
            <Text style={[styles.stateLabel, state === 'listening' && { color: colors.accent }]}>{stateLabel}</Text>

            {typing ? (
              <View style={styles.inputRow}>
                <TextField
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={voiceInput ? t('conversation.placeholder') : t('conversation.placeholderDictate')}
                  style={{ flex: 1 }}
                  onSubmitEditing={sendTyped}
                  editable={state !== 'thinking'}
                  autoCapitalize="sentences"
                  returnKeyType="send"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('conversation.send')}
                  onPress={sendTyped}
                  disabled={!draft.trim() || state === 'thinking'}
                  style={[styles.sendBtn, (!draft.trim() || state === 'thinking') && { opacity: 0.5 }]}
                >
                  <AnimatedIcon icon={Send} color={colors.onAccent} animation="pop" trigger={lines.length} />
                </Pressable>
              </View>
            ) : null}

            <View style={styles.controls}>
              <SideButton icon={Lightbulb} label={t('conversation.hint')} onPress={askHint} busy={hintLoading} />
              <MicButton
                fraction={remainingMonth !== null && monthLimit ? remainingMonth / monthLimit : 1}
                state={state}
                disabled={state === 'thinking'}
                onPressIn={micDown}
                onPressOut={micUp}
                label={t('conversation.pushToTalk')}
              />
              <SideButton icon={Square} label={t('conversation.finish')} onPress={finish} />
            </View>

            <View style={{ alignItems: 'center' }}>
              <Text style={styles.pushLabel}>{voiceInput ? t('conversation.pushToTalk') : t('conversation.voiceSoon')}</Text>
              {minutesLeft !== null ? (
                <Text style={styles.meta}>{t('conversation.minutesLeft').replace('{n}', String(minutesLeft))}</Text>
              ) : null}
              {voiceInput ? (
                <Pressable accessibilityRole="button" onPress={() => setTyping((v) => !v)} style={styles.typeToggle}>
                  <AnimatedIcon icon={Keyboard} size={18} color={colors.textMuted} animation="none" />
                  <Text style={styles.meta}>{typing ? t('conversation.hideKeyboard') : t('conversation.typeInstead')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : error ? (
          <View style={styles.footer}>
            <SecondaryButton label={t('common.back')} onPress={() => router.back()} />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SideButton({
  icon,
  label,
  onPress,
  busy,
}: {
  icon: typeof Lightbulb;
  label: string;
  onPress: () => void;
  busy?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={styles.side}>
      <View style={[styles.sideCircle, busy && { opacity: 0.5 }]}>
        <AnimatedIcon icon={icon} animation="wiggle" loop={busy} />
      </View>
      <Text style={styles.sideLabel}>{label}</Text>
    </Pressable>
  );
}

// Підказки українською в квадратних дужках показуємо окремо, приглушено.
function Bubble({ line, hidden, onReveal, draft }: { line: Line; hidden?: boolean; onReveal?: () => void; draft?: boolean }) {
  const mine = line.role === 'user';
  const hints = mine ? [] : line.text.match(/\[[^\]]*\]/g) ?? [];
  const main = hints.reduce((acc, h) => acc.replace(h, ' '), line.text).replace(/\s+/g, ' ').trim();
  return (
    <View style={[styles.bubbleWrap, mine && { alignSelf: 'flex-end', alignItems: 'flex-end' }]}>
      <Text style={styles.who}>{mine ? t('conversation.you') : 'Emma'}</Text>
      {hidden ? (
        <Pressable accessibilityRole="button" onPress={onReveal} style={[styles.bubble, styles.tutorBubble]}>
          <Text style={styles.hiddenText}>{t('conversation.showText')}</Text>
        </Pressable>
      ) : (
        <View style={[styles.bubble, mine ? styles.userBubble : styles.tutorBubble, draft && { opacity: 0.6 }]}>
          <Text style={[styles.bubbleText, mine && { color: colors.userBubbleText }]}>{main}</Text>
          {hints.map((h) => (
            <Text key={h} style={styles.inlineHint}>{h.slice(1, -1)}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  topic: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  lines: { paddingHorizontal: 20, paddingVertical: spacing.sm, gap: 18 },
  bubbleWrap: { maxWidth: '85%', gap: 6, alignItems: 'flex-start' },
  who: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, paddingHorizontal: 4 },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: 14, gap: 4, borderWidth: 1 },
  tutorBubble: { backgroundColor: colors.card, borderColor: colors.cardBorder, borderRadius: 20, borderBottomLeftRadius: 6 },
  userBubble: { backgroundColor: colors.userBubble, borderColor: colors.userBubbleBorder, borderRadius: 20, borderBottomRightRadius: 6 },
  bubbleText: { color: colors.text, fontFamily: fonts.regular, fontSize: 17, lineHeight: 24 },
  inlineHint: { color: colors.mistake, fontFamily: fonts.regular, fontSize: 13 },
  hiddenText: { color: colors.textMuted, fontFamily: fonts.medium, fontSize: 15 },
  hintCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentSoftBorder,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 4,
  },
  hintLabel: { color: colors.accent, fontFamily: fonts.medium, fontSize: 12 },
  hintText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 16 },
  hintTranslation: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 14 },
  footer: { paddingHorizontal: 20, paddingBottom: spacing.md, paddingTop: spacing.sm, gap: spacing.sm, alignItems: 'stretch' },
  stateLabel: { textAlign: 'center', color: colors.textMuted, fontFamily: fonts.medium, fontSize: 14, minHeight: 18 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: { width: 72, alignItems: 'center', gap: 6 },
  sideCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  pushLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 15 },
  typeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
