/**
 * How a route's length turns into the dates of one departure.
 *
 * The whole model rests on one convention: `start_date` is the first day on
 * the mountain, and the coach leaves the evening before it. Everything else —
 * the return date, the travel date, how many itinerary rows the route needs,
 * the "2 ngày 2 đêm" it is sold as — falls out of that plus the number of
 * walking days. Kept here rather than in a component so the form that declares
 * the number and the screen that creates departures from it cannot drift.
 */
export interface RouteDuration {
  /** Days on the mountain. 0 means the route has not declared it yet. */
  trekDays: number;
  /** Nights travelled before `start_date`. 1 everywhere today. */
  leadNights: number;
}

/**
 * Date arithmetic through UTC, never through the local calendar: a
 * `YYYY-MM-DD` parsed as local time and formatted back can land on the
 * previous day west of Greenwich, and these strings go straight into a
 * Postgres `date` column.
 */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** Last day of the trip, the one stored as `end_date`. */
export function endDateOf(startDate: string, { trekDays }: RouteDuration): string {
  return addDays(startDate, Math.max(trekDays - 1, 0));
}

/** The travel day — "Ngày 00" on the booking page, outside start/end. */
export function departDateOf(startDate: string, { leadNights }: RouteDuration): string {
  return addDays(startDate, -leadNights);
}

/** Rows the route's itinerary must have: the travel legs plus each walking day. */
export function itineraryRowsNeeded({ trekDays, leadNights }: RouteDuration): number {
  return trekDays + leadNights;
}

/**
 * How long the trip is called, in the admin and to the public alike: the days
 * on the mountain and the nights between them. The coach night is deliberately
 * not counted — a two-day walk is sold as 2 ngày 1 đêm, not 2 ngày 2 đêm.
 */
export function durationLabel({ trekDays }: RouteDuration): string {
  return `${trekDays} ngày ${Math.max(trekDays - 1, 0)} đêm`;
}

/**
 * Today on the admin's own calendar, not in UTC. `toISOString()` would call it
 * yesterday every morning before 7am in Vietnam, quietly greying out a day the
 * admin can still sell.
 */
export function todayIso(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * `2026-09-19` → midnight on the 19th *locally*.
 *
 * `new Date('2026-09-19')` would parse as UTC midnight, which is the evening
 * of the 18th anywhere west of Greenwich — a calendar built from those would
 * highlight the wrong squares. The dates here are calendar days, not instants.
 */
export function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The inverse, read off the local calendar for the same reason. */
export function localDateToIso(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `2026-09-19` → `19/09` — the same short form the tour list uses. */
export function formatDdMm(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}
