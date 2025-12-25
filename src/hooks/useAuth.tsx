import { useEffect, useState, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, Profile, Role } from '@/types/kpm';

interface UserRoleInfo {
  role_id: string;
  role_code: string;
  role_label: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  roleInfos: UserRoleInfo[];
  isLoading: boolean;
  isAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (checkRoles: AppRole[]) => boolean;
  hasRoleCode: (code: string) => boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, firstName?: string, lastName?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [roleInfos, setRoleInfos] = useState<UserRoleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*, department:departments(*)')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      setProfile(profileData as Profile);

      // Fetch roles using the new get_user_roles function
      const { data: rolesData, error: rolesError } = await supabase
        .rpc('get_user_roles', { _user_id: userId });

      if (rolesError) {
        console.error('Error fetching roles via RPC:', rolesError);
        // Fallback to old method
        const { data: oldRolesData, error: oldRolesError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId);

        if (!oldRolesError && oldRolesData) {
          setRoles(oldRolesData.filter(r => r.role).map(r => r.role as AppRole));
        }
        return;
      }

      // Set both roleInfos and legacy roles array
      const infos: UserRoleInfo[] = (rolesData || []).map((r: any) => ({
        role_id: r.role_id,
        role_code: r.role_code,
        role_label: r.role_label,
      }));
      setRoleInfos(infos);
      setRoles(infos.map(r => r.role_code as AppRole));
    } catch (error) {
      console.error('Error in fetchProfile:', error);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Defer profile fetch with setTimeout to avoid deadlock
        if (newSession?.user) {
          setTimeout(() => {
            fetchProfile(newSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
        }

        if (event === 'SIGNED_OUT') {
          setProfile(null);
          setRoles([]);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        fetchProfile(existingSession.user.id).finally(() => {
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, firstName?: string, lastName?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setRoleInfos([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasAnyRole = (checkRoles: AppRole[]) => checkRoles.some(role => roles.includes(role));
  const hasRoleCode = (code: string) => roleInfos.some(r => r.role_code === code);
  const isAdmin = hasRole('admin') || hasRoleCode('admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        roleInfos,
        isLoading,
        isAdmin,
        hasRole,
        hasAnyRole,
        hasRoleCode,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
