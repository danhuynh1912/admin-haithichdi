import type { AuthProvider } from '@refinedev/core';
import { supabase } from './supabase';

export const authProvider: AuthProvider = {
  login: async ({ email, password }: { email: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error };
    return { success: true, redirectTo: '/' };
  },
  logout: async () => {
    await supabase.auth.signOut();
    return { success: true, redirectTo: '/login' };
  },
  check: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { authenticated: false, redirectTo: '/login' };
    return { authenticated: true };
  },
  getIdentity: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
    return { id: user.id, name: profile?.full_name ?? user.email, role: profile?.role };
  },
  onError: async (error) => {
    if (error?.status === 401 || error?.status === 403) return { logout: true };
    return { error };
  },
};
