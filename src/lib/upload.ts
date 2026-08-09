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

/** JPEG needs a little more to hold the same detail as WebP at 0.82. */
const JPEG_QUALITY = 0.86;

/**
 * Prefixes whose images end up as an `og:image`, so they are fetched by a
 * link-preview crawler rather than by a browser.
 *
 * Facebook and Messenger do not render a WebP preview — the card comes back
 * with no picture at all — so these are re-encoded as JPEG. They still get the
 * resize and the recompression, just not the format.
 */
const SOCIAL_PREVIEW_PREFIXES: readonly MediaPrefix[] = ['blog/heroes', 'locations/images'];

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
 * Re-encode and downscale an image in the browser, before it ever reaches S3.
 * WebP normally, JPEG where the result has to survive a link-preview crawler.
 *
 * Passes the file straight through when re-encoding would be wrong or
 * pointless: PDFs, animated GIFs (a canvas only ever captures the first frame),
 * and the case where the result comes out larger than what was picked. Any
 * failure also falls back to the original — an upload that works is worth more
 * than one that is smaller.
 */
async function reencode(file: File, prefix: MediaPrefix): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  if (file.type === 'image/gif') return file;

  const target = SOCIAL_PREVIEW_PREFIXES.includes(prefix) ? 'image/jpeg' : 'image/webp';
  const quality = target === 'image/jpeg' ? JPEG_QUALITY : WEBP_QUALITY;

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

    const encoded = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, target, quality),
    );

    // A browser that cannot encode the requested format silently hands back a
    // PNG, which would be neither smaller nor what the key claims to hold.
    if (!encoded || encoded.type !== target) return file;
    return encoded.size < file.size ? encoded : file;
  } catch {
    return file;
  }
}

export async function uploadMedia(file: File, prefix: MediaPrefix): Promise<string> {
  const payload = await reencode(file, prefix);
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
