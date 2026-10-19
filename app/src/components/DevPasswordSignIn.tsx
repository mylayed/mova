import { useState } from 'react';
import { View } from 'react-native';

import { Body, Card, ErrorText, PrimaryButton, SecondaryButton, TextField } from '@/components/ui';
import { t } from '@/i18n';
import { supabase } from '@/lib/supabase';
import { spacing } from '@/theme/tokens';

// Лише для розробки (__DEV__): вхід email + пароль без листів, щоб не впиратися в ліміт
// вбудованої пошти Supabase. Потребує вимкненого «Confirm email» у налаштуваннях Email-провайдера.
export function DevPasswordSignIn() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!__DEV__) return null;
  if (!open) return <SecondaryButton label={t('signIn.devPassword')} onPress={() => setOpen(true)} />;

  const creds = () => ({ email: email.trim().toLowerCase(), password });

  async function signIn() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword(creds());
    setBusy(false);
    if (err) setError(err.message);
  }

  async function signUp() {
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.auth.signUp(creds());
    setBusy(false);
    if (err) setError(err.message);
    // Без сесії — Supabase чекає підтвердження email, тобто «Confirm email» ще увімкнене.
    else if (!data.session) setError(t('signIn.devConfirmOn'));
  }

  const ready = email.includes('@') && password.length >= 6;

  return (
    <Card>
      <Body muted style={{ fontSize: 13 }}>{t('signIn.devPasswordHint')}</Body>
      <TextField
        value={email}
        onChangeText={setEmail}
        placeholder={t('signIn.email')}
        autoCapitalize="none"
        keyboardType="email-address"
        inputMode="email"
      />
      <TextField
        value={password}
        onChangeText={setPassword}
        placeholder={t('signIn.password')}
        secureTextEntry
        autoCapitalize="none"
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <View style={{ gap: spacing.sm }}>
        <PrimaryButton label={t('signIn.verify')} onPress={signIn} loading={busy} disabled={!ready} />
        <SecondaryButton label={t('signIn.devSignUp')} onPress={signUp} disabled={!ready || busy} />
      </View>
    </Card>
  );
}
