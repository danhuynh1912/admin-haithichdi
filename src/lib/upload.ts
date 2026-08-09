import { supabase } from './supabase';

export type MediaPrefix =
  | 'locations/images'
  | 'locations/quotations'
  | 'tours/images'
  | 'profiles/avatars'
  | 'blog/heroes'
  | 'blog/images';

/** Lossy but visually clean for photographs; well below JPEG at the same look. */
const WEBP_QUALITY = 0.82;

/**
 * Longest edge a canvas is allowed to reach. Safari refuses to rasterise past
 * roughly 16.7M pixels and hands back a blank canvas rather than an error, so
 * anything larger is scaled down first. 4096 is far above what any screen on
 * the site asks for, so this is a safety limit, not a quality decision.
 */
const MAX_EDGE = 4096;

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

/**
 * Re-encode an image as WebP in the browser, before it ever reaches S3.
 *
 * Passes the file straight through when converting would be wrong or pointless:
 * PDFs, files that are already WebP, animated GIFs (a canvas only ever captures
 * the first frame), and the rare case where WebP comes out larger than what was
 * picked. Any failure also falls back to the original — an upload that works is
 * worth more than one that is smaller.
 */
async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/webp' || file.type === 'image/gif') return file;

  try {
    // `imageOrientation` matters: without it a phone photo carrying EXIF
    // rotation is drawn sideways, and the rotation is lost in the re-encode.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext('2d');
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const webp = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY),
    );

    // A browser without WebP encoding silently hands back a PNG instead.
    if (!webp || webp.type !== 'image/webp') return file;
    return webp.size < file.size ? webp : file;
  } catch {
    return file;
  }
}

export async function uploadMedia(file: File, prefix: MediaPrefix): Promise<string> {
  const payload = await toWebp(file);
  const contentType = payload.type || file.type;

  // The extension has to describe what is actually being stored, not what was
  // picked from disk — the CDN serves these by key.
  const ext = EXTENSION_BY_TYPE[contentType] ?? file.name.split('.').pop() ?? 'bin';
  const base = file.name.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9-_]/g, '-').slice(0, 60);
  const key = `${prefix}/${Date.now()}-${base}.${ext}`;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/presign-upload`;
  const presignRes = await fetch(fnUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ key, contentType }),
  });

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Presign failed (${presignRes.status})`);
  }

  const { uploadUrl } = await presignRes.json() as { uploadUrl: string };

  // Must match the ContentType the URL was signed with, or S3 rejects the PUT.
  const uploadRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: payload,
  });

  if (!uploadRes.ok) throw new Error(`S3 upload failed (${uploadRes.status})`);
  return key;
}
