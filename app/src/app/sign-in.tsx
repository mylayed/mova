import { Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedIcon } from '@/components/AnimatedIcon';
import { DevPasswordSignIn } from '@/components/DevPasswordSignIn';
import { useWelcomeSeen, Welcome } from '@/components/Welcome';
import { Body, Card, ErrorText, PrimaryButton, Screen, SecondaryButton, TextField, Title } from '@/components/ui';
import { t } from '@/i18n';
import { authRedirectUrl, signInWithGoogle } from '@/lib/authLinks';
import { supabase } from '@/lib/supabase';
import { colors, fonts, hitTarget, radius, spacing } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Вхід: Google (основний), посилання на email (стандартний лист Supabase без власного SMTP
// містить лише посилання) і пароль для розробки. Apple — коли буде акаунт Apple Developer.
export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<'google' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [welcomeSeen, markWelcomeSeen] = useWelcomeSeen();

  async function google() {
    setBusy('google');
    setError(null);
    const result = await signInWithGoogle();
    setBusy(null);
    if (result === 'not_configured') setError(t('signIn.googleNotConfigured'));
    else if (result === 'error') setError(t('error.generic'));
    // 'ok' — сесія оновиться, навігатор сам перейде далі; 'cancelled' — нічого не робимо.
  }

  async function sendEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('signIn.invalidEmail'));
      return;
    }
    setBusy('email');
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: authRedirectUrl() },
    });
    setBusy(null);
    if (err) {
      setError(err.status === 429 ? t('signIn.tooMany') : err.message);
      return;
    }
    setEmail(trimmed);
    setSent(true);
  }

  if (welcomeSeen === null) return <Screen scroll={false}>{null}</Screen>;
  if (!welcomeSeen) {
    return (
      <Screen scroll={false}>
        <Welcome onDone={markWelcomeSeen} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <Title style={styles.logo}>{t('signIn.title')}</Title>
        <Body muted style={styles.center}>{t('signIn.subtitle')}</Body>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={google}
        disabled={busy !== null}
        style={({ pressed }) => [styles.google, pressed && { opacity: 0.85 }, busy === 'google' && { opacity: 0.6 }]}
      >
        <Text style={styles.googleG}>G</Text>
        <Text style={styles.googleLabel}>{t('signIn.google')}</Text>
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Body muted style={{ fontSize: 13 }}>{t('signIn.or')}</Body>
        <View style={styles.line} />
      </View>

      {sent ? (
        <View style={styles.form}>
          <Card>
            <View style={styles.sentRow}>
              <AnimatedIcon icon={Mail} color={colors.accent} animation="pulse" loop />
              <Body style={{ flex: 1 }}>
                {t('signIn.linkSent')} {email}
              </Body>
            </View>
            <Body muted>{t('signIn.linkHint')}</Body>
          </Card>
          <SecondaryButton
            label={t('signIn.changeEmail')}
            onPress={() => {
              setSent(false);
              setError(null);
            }}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder={t('signIn.email')}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            inputMode="email"
            onSubmitEditing={sendEmail}
          />
          <PrimaryButton
            label={t('signIn.sendLink')}
            onPress={sendEmail}
            loading={busy === 'email'}
            disabled={!email.trim() || busy !== null}
          />
        </View>
      )}

      {error ? <ErrorText>{error}</ErrorText> : null}
      <Body muted style={[styles.center, styles.note]}>{t('signIn.devNote')}</Body>
      <DevPasswordSignIn />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl * 2, marginBottom: spacing.lg },
  logo: { fontSize: 40, color: colors.accent },
  center: { textAlign: 'center' },
  form: { gap: spacing.md },
  google: {
    minHeight: hitTarget + 8,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  googleG: { color: colors.bg, fontFamily: fonts.bold, fontSize: 20 },
  googleLabel: { color: colors.bg, fontFamily: fonts.semibold, fontSize: 17 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { fontSize: 13, marginTop: spacing.md },
});
