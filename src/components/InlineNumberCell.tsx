import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * A number in a table cell that can be edited where it sits.
 *
 * Opening a whole edit form to change one figure is most of the cost of
 * changing it, and these three — elevation, difficulty, home order — are the
 * ones people compare across rows and fix in a sweep.
 *
 * The confirm buttons are portalled to the body and positioned from the
 * input's own rect. Two reasons they cannot live in the cell: putting them in
 * the flow would grow the row the moment editing starts, and positioning them
 * absolutely inside the table would have them clipped — the list scrolls in an
 * `overflow-x-auto` box, and a single non-visible axis makes the other one
 * clip too, so the last row's popup would be cut off.
 *
 * The idle text and the input are locked to the same height for the same
 * reason: the row must not move when it becomes editable.
 */
export function InlineNumberCell({
  value,
  onSave,
  ariaLabel,
  format = String,
  suffix = '',
  placeholder = '—',
  nullable = false,
  min,
  max,
  step,
  width = 'w-20',
}: {
  value: number | null;
  onSave: (next: number | null) => Promise<unknown>;
  ariaLabel: string;
  format?: (value: number) => string;
  suffix?: string;
  /** Shown when the value is null. */
  placeholder?: string;
  /** Whether clearing the box is allowed, and means "no value". */
  nullable?: boolean;
  min?: number;
  max?: number;
  step?: number;
  width?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  // Measured before paint so the buttons never show up in the wrong place for
  // a frame. Re-measured on any scroll — capture phase, because the one that
  // matters is the table's own scroll box, not the window.
  useLayoutEffect(() => {
    if (!editing) return setAnchor(null);

    const place = () => {
      const box = inputRef.current?.getBoundingClientRect();
      if (box) setAnchor({ top: box.bottom + 4, left: box.left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [editing]);

  function open() {
    setDraft(value == null ? '' : String(value));
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const raw = draft.trim();
    let next: number | null;

    if (raw === '') {
      if (!nullable) return setError('Không được để trống');
      next = null;
    } else {
      next = Number(raw.replace(',', '.'));
      if (!Number.isFinite(next)) return setError('Phải là số');
      if (min != null && next < min) return setError(`Nhỏ nhất ${min}`);
      if (max != null && next > max) return setError(`Lớn nhất ${max}`);
    }

    // Nothing changed — close rather than spend a request saying so.
    if (next === value) return cancel();

    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu thất bại');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={open}
        aria-label={`Sửa ${ariaLabel}`}
        className="group/cell -mx-1 flex h-7 items-center gap-1.5 rounded px-1 bg-transparent border-none cursor-pointer text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className={value == null ? 'text-muted-foreground' : undefined}>
          {value == null ? placeholder : `${format(value)}${suffix}`}
        </span>
        <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100" />
      </button>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="number"
        value={draft}
        min={min}
        max={max}
        step={step}
        disabled={saving}
        autoFocus
        onChange={event => { setDraft(event.target.value); setError(null); }}
        onKeyDown={event => {
          if (event.key === 'Enter') { event.preventDefault(); void save(); }
          if (event.key === 'Escape') { event.preventDefault(); cancel(); }
        }}
        aria-label={ariaLabel}
        className={cn(
          'h-7 rounded-md border border-input bg-background px-2 text-sm',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          width,
        )}
      />

      {anchor &&
        createPortal(
          <div
            style={{ position: 'fixed', top: anchor.top, left: anchor.left, zIndex: 60 }}
            className="flex items-center gap-1 rounded-md border border-border bg-popover p-1 shadow-md"
          >
            <button
              type="button"
              // mousedown, not click: the input's blur would otherwise fire
              // first and could tear the buttons down before the click lands.
              onMouseDown={event => { event.preventDefault(); void save(); }}
              disabled={saving}
              title="Lưu (Enter)"
              aria-label="Lưu"
              className="flex h-6 w-6 items-center justify-center rounded border border-transparent bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Spinner /> : <Check className="size-3.5" />}
            </button>
            <button
              type="button"
              onMouseDown={event => { event.preventDefault(); cancel(); }}
              disabled={saving}
              title="Huỷ (Esc)"
              aria-label="Huỷ"
              className="flex h-6 w-6 items-center justify-center rounded border border-border bg-background text-muted-foreground cursor-pointer hover:bg-muted disabled:opacity-50"
            >
              <X className="size-3.5" />
            </button>
            {error && <span className="px-1 text-xs text-destructive whitespace-nowrap">{error}</span>}
          </div>,
          document.body,
        )}
    </>
  );
}
