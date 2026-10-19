import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Куди Supabase поверне користувача після посилання з листа чи входу через Google.
// Expo Go: exp://<IP>:8081/--/ ; власна збірка: mova:/// ; браузер: адреса сторінки.
// Ці адреси мають бути в Supabase → Authentication → URL Configuration → Redirect URLs.
export function authRedirectUrl(): string {
  return Platform.OS === 'web' ? window.location.origin : Linking.createURL('/');
}

// Посилання повертає застосунок з токенами в адресі (#access_token=…&refresh_token=…).
export async function createSessionFromUrl(url: string): Promise<void> {
  const params = new URLSearchParams(url.split('#')[1] ?? url.split('?')[1] ?? '');
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (!accessToken || !refreshToken) return;
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) console.warn('setSession from link failed', error.message);
}

// На телефоні слухаємо посилання входу: і те, що відкрило застосунок, і ті, що прийшли пізніше.
// У браузері це робить сам Supabase (detectSessionInUrl).
export function listenForAuthLinks(): () => void {
  if (Platform.OS === 'web') return () => {};
  Linking.getInitialURL().then((url) => {
    if (url) createSessionFromUrl(url);
  });
  const sub = Linking.addEventListener('url', ({ url }) => createSessionFromUrl(url));
  return () => sub.remove();
}

// Чи ввімкнено провайдера в Supabase (Authentication → Sign In / Providers).
export async function isProviderEnabled(provider: 'google' | 'apple'): Promise<boolean> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    const body = await res.json() as { external?: Record<string, boolean> };
    return Boolean(body.external?.[provider]);
  } catch {
    return false;
  }
}

export type OAuthResult = 'ok' | 'cancelled' | 'not_configured' | 'error';

// Вхід через Google: у браузері — перехід на сторінку Google і назад; на телефоні —
// системне вікно авторизації (працює в Expo Go без нативних модулів).
export async function signInWithGoogle(): Promise<OAuthResult> {
  if (!(await isProviderEnabled('google'))) return 'not_configured';
  const redirectTo = authRedirectUrl();

  if (Platform.OS === 'web') {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    return error ? 'error' : 'ok';
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) return 'error';
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return 'cancelled';
  await createSessionFromUrl(result.url);
  return 'ok';
}
