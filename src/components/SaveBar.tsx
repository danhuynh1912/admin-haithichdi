import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

/**
 * Saving keeps the editor on the record rather than bouncing to the list, so
 * this brief "Đã lưu" is the only sign anything happened — without it a
 * successful save looks identical to a dead button.
 */
export function useSavedFlash(durationMs = 2500) {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(() => {
    setSaved(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), durationMs);
  }, [durationMs]);

  // A save immediately before navigating away would otherwise leave a timer
  // holding a setState on an unmounted form.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { saved, flash };
}

/** The submit / cancel row every form ends with. */
export function SaveBar({
  busy,
  saved,
  disabled = false,
  onCancel,
  saveLabel = 'Lưu',
  cancelLabel = 'Quay lại danh sách',
}: {
  /** A save is in flight. Shows the spinner. */
  busy: boolean;
  saved: boolean;
  /**
   * There is nothing to save yet — a required choice higher up the form is
   * still empty. Separate from `busy` on purpose: folding the two together
   * leaves the button reading "Đang lưu…" forever on a form nobody has
   * started filling in.
   */
  disabled?: boolean;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
}) {
  return (
    <div className="flex items-center gap-3 mt-2">
      <Button type="submit" disabled={busy || disabled}>
        {busy ? <><Spinner /> Đang lưu…</> : saveLabel}
      </Button>
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      {saved && (
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <Check className="size-4" />
          Đã lưu
        </span>
      )}
    </div>
  );
}
