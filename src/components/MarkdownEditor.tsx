import { useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImagePlus, Eye, Pencil } from 'lucide-react';
import { uploadMedia } from '@/lib/upload';
import { resolveMediaUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

/**
 * Markdown body editor with an image button that uploads and drops a reference
 * at the caret, plus a preview rendered the same way the public site renders it.
 *
 * What is stored is the CDN key, not an absolute URL — `![alt](blog/images/x.webp)`
 * — matching the `*_path` convention used everywhere else in this schema, so
 * moving CDN never means rewriting posts.
 */
export function MarkdownEditor({
  value,
  onChange,
  onImageUploaded,
  rows = 18,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Told about every successful upload so the post can track its own images. */
  onImageUploaded?: (key: string, size: { width: number; height: number } | null) => void;
  rows?: number;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  /** Insert at the caret, keeping whatever the author already typed either side. */
  function insertAtCaret(snippet: string) {
    const el = textareaRef.current;
    if (!el) {
      onChange(`${value}\n\n${snippet}`);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? start;
    const next = `${value.slice(0, start)}${snippet}${value.slice(end)}`;
    onChange(next);

    // Put the caret after what was inserted rather than back at position 0.
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + snippet.length;
      el.setSelectionRange(caret, caret);
    });
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      // Reading the size before upload costs nothing and lets the article
      // reserve space for the image instead of jumping when it loads.
      const size = await readImageSize(file).catch(() => null);
      const key = await uploadMedia(file, 'blog/images');
      insertAtCaret(`\n\n![](${key})\n\n`);
      onImageUploaded?.(key, size);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          {uploading ? <><Spinner /> Đang tải ảnh…</> : <><ImagePlus className="size-4" /> Chèn ảnh</>}
        </Button>
        <Button
          type="button"
          variant={preview ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreview(p => !p)}
        >
          {preview ? <><Pencil className="size-4" /> Soạn thảo</> : <><Eye className="size-4" /> Xem trước</>}
        </Button>
        <span className="text-xs text-muted-foreground">
          Ảnh chèn vào đúng vị trí con trỏ. Caption là chữ trong <code>![caption](…)</code>.
        </span>
      </div>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <span className="text-xs text-destructive">{error}</span>}

      {preview ? (
        <div className="min-h-40 rounded-md border border-input bg-background px-4 py-3">
          <MarkdownPreview markdown={value} />
        </div>
      ) : (
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="font-mono"
        />
      )}
    </div>
  );
}

/**
 * Preview of the stored markdown. Kept deliberately plain — its job is to show
 * structure and that images resolve, not to imitate the public typography,
 * which lives in the frontend repo and cannot be imported from here.
 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return <p className="text-sm text-muted-foreground">Chưa có nội dung.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm leading-relaxed">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-4 text-xl font-bold">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-3 text-lg font-semibold">{children}</h3>,
          h3: ({ children }) => <h4 className="mt-2 font-semibold">{children}</h4>,
          p: ({ children }) => <p className="my-2">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal pl-6">{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-primary/50 pl-3 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-primary underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border px-2 py-1">{children}</td>,
          img: ({ src, alt }) => {
            const key = typeof src === 'string' ? src : '';
            const resolved = /^https?:\/\//.test(key) ? key : resolveMediaUrl(key, null);
            if (!resolved) return null;
            return (
              <figure className="my-3">
                <img src={resolved} alt={alt ?? ''} className="w-full rounded-lg border" />
                {alt ? (
                  <figcaption className="mt-1 text-center text-xs text-muted-foreground">{alt}</figcaption>
                ) : null}
              </figure>
            );
          },
        }}
      >
        {markdown}
      </Markdown>
    </div>
  );
}

/** Intrinsic size of the picked file, read before it is re-encoded and sent. */
function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return createImageBitmap(file).then(bitmap => {
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  });
}
