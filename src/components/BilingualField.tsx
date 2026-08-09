import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/**
 * A translatable field: Vietnamese on the left, English on the right.
 *
 * English is never required — an empty `_en` column falls back to the
 * Vietnamese one at read time (see supabase/migrations/0006_i18n_columns.sql),
 * so a half-translated tour still renders. That is why the EN side carries a
 * hint rather than a validation rule.
 */
export function BilingualField({
  label,
  error,
  hint,
  action,
  vi,
  en,
}: {
  label: string;
  error?: string;
  hint?: string;
  /** Rendered opposite the label — used for the inherit/override control. */
  action?: ReactNode;
  vi: ReactNode;
  en: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {action}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <LocaleTag code="VI" tone="primary" />
          {vi}
        </div>
        <div className="flex flex-col gap-1.5">
          <LocaleTag code="EN" tone="muted" />
          {en}
        </div>
      </div>
      {hint && !error && (
        <span className="text-xs text-muted-foreground">{hint}</span>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

function LocaleTag({ code, tone }: { code: string; tone: 'primary' | 'muted' }) {
  return (
    <span
      className={`w-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        tone === 'primary'
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground'
      }`}
    >
      {code}
    </span>
  );
}

/** Shared placeholder so the fallback rule is stated the same way everywhere. */
export const EN_PLACEHOLDER = 'Để trống → hiển thị tiếng Việt';
