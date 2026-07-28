import { supabase } from './supabase';

/**
 * Client for the `admin-users` edge function — the only path that can touch
 * auth.users. Profile-only edits still go through refine's data provider.
 */
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-users`;

export interface LeaderProfileInput {
  role?: string;
  full_name?: string;
  avatar_path?: string | null;
  avatar_url?: string;
  bio?: string;
  display_role?: string;
  strengths?: string[];
  highlight?: string;
  location?: string;
  relationship_status?: string;
  date_of_birth?: string | null;
  years_experience?: number;
  is_active?: boolean;
}

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => ({})) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
  return json as T;
}

export function createLeader(email: string, password: string, profile: LeaderProfileInput) {
  return call<{ id: string }>({ action: 'create', email, password, profile });
}

export function updateLeaderCredentials(id: string, patch: { email?: string; password?: string }) {
  return call<{ id: string }>({ action: 'update_credentials', id, ...patch });
}

export function deleteLeader(id: string) {
  return call<{ id: string }>({ action: 'delete', id });
}

/** Django-admin style "generate a password for me" helper. */
export function randomPassword(length = 14): string {
  const alphabet = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join('');
}
