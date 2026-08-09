import { useRef, useState } from 'react';
import { uploadMedia, type MediaPrefix } from '@/lib/upload';
import { resolveMediaUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Label } from '@/components/ui/label';

interface Props {
  prefix: MediaPrefix;
  currentPath?: string | null;
  currentUrl?: string | null;
  onUploaded: (key: string) => void;
  accept?: string;
  label?: string;
  /**
   * Spread `register('the_path_column')` here on any form backed by
   * `@refinedev/react-hook-form`.
   *
   * That adapter does not `reset()` the form with the fetched record — it only
   * pushes values into fields that are registered. A `*_path` column written
   * solely through `setValue` is therefore never registered, so the stored key
   * never comes back on an edit screen and the preview stays empty. The hidden
   * input below is what makes it a real field.
   */
  field?: React.ComponentProps<'input'>;
}

export function ImageUpload({ prefix, currentPath, currentUrl, onUploaded, accept = 'image/*', label = 'Ảnh', field }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local preview of a file the user just picked, shown until the page is left.
  // Everything else is derived from the props on every render: seeding state
  // from them instead would freeze the preview at whatever the form held on
  // first paint, which for an edit form is nothing — the record arrives later.
  const [pickedPreview, setPickedPreview] = useState<string | null>(null);
  const pickedPreviewRef = useRef<string | null>(null);
  const previewUrl = pickedPreview ?? resolveMediaUrl(currentPath, currentUrl);

  // Revoking through a ref rather than inside the state updater: React calls
  // updaters twice in StrictMode, and freeing a URL is not something to repeat.
  function replacePickedPreview(next: string | null) {
    if (pickedPreviewRef.current) URL.revokeObjectURL(pickedPreviewRef.current);
    pickedPreviewRef.current = next;
    setPickedPreview(next);
  }

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    replacePickedPreview(URL.createObjectURL(file));
    try {
      const key = await uploadMedia(file, prefix);
      onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
      // Drop back to whatever is stored on the record.
      replacePickedPreview(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {previewUrl && (
        <img src={previewUrl} alt="preview" className="w-28 h-20 object-cover rounded-md border border-border" />
      )}
      <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading} className="w-fit">
        {uploading ? <><Spinner /> Đang upload…</> : 'Chọn file'}
      </Button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {field ? <input type="hidden" {...field} /> : null}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
