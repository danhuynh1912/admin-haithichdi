import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
      {saved && <SavedToast />}
    </div>
  );
}

/**
 * The confirmation floats over the page rather than sitting beside the button.
 * These forms run to several screens; a route with a gallery and an itinerary
 * puts Lưu far below the fold, and an inline note there is read by nobody who
 * saved with the keyboard or scrolled away while it was in flight.
 */
function SavedToast() {
  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      <Check className="size-4" />
      Đã lưu
    </div>,
    document.body,
  );
}
