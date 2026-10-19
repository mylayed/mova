import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

// Куди Supabase поверне користувача після натискання посилання в листі.
// Expo Go: exp://<IP>:8081/--/ ; власна збірка: mova:/// ; браузер: адреса сторінки.
// Ці адреси мають бути в Supabase → Authentication → URL Configuration → Redirect URLs.
export function authRedirectUrl(): string {
  return Platform.OS === 'web' ? window.location.origin : Linking.createURL('/');
}

// Посилання з листа відкриває застосунок з токенами в адресі (#access_token=…&refresh_token=…).
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
