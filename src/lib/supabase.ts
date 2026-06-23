import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key);
export const CDN_BASE = (import.meta.env.VITE_CDN_BASE_URL as string ?? '').replace(/\/+$/, '');

export function resolveMediaUrl(path: string | null | undefined, fallbackUrl: string | null | undefined): string | null {
  if (path?.trim()) return CDN_BASE ? `${CDN_BASE}/${path.replace(/^\/+/, '')}` : `/${path}`;
  return fallbackUrl?.trim() || null;
}
