import { supabase } from './supabase';

export type MediaPrefix = 'locations/images' | 'locations/quotations' | 'tours/images' | 'profiles/avatars';

export async function uploadMedia(file: File, prefix: MediaPrefix): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'bin';
  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 60);
  const key = `${prefix}/${Date.now()}-${base}.${ext}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/presign-upload`;
  const presignRes = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ key, contentType: file.type }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Presign failed (${presignRes.status})`);
  }

  const { uploadUrl } = await presignRes.json() as { uploadUrl: string };

  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!uploadRes.ok) throw new Error(`S3 upload failed (${uploadRes.status})`);
  return key;
}
