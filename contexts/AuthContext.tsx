import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile, Role } from '../types';
import { Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: Session['user'] | null;
  profile: UserProfile | null;
  organizationId: string | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to generate a valid UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Fetch from 'users' table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfile(data as UserProfile);
      } else {
        // Fallback: Use metadata from the session if DB record doesn't exist yet
        const user = await supabase.auth.getUser();
        const metadata = user.data.user?.user_metadata;
        
        // Ensure we use a valid UUID for organization_id to avoid DB type errors
        const fallbackOrgId = metadata?.organization_id || generateUUID();
        
        setProfile({
          id: userId,
          email: user.data.user?.email || '',
          name: metadata?.full_name || 'User',
          organization_id: fallbackOrgId,
          role: metadata?.role || 'viewer',
        });
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
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
    // Use valid UUID for organization_id
    const newOrgId = generateUUID();
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          organization_id: newOrgId, 
          role: 'admin'
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
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        profile,
        organizationId: profile?.organization_id ?? null,
        role: profile?.role ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
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