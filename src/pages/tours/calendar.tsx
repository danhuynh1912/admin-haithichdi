import { useMemo, useState } from 'react';
import { useDelete, useList, useNavigation } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn, formatDate } from '@/lib/utils';

interface CalendarTour {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  price: string | null;
  is_active: boolean;
  location_id: number;
}

interface RouteOption {
  id: number;
  name: string;
  default_price: string | null;
}

const TOUR_SELECT = 'id,title,start_date,end_date,price,is_active,location_id';
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const PAGE_SIZE = 10;

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date → `YYYY-MM-DD`, the shape `tours.start_date` compares as. */
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A month as a Monday-first grid of cells, padded with nulls so every row is a
 * full week — the blanks keep day numbers under their weekday header.
 */
function monthCells(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function ToursCalendar() {
  const { edit } = useNavigation();
  const { mutate: del } = useDelete();
  const todayISO = toISO(new Date());

  // The window is anchored to the first of a month and always spans three
  // whole months; navigation slides it by three so pages never overlap.
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  // No day picked = browsing mode: the side panel lists every tour, paged.
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const months = [0, 1, 2].map(i => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
  const windowStart = toISO(months[0]);
  const windowEnd = toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0));

  // Every tour that touches the window: it starts before the window closes and
  // ends after it opens. Undated tours have nothing to draw, and NULL fails
  // both comparisons, so they drop out here on their own.
  const { query: windowQuery } = useList<CalendarTour>({
    resource: 'tours',
    pagination: { pageSize: 1000 },
    filters: [
      { field: 'start_date', operator: 'lte', value: windowEnd },
      { field: 'end_date', operator: 'gte', value: windowStart },
    ],
    sorters: [{ field: 'start_date', order: 'asc' }],
    meta: { select: TOUR_SELECT },
  });
  const windowTours = windowQuery?.data?.data ?? [];
  const loading = windowQuery?.isLoading ?? false;

  // The browsing list is its own paged query rather than a slice of the window:
  // it must show every tour, including ones outside these three months and
  // ones with no dates at all.
  const { query: allQuery } = useList<CalendarTour>({
    resource: 'tours',
    pagination: { currentPage: page, pageSize: PAGE_SIZE },
    sorters: [{ field: 'start_date', order: 'asc' }],
    meta: { select: TOUR_SELECT },
  });
  const pageTours = allQuery?.data?.data ?? [];
  const total = allQuery?.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { query: routesQuery } = useList<RouteOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    meta: { select: 'id, name, default_price' },
  });
  const routeById = new Map((routesQuery?.data?.data ?? []).map(r => [r.id, r]));

  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of windowTours) {
      if (!t.start_date || !t.end_date) continue;
      const end = new Date(`${t.end_date}T00:00:00`);
      for (const d = new Date(`${t.start_date}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toISO(d);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  }, [windowTours]);

  const dayTours = selected
    ? windowTours.filter(t => t.start_date && t.end_date && t.start_date <= selected && selected <= t.end_date)
    : [];

  const shift = (by: number) => setAnchor(a => new Date(a.getFullYear(), a.getMonth() + by, 1));
  const goToday = () => {
    const now = new Date();
    setAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(todayISO);
  };

  const price = (t: CalendarTour) => {
    if (t.price) return `${Number(t.price).toLocaleString('vi-VN')}₫`;
    const inherited = routeById.get(t.location_id)?.default_price;
    return inherited ? `${Number(inherited).toLocaleString('vi-VN')}₫ · cung` : 'Chưa có giá';
  };

  const tourCard = (t: CalendarTour) => (
    <li key={t.id}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => edit('tours', t.id)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') edit('tours', t.id); }}
        className="w-full cursor-pointer rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold">{t.title}</span>
          <Badge variant={t.is_active ? 'success' : 'secondary'}>
            {t.is_active ? 'ON' : 'OFF'}
          </Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">
          {routeById.get(t.location_id)?.name ?? '—'}
          {' · '}
          {!t.start_date
            ? 'Chưa có ngày'
            : t.start_date === t.end_date
              ? formatDate(t.start_date)
              : `${formatDate(t.start_date)} → ${formatDate(t.end_date)}`}
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{price(t)}</span>
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              if (confirm('Xóa tour này?')) del({ resource: 'tours', id: t.id });
            }}
            className="text-xs font-semibold text-destructive underline-offset-4 hover:underline"
          >
            Xóa
          </button>
        </div>
      </div>
    </li>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-3)}>← 3 tháng trước</Button>
          <span className="text-sm font-semibold">
            Tháng {months[0].getMonth() + 1}/{months[0].getFullYear()} – Tháng {months[2].getMonth() + 1}/{months[2].getFullYear()}
            {loading && <Spinner className="ml-2 inline-block size-3.5" />}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={goToday}>Hôm nay</Button>
            <Button variant="outline" size="sm" onClick={() => shift(3)}>3 tháng sau →</Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {months.map(m => (
            <div key={toISO(m)} className="rounded-xl border border-border p-3">
              <div className="mb-2 text-center text-sm font-semibold">
                Tháng {m.getMonth() + 1}/{m.getFullYear()}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map(w => (
                  <span key={w} className="py-1 text-center text-[10px] font-semibold uppercase text-muted-foreground">
                    {w}
                  </span>
                ))}
                {monthCells(m.getFullYear(), m.getMonth()).map((d, i) => {
                  if (!d) return <span key={i} />;
                  const key = toISO(d);
                  const count = countByDay.get(key) ?? 0;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelected(prev => (prev === key ? null : key))}
                      title={count ? `${count} tour` : undefined}
                      className={cn(
                        'relative aspect-square rounded-md text-xs transition-colors',
                        count > 0
                          ? 'bg-primary/15 font-semibold text-primary hover:bg-primary/25'
                          : 'text-foreground/70 hover:bg-muted',
                        selected === key && 'ring-2 ring-primary',
                        todayISO === key && selected !== key && 'ring-1 ring-border',
                      )}
                    >
                      {d.getDate()}
                      {count > 1 && (
                        <span className="absolute right-0.5 top-0.5 text-[9px] font-bold leading-none">
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-full shrink-0 lg:w-80">
        <div className="rounded-xl border border-border p-4">
          {selected ? (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">
                  Tour ngày {formatDate(selected)}
                  <span className="ml-2 font-normal text-muted-foreground">({dayTours.length})</span>
                </h3>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Bỏ chọn</Button>
              </div>
              {dayTours.length === 0 ? (
                <p className="text-sm text-muted-foreground">Không có tour nào diễn ra trong ngày này.</p>
              ) : (
                <ul className="flex flex-col gap-2">{dayTours.map(tourCard)}</ul>
              )}
            </>
          ) : (
            <>
              <h3 className="mb-3 text-sm font-bold">
                Tất cả tour
                <span className="ml-2 font-normal text-muted-foreground">({total})</span>
              </h3>
              {pageTours.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có tour nào.</p>
              ) : (
                <ul className="flex flex-col gap-2">{pageTours.map(tourCard)}</ul>
              )}
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>←</Button>
                <span className="text-xs text-muted-foreground">Trang {page} / {pageCount}</span>
                <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pageCount}>→</Button>
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
