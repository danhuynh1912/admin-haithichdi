import { useMemo, useState } from 'react';
import { useDelete, useList, useNavigation, type CrudFilter } from '@refinedev/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SimpleSelect } from '@/components/SimpleSelect';
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

/** "No filter" as a real value — a blank one reads as nothing chosen. */
const ALL = 'all';

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
  const [routeId, setRouteId] = useState(ALL);

  const months = [0, 1, 2].map(i => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
  const windowStart = toISO(months[0]);
  const windowEnd = toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0));

  // Narrowing to one route has to reach the calendar too, not just the list:
  // day highlights that still counted every route would point at days the
  // filtered list then shows as empty.
  const routeFilter: CrudFilter[] =
    routeId === ALL ? [] : [{ field: 'location_id', operator: 'eq', value: Number(routeId) }];

  // Every tour that touches the window: it starts before the window closes and
  // ends after it opens. Undated tours have nothing to draw, and NULL fails
  // both comparisons, so they drop out here on their own.
  const { query: windowQuery } = useList<CalendarTour>({
    resource: 'tours',
    pagination: { pageSize: 1000 },
    filters: [
      { field: 'start_date', operator: 'lte', value: windowEnd },
      { field: 'end_date', operator: 'gte', value: windowStart },
      ...routeFilter,
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
    filters: routeFilter,
    sorters: [{ field: 'start_date', order: 'asc' }],
    meta: { select: TOUR_SELECT },
  });
  const pageTours = allQuery?.data?.data ?? [];
  const total = allQuery?.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { query: routesQuery } = useList<RouteOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
    meta: { select: 'id, name, default_price' },
  });
  const routes = routesQuery?.data?.data ?? [];
  const routeById = new Map(routes.map(r => [r.id, r]));

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

  const toursTable = (list: CalendarTour[], emptyText: string) => (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            {['Tên tour', 'Cung', 'Ngày đi', 'Ngày về', 'Giá', 'Active', ''].map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{emptyText}</td>
            </tr>
          )}
          {list.map(t => (
            <tr
              key={t.id}
              onClick={() => edit('tours', t.id)}
              className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
            >
              <td className="px-4 py-3 font-medium">{t.title}</td>
              <td className="whitespace-nowrap px-4 py-3">{routeById.get(t.location_id)?.name ?? '—'}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(t.start_date)}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatDate(t.end_date)}</td>
              <td className="whitespace-nowrap px-4 py-3">{price(t)}</td>
              <td className="px-4 py-3">
                <Badge variant={t.is_active ? 'success' : 'secondary'}>{t.is_active ? 'ON' : 'OFF'}</Badge>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={e => { e.stopPropagation(); edit('tours', t.id); }}
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm('Xóa tour này?')) del({ resource: 'tours', id: t.id });
                    }}
                  >
                    Xóa
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div className="w-full shrink-0 lg:w-[270px]">
        {/* Sits above the months because it narrows the calendar as well as the
            list — putting it over the table alone would imply otherwise. */}
        <SimpleSelect
          ariaLabel="Lọc theo cung"
          value={routeId}
          onValueChange={next => {
            setRouteId(next);
            // The old page number rarely exists in the narrowed result, and
            // page 3 of a 1-page list reads as "no tours".
            setPage(1);
          }}
          options={[
            { value: ALL, label: 'Tất cả cung' },
            ...routes.map(r => ({ value: String(r.id), label: r.name })),
          ]}
          className="mb-3 w-full"
        />

        <div className="mb-3 flex items-center justify-between gap-1">
          <Button variant="outline" size="sm" title="3 tháng trước" onClick={() => shift(-3)}>←</Button>
          <span className="text-sm font-semibold">
            T{months[0].getMonth() + 1}/{months[0].getFullYear()} – T{months[2].getMonth() + 1}/{months[2].getFullYear()}
            {loading && <Spinner className="ml-2 inline-block size-3.5" />}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={goToday}>Hôm nay</Button>
            <Button variant="outline" size="sm" title="3 tháng sau" onClick={() => shift(3)}>→</Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {months.map(m => (
            <div key={toISO(m)} className="rounded-xl border border-border p-2">
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

      <aside className="min-w-0 flex-1">
        {selected ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">
                Tour ngày {formatDate(selected)}
                <span className="ml-2 font-normal text-muted-foreground">({dayTours.length})</span>
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Bỏ chọn</Button>
            </div>
            {toursTable(dayTours, 'Không có tour nào diễn ra trong ngày này.')}
          </>
        ) : (
          <>
            <h3 className="mb-3 text-sm font-bold">
              {routeId === ALL ? 'Tất cả tour' : `Tour cung ${routeById.get(Number(routeId))?.name ?? ''}`}
              <span className="ml-2 font-normal text-muted-foreground">({total})</span>
            </h3>
            {toursTable(
              pageTours,
              routeId === ALL ? 'Chưa có tour nào.' : 'Cung này chưa có tour nào.',
            )}
            <div className="mt-3 flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => p - 1)} disabled={page <= 1}>←</Button>
              <span className="text-xs text-muted-foreground">Trang {page} / {pageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= pageCount}>→</Button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
