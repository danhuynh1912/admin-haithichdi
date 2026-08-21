import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

/**
 * Edits a `text[]` column as an ordered list of short lines.
 *
 * Controlled on the whole array rather than per row: the column is written in
 * one shot, so there is no half-saved state to reason about — unlike the
 * gallery and the itinerary, which live in child tables and are replaced by a
 * delete-then-insert on every save.
 */
export function StringListEditor({
  value,
  onChange,
  placeholder,
  addLabel = '+ Thêm dòng',
}: {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addLabel?: string;
}) {
  const items = value ?? [];

  const replace = (index: number, text: string) =>
    onChange(items.map((item, i) => (i === index ? text : item)));

  const remove = (index: number) => {
    // A blank row is one someone just added and changed their mind about —
    // there is nothing to lose, so asking would only be in the way.
    const text = items[index]?.trim();
    if (text && !confirm(`Xoá dòng này?\n\n“${text}”`)) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        // Index as key: these rows have no id, and reordering swaps the text of
        // two rows rather than moving a row's identity.
        <div key={i} className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}.</span>
          <Input
            value={item}
            onChange={event => replace(i, event.target.value)}
            placeholder={placeholder}
            className="flex-1"
          />
          <div className="flex flex-col">
            <IconButton label="Lên" onClick={() => move(i, -1)} disabled={i === 0}>▲</IconButton>
            <IconButton label="Xuống" onClick={() => move(i, 1)} disabled={i === items.length - 1}>▼</IconButton>
          </div>
          <button
            type="button"
            onClick={() => remove(i)}
            className="text-destructive text-lg leading-none px-1 bg-transparent border-none cursor-pointer"
            aria-label="Xoá dòng"
          >
            ×
          </button>
        </div>
      ))}

      {/* At the bottom, like the gallery: a long list should not send the
          editor back up the page to add one more line. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...items, ''])}
        className="w-full border-dashed border-primary text-primary hover:text-primary"
      >
        {addLabel}
      </Button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="text-[8px] leading-none px-1 py-0.5 bg-transparent border-none cursor-pointer text-muted-foreground hover:text-foreground disabled:opacity-25 disabled:cursor-default"
    >
      {children}
    </button>
  );
}
