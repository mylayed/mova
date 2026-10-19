import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Body, Card, ErrorText, PrimaryButton, Screen, SecondaryButton, TextField, Title } from '@/components/ui';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { colors, fonts, spacing } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Тимчасовий вхід для розробки. Стандартний лист Supabase містить посилання (без власного SMTP
// шаблон не змінити), тож у браузері входимо за посиланням. Код з листа запрацює, коли
// буде налаштовано SMTP і шаблон з {{ .Token }}. Apple і Google — на етапі 3 плану.
const USE_LINK = Platform.OS === 'web';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'sent'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendEmail() {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_RE.test(trimmed)) {
      setError(t('signIn.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: USE_LINK ? { emailRedirectTo: window.location.origin } : undefined,
    });
    setBusy(false);
    if (err) {
      setError(err.status === 429 ? t('signIn.tooMany') : err.message);
      return;
    }
    setEmail(trimmed);
    setStep('sent');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'email' });
    setBusy(false);
    // Після успіху сесія оновиться, і навігатор сам перейде далі.
    if (err) setError(err.status === 429 ? t('signIn.tooMany') : t('signIn.invalidCode'));
  }

  const changeEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Title style={styles.logo}>{t('signIn.title')}</Title>
        <Body muted style={styles.center}>{t('signIn.subtitle')}</Body>
      </View>

      {step === 'email' ? (
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
          {error ? <ErrorText>{error}</ErrorText> : null}
          <PrimaryButton
            label={USE_LINK ? t('signIn.sendLink') : t('signIn.sendCode')}
            onPress={sendEmail}
            loading={busy}
            disabled={!email.trim()}
          />
        </View>
      ) : USE_LINK ? (
        <View style={styles.form}>
          <Card>
            <Body>
              {t('signIn.linkSent')} {email}
            </Body>
            <Body muted>{t('signIn.linkHint')}</Body>
          </Card>
          <SecondaryButton label={t('signIn.changeEmail')} onPress={changeEmail} />
        </View>
      ) : (
        <View style={styles.form}>
          <Body muted>
            {t('signIn.codeSent')} {email}
          </Body>
          <TextField
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, ''))}
            placeholder={t('signIn.code')}
            keyboardType="number-pad"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={10}
            style={styles.code}
            onSubmitEditing={verify}
          />
          {error ? <ErrorText>{error}</ErrorText> : null}
          <PrimaryButton label={t('signIn.verify')} onPress={verify} loading={busy} disabled={code.trim().length < 6} />
          <SecondaryButton label={t('signIn.changeEmail')} onPress={changeEmail} />
        </View>
      )}

      <Body muted style={[styles.center, styles.note]}>{t('signIn.devNote')}</Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.xl * 2, marginBottom: spacing.lg },
  logo: { fontSize: 40, color: colors.accent },
  center: { textAlign: 'center' },
  form: { gap: spacing.md },
  code: { fontFamily: fonts.semibold, fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  note: { fontSize: 13, marginTop: spacing.lg },
});
