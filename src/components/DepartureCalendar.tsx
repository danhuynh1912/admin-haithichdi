import { vi } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { isoToLocalDate, localDateToIso, todayIso } from '@/lib/duration';

/**
 * The month grid departures are ticked on.
 *
 * Everything crossing this boundary is a `YYYY-MM-DD` string, because that is
 * what a `date` column holds and what the rest of the screen computes with;
 * the `Date` objects react-day-picker wants exist only inside it, and are
 * always built on the local calendar — a UTC-parsed date string lands on the
 * previous day west of Greenwich and would highlight the wrong squares.
 */
export function DepartureCalendar({
  selected,
  onChange,
  taken,
  minDate = todayIso(),
}: {
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  /** Dates the route already departs on — shown struck through, never pickable. */
  taken?: Set<string>;
  /** Nothing before this can be picked. */
  minDate?: string;
}) {
  const takenDates = [...(taken ?? [])].map(isoToLocalDate);

  return (
    <Calendar
      mode="multiple"
      locale={vi}
      selected={[...selected].map(isoToLocalDate)}
      onSelect={days => onChange(new Set((days ?? []).map(localDateToIso)))}
      // Struck through rather than hidden: that a date is unavailable because a
      // departure already exists is information the admin wants.
      disabled={[{ before: isoToLocalDate(minDate) }, ...takenDates]}
      modifiers={{ taken: takenDates }}
      modifiersClassNames={{ taken: 'line-through' }}
      startMonth={isoToLocalDate(minDate)}
      className="rounded-lg border bg-card p-3"
    />
  );
}
