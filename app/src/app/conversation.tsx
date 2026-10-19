import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, ErrorText, Loading, PrimaryButton, SecondaryButton, TextField } from '@/components/ui';
import { useSession } from '@/lib/session';
import { errorText, t } from '@/i18n';
import { ApiError, sendTurn, startConversation } from '@/lib/api';
import { formatClock } from '@/lib/data';
import { colors, fonts, radius, spacing } from '@/theme/tokens';

type Line = { id: string; role: 'assistant' | 'user'; text: string };

// Текстовий режим розмови. Голос (розпізнавання й озвучка на пристрої) — наступний крок.
export default function ConversationScreen() {
  const params = useLocalSearchParams<{ topicId?: string; customTopic?: string; title?: string }>();
  const { activeLanguage } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [timeUp, setTimeUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const scrollRef = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (startedRef.current || !activeLanguage) return;
    startedRef.current = true;
    startConversation({
      language: activeLanguage.language,
      topicId: params.topicId,
      customTopic: params.customTopic,
    })
      .then((res) => {
        setConversationId(res.conversation_id);
        setLines([{ id: 'a0', role: 'assistant', text: res.reply.text }]);
        setRemaining(res.remaining_seconds);
      })
      .catch((err) => setError(errorText(err instanceof ApiError ? err.code : 'generic')));
  }, [activeLanguage, params.topicId, params.customTopic]);

  async function send() {
    const text = draft.trim();
    if (!text || !conversationId || thinking) return;
    setDraft('');
    setError(null);
    setLines((prev) => [...prev, { id: `u${prev.length}`, role: 'user', text }]);
    setThinking(true);
    try {
      const res = await sendTurn(conversationId, text);
      setLines((prev) => [...prev, { id: `a${prev.length}`, role: 'assistant', text: res.reply.text }]);
      setRemaining(res.remaining_seconds);
      if (res.should_finish) setTimeUp(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'generic';
      if (code === 'limit_reached') setTimeUp(true);
      else {
        setError(errorText(code));
        setDraft(text);
        setLines((prev) => prev.slice(0, -1));
      }
    } finally {
      setThinking(false);
    }
  }

  function finish() {
    if (conversationId) router.replace({ pathname: '/summary/[id]', params: { id: conversationId } });
    else router.back();
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topic} numberOfLines={1}>{params.title ?? ''}</Text>
          <Text style={styles.meta}>
            {activeLanguage?.language.toUpperCase()} · {activeLanguage?.level}
            {remaining !== null ? ` · ${t('conversation.left')} ${formatClock(remaining)}` : ''}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={finish} style={styles.finish}>
          <Text style={styles.finishLabel}>{t('conversation.finish')}</Text>
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
            {lines.map((line) => <Bubble key={line.id} line={line} />)}
            {thinking ? <Body muted style={styles.thinking}>{t('conversation.thinking')}</Body> : null}
            {error ? <ErrorText>{error}</ErrorText> : null}
          </ScrollView>
        )}

        {timeUp ? (
          <View style={styles.footer}>
            <Body muted style={{ textAlign: 'center' }}>{t('conversation.timeUp')}</Body>
            <PrimaryButton label={t('conversation.toSummary')} onPress={finish} />
          </View>
        ) : conversationId ? (
          <View style={[styles.footer, styles.inputRow]}>
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder={t('conversation.placeholder')}
              style={{ flex: 1 }}
              onSubmitEditing={send}
              editable={!thinking}
              autoCapitalize="sentences"
              returnKeyType="send"
            />
            <PrimaryButton label={t('conversation.send')} onPress={send} disabled={!draft.trim() || thinking} />
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

// Підказки українською в квадратних дужках показуємо окремо, приглушено.
function Bubble({ line }: { line: Line }) {
  const hints = line.role === 'assistant' ? line.text.match(/\[[^\]]*\]/g) ?? [] : [];
  const main = hints.reduce((acc, h) => acc.replace(h, ' '), line.text).replace(/\s+/g, ' ').trim();
  const mine = line.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.userBubble : styles.tutorBubble]}>
      <Text style={[styles.bubbleText, mine && { color: colors.onAccent }]}>{main}</Text>
      {hints.map((h) => (
        <Text key={h} style={styles.hint}>{h.slice(1, -1)}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.cardBorder,
    borderBottomWidth: 1,
  },
  topic: { color: colors.text, fontFamily: fonts.semibold, fontSize: 17 },
  meta: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  finish: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  finishLabel: { color: colors.accent, fontFamily: fonts.semibold, fontSize: 15 },
  lines: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '85%', borderRadius: radius.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, gap: 4 },
  tutorBubble: { alignSelf: 'flex-start', backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: colors.accent },
  bubbleText: { color: colors.text, fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  hint: { color: colors.mistake, fontFamily: fonts.regular, fontSize: 13 },
  thinking: { fontSize: 14, fontStyle: 'italic' },
  footer: { padding: spacing.md, gap: spacing.sm, borderTopColor: colors.cardBorder, borderTopWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
});
