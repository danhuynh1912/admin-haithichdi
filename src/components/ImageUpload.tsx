import { useRef, useState } from 'react';
import { uploadMedia, type MediaPrefix } from '@/lib/upload';
import { resolveMediaUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Props {
  prefix: MediaPrefix;
  currentPath?: string | null;
  currentUrl?: string | null;
  onUploaded: (key: string) => void;
  accept?: string;
  label?: string;
}

export function ImageUpload({ prefix, currentPath, currentUrl, onUploaded, accept = 'image/*', label = 'Ảnh' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(resolveMediaUrl(currentPath, currentUrl));

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    setPreviewUrl(URL.createObjectURL(file));
    try {
      const key = await uploadMedia(file, prefix);
      onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
      setPreviewUrl(resolveMediaUrl(currentPath, currentUrl));
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
        {uploading ? 'Đang upload…' : 'Chọn file'}
      </Button>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
