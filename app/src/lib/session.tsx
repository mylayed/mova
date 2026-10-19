import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { LanguageCode, Level } from '@/config/languages';
import { supabase } from '@/lib/supabase';

export type UserLanguage = { language: LanguageCode; level: Level };

type SessionState = {
  session: Session | null;
  loading: boolean;
  activeLanguage: UserLanguage | null;
  languages: UserLanguage[];
  // Перечитати профіль і мови (після онбордингу чи зміни мови).
  refresh: () => Promise<void>;
};

// Профіль прив'язаний до користувача, щоб після виходу не показувати чужі дані.
type Profile = { userId: string; activeCode: LanguageCode | null; languages: UserLanguage[] };

async function loadProfile(userId: string): Promise<Profile> {
  const [profile, langs] = await Promise.all([
    supabase.from('profiles').select('active_language').eq('id', userId).maybeSingle(),
    supabase.from('user_languages').select('language, level').order('started_at'),
  ]);
  return {
    userId,
    activeCode: (profile.data?.active_language as LanguageCode | null) ?? null,
    languages: (langs.data as UserLanguage[] | null) ?? [],
  };
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    loadProfile(userId).then((p) => {
      if (!cancelled) setProfile(p);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const refresh = useCallback(async () => {
    if (userId) setProfile(await loadProfile(userId));
  }, [userId]);

  const value = useMemo<SessionState>(() => {
    const current = profile && profile.userId === userId ? profile : null;
    const languages = current?.languages ?? [];
    return {
      session,
      loading: sessionLoading || (Boolean(userId) && !current),
      activeLanguage: languages.find((l) => l.language === current?.activeCode) ?? null,
      languages,
      refresh,
    };
  }, [session, sessionLoading, userId, profile, refresh]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
