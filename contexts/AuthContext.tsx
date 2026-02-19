import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Role } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: Session['user'] | null;
  profile: UserProfile | null;
  organizationId: string | null;
  role: Role | null;
  loading: boolean;
  isBlocked: boolean;
  authError: string | null;
  /**
   * True when the auth user exists but there is no matching row in public.users yet.
   * This usually means the user still needs to be invited / provisioned in the tenant.
   */
  needsProvisioning: boolean;
  /** Simple role guard helper */
  hasRole: (required: Role) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Força uma revalidação do perfil (útil para Pending) */
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProvisioning, setNeedsProvisioning] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const provisionRetryRef = useRef<{ timer: any; attempts: number } | null>(null);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else {
        setAuthError(null);
        setLoading(false);
      }
    });

    // 2. Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        // Only set loading true if we don't have a profile yet for this user
        // This prevents flickering, but ensures we wait for profile
        setLoading(true);
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setNeedsProvisioning(false);
        setIsBlocked(false);
        setAuthError(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Enquanto não existe linha em public.users, re-tenta automaticamente por alguns segundos.
  useEffect(() => {
    // limpa timer anterior
    if (provisionRetryRef.current?.timer) {
      clearInterval(provisionRetryRef.current.timer);
      provisionRetryRef.current = null;
    }

    if (!session?.user?.id) return;
    if (!needsProvisioning) return;

    provisionRetryRef.current = { timer: null, attempts: 0 };
    provisionRetryRef.current.timer = setInterval(async () => {
      if (!session?.user?.id) return;
      if (!provisionRetryRef.current) return;

      provisionRetryRef.current.attempts += 1;
      // 20 tentativas ~ 20s (suave e suficiente pro provisionamento)
      if (provisionRetryRef.current.attempts > 20) {
        clearInterval(provisionRetryRef.current.timer);
        provisionRetryRef.current = null;
        return;
      }

      const p = await fetchProfile(session.user.id);
      if (p) {
        // se achou, para o loop
        if (provisionRetryRef.current?.timer) clearInterval(provisionRetryRef.current.timer);
        provisionRetryRef.current = null;
      }
    }, 1000);

    return () => {
      if (provisionRetryRef.current?.timer) clearInterval(provisionRetryRef.current.timer);
      provisionRetryRef.current = null;
    };
  }, [needsProvisioning, session?.user?.id]);

  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Fetch from 'users' table (RLS protected)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      // maybeSingle: se 0 rows → data = null e error = null (caminho esperado)
      if (error) throw error;

      const profile = (data as UserProfile | null) ?? null;

      if (profile?.disabled === true) {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setNeedsProvisioning(false);
        setIsBlocked(true);
        setAuthError('Seu acesso foi bloqueado pelo administrador desta organização.');
        return null;
      }

      // Se o nome não veio em public.users, tenta sincronizar a partir do metadata do auth
      // (isso resolve o caso do perfil aparecer sem nome após cadastro)
      const metaName =
        (session?.user?.user_metadata as any)?.full_name ||
        (session?.user?.user_metadata as any)?.name ||
        '';
      if (profile && !profile.name && metaName) {
        const { error: upErr } = await supabase
          .from('users')
          .update({ name: metaName })
          .eq('id', userId);
        if (!upErr) {
          (profile as any).name = metaName;
        }
      }

      setAuthError(null);
      setProfile(profile ?? null);
      setNeedsProvisioning(!profile);
      setIsBlocked(profile?.is_active === false);

      return profile;
    } catch (err) {
      console.error("Error fetching profile:", err);
      setProfile(null);
      setNeedsProvisioning(true);
      setIsBlocked(false);
      setAuthError('Não foi possível carregar seu perfil.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    
    if (error) {
        throw error;
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setIsBlocked(false);
    setAuthError(null);
  };

  const refreshProfile = async () => {
    const uid = session?.user?.id;
    if (!uid) return null;
    setLoading(true);
    const p = await fetchProfile(uid);
    return p;
  };

  const hasRole = (required: Role) => {
    const current = profile?.role;
    if (!current) return false;
    if (current === 'admin') return true;
    if (required === 'viewer') return true;
    return current === required;
  };

  const memoed = useMemo(
    () => ({
      user: session?.user ?? null,
      profile,
      organizationId: profile?.organization_id ?? null,
      role: profile?.role ?? null,
      loading,
      isBlocked,
      needsProvisioning,
      authError,
      hasRole,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, profile, loading, isBlocked, needsProvisioning, authError]
  );

  return (
    <AuthContext.Provider
      value={memoed}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
