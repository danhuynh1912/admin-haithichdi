import type * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Ways a dialog can close without anyone meaning to close it. */
const INCIDENTAL_CLOSE = ['outside-press', 'escape-key', 'close-watcher', 'focus-out'];

/**
 * A controlled modal: portal + backdrop + centred popup in one component, so
 * callers only deal with `open`/`onClose`. Base UI handles focus trapping,
 * Escape, and scroll locking.
 *
 * `title` is required — a dialog without an accessible name is unusable with a
 * screen reader.
 *
 * `dismissible={false}` narrows closing down to the close button alone. It is
 * for dialogs holding a form: a misjudged click on the backdrop or a reflexive
 * Escape would throw away everything typed, and there is no undo for that.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  className,
  dismissible = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  className?: string;
  dismissible?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root
      open={open}
      disablePointerDismissal={!dismissible}
      // Gated on the reason rather than on the event, so the close button keeps
      // working — it reports `close-press`, which is never incidental.
      onOpenChange={(next, details) => {
        if (next) return;
        if (!dismissible && INCIDENTAL_CLOSE.includes(details.reason)) return;
        onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <DialogPrimitive.Popup
          className={cn(
            'fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-4rem)] w-[min(34rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2',
            'overflow-y-auto rounded-xl border bg-card p-6 text-card-foreground shadow-lg outline-none',
            'transition-all duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            className,
          )}
        >
          <div className="mb-4 pr-8">
            <DialogPrimitive.Title className="text-lg font-bold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Đóng"
            className="absolute top-5 right-5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <XIcon className="size-4" />
          </DialogPrimitive.Close>
          {children}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
