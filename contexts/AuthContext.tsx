import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProvisioning, setNeedsProvisioning] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setProfile(profile ?? null);
      setNeedsProvisioning(!profile);
      setIsBlocked(profile?.is_active === false);

      return profile;
    } catch (err) {
      console.error("Error fetching profile:", err);
      setProfile(null);
      setNeedsProvisioning(true);
      setIsBlocked(false);
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
      hasRole,
      signIn,
      signUp,
      signOut,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, profile, loading, isBlocked, needsProvisioning]
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
