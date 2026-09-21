import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { useTable } from '@refinedev/react-table';
import { useDataProvider, useList, useUpdate, type CrudFilter } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/SimpleSelect';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { slugify, writeBookingsXlsx, type ExportableBooking } from '@/lib/export-bookings';
import { cn, formatDate, formatDateTime } from '@/lib/utils';

interface Booking {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: 'pending' | 'confirmed' | 'needs_contact_check' | 'cancelled';
  /** Staff's note about the status — the customer reads this one. */
  status_note: string;
  medal_name: string | null;
  dob: string | null;
  citizen_id: string | null;
  emergency_phone: string;
  note: string;
  created_at: string;
  location_id: number;
  /** The day the customer asked to set off. The route says how long it runs. */
  trek_date: string;
  // Embedded by `SELECT_WITH_ROUTE` below — a booking always has a route, but
  // PostgREST types the embed as nullable, so guard when reading it.
  locations: {
    id: number;
    name: string;
    default_trek_days: number | null;
  } | null;
}

interface LocationOption {
  id: number;
  name: string;
}

/** A day in the calendar, and how many climbs are out on it. */
type DayTally = Map<string, number>;

/** Just enough of a booking to draw the calendar. */
interface CalendarRow {
  trek_date: string;
  location_id: number;
  locations: { default_trek_days: number | null } | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  needs_contact_check: 'Cần xác nhận lại liên hệ',
  cancelled: 'Đã hủy',
};

const STATUS_ITEMS = Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }));

/** The one status that carries a note the customer is meant to act on. */
const NEEDS_CONTACT = 'needs_contact_check';

const SELECT_WITH_ROUTE = '*, locations!inner(id, name, default_trek_days)';

/** Just the two columns the calendar counts by. */
const SELECT_FOR_CALENDAR = 'trek_date, location_id, locations!inner(default_trek_days)';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Local date → `YYYY-MM-DD`, the shape `trek_date` compares as. */
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * A month as a Monday-first grid, padded with nulls so every row is a full
 * week — the blanks keep day numbers under their weekday header.
 */
function monthCells(year: number, month: number): (Date | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** The last day a climb starting on `trekDate` is still out. */
function trekEnd(trekDate: string, trekDays: number | null): string {
  const [y, m, d] = trekDate.split('-').map(Number);
  if (!y || !m || !d) return trekDate;
  return toISO(new Date(y, m - 1, d + Math.max((trekDays ?? 1) - 1, 0)));
}

/** "No filter" as a real value — a blank one reads as nothing chosen. */
const ALL = 'all';

const statusVariant = (s: string) =>
  s === 'confirmed' ? 'success'
  : s === 'pending' ? 'warning'
  : s === NEEDS_CONTACT ? 'info'
  : 'destructive';

/**
 * The days a climb covers: `26/09 – 27/09` for a two-day route, one plain date
 * for a day trip. Only the first day is stored — the route supplies the rest.
 */
function trekRange(trekDate: string, trekDays: number | null): string {
  const start = formatDate(trekDate);
  if (!trekDays || trekDays <= 1) return start;
  return `${start} – ${formatDate(trekEnd(trekDate, trekDays))}`;
}

const col = createColumnHelper<Booking>();

export function BookingList() {
  const { mutate: update } = useUpdate<Booking>();
  const dataProvider = useDataProvider();
  const [locationId, setLocationId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const todayISO = toISO(new Date());
  // The window is anchored to the first of a month and always spans three
  // whole months; navigation slides it by three so pages never overlap.
  const [anchor, setAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  /** No day picked = every registration, newest first. */
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const months = [0, 1, 2].map(i => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));
  const windowEnd = toISO(new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0));

  const { query: locationsQuery } = useList<LocationOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
  });
  const locations = locationsQuery?.data?.data ?? [];

  /**
   * Every climb that touches the three months on screen.
   *
   * Deliberately unfiltered by route: the calendar still draws the days other
   * routes are out on, dimmed, so filtering never looks like the month emptied.
   * A climb can start before the window and run into it, so the lower bound
   * reaches back by the longest route anyone offers — a week is generous.
   */
  const { query: windowQuery } = useList<CalendarRow>({
    resource: 'bookings',
    pagination: { pageSize: 1000 },
    filters: [
      { field: 'trek_date', operator: 'lte', value: windowEnd },
      { field: 'trek_date', operator: 'gte', value: toISO(new Date(months[0].getFullYear(), months[0].getMonth(), -7)) },
    ],
    meta: { select: SELECT_FOR_CALENDAR },
  });
  const windowRows = windowQuery?.data?.data ?? [];
  const calendarLoading = windowQuery?.isLoading ?? false;

  /** Tally how many of `rows` are out on each day they cover, start through end. */
  const tally = (rows: CalendarRow[]): DayTally => {
    const map: DayTally = new Map();
    for (const row of rows) {
      const last = trekEnd(row.trek_date, row.locations?.default_trek_days ?? null);
      const end = new Date(`${last}T00:00:00`);
      for (const d = new Date(`${row.trek_date}T00:00:00`); d <= end; d.setDate(d.getDate() + 1)) {
        const key = toISO(d);
        map.set(key, (map.get(key) ?? 0) + 1);
      }
    }
    return map;
  };

  // Two tallies while a route is picked: its days stay lit and clickable,
  // days belonging only to other routes stay visible but dimmed and inert.
  const { countByDay, mutedByDay } = useMemo(() => {
    if (locationId === ALL) {
      return { countByDay: tally(windowRows), mutedByDay: new Map() as DayTally };
    }
    const picked = Number(locationId);
    return {
      countByDay: tally(windowRows.filter(r => r.location_id === picked)),
      mutedByDay: tally(windowRows.filter(r => r.location_id !== picked)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [windowRows, locationId]);

  const filters: CrudFilter[] = [];
  if (locationId !== ALL) filters.push({ field: 'location_id', operator: 'eq', value: Number(locationId) });
  if (status !== ALL) filters.push({ field: 'status', operator: 'eq', value: status });
  // A day narrows to the climbs setting off that day. Not the ones passing
  // through it: staff work by departure, and "who leaves on the 26th" is the
  // question the calendar is being asked.
  if (selectedDay) filters.push({ field: 'trek_date', operator: 'eq', value: selectedDay });

  const columns = [
    col.accessor('full_name', {
      header: 'Họ tên',
      cell: info => (
        <button
          type="button"
          onClick={() => setOpenId(info.row.original.id)}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {info.getValue()}
        </button>
      ),
    }),
    col.accessor('phone', { header: 'SĐT' }),
    col.display({
      id: 'location',
      header: 'Cung',
      cell: info => info.row.original.locations?.name ?? '—',
    }),
    col.display({
      id: 'tour_dates',
      header: 'Ngày leo',
      cell: info =>
        trekRange(
          info.row.original.trek_date,
          info.row.original.locations?.default_trek_days ?? null,
        ),
    }),
    col.accessor('status', {
      header: 'Trạng thái',
      cell: info => {
        const id = info.row.original.id;
        return (
          <StatusSelect
            value={info.getValue()}
            onChange={next => {
              update({ resource: 'bookings', id, values: { status: next } });
              // This status is only half-entered without a note saying what to
              // check, so picking it opens the booking on the note field
              // rather than leaving the customer a bare "something is wrong".
              if (next === NEEDS_CONTACT) setOpenId(id);
            }}
          />
        );
      },
    }),
    col.accessor('created_at', {
      header: 'Ngày đặt',
      cell: info => formatDate(info.getValue()),
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: {
      resource: 'bookings',
      meta: { select: SELECT_WITH_ROUTE },
      filters: { permanent: filters },
      sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
      pagination: { pageSize: 30 },
    },
    // These columns have not been checked against what PostgREST can order by,
    // so the headers stay plain rather than offering a sort that may 400.
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const { pageCount, currentPage, setCurrentPage } = table.refineCore;

  // Read the open booking back out of the list instead of snapshotting it, so
  // a status change made from the table is reflected inside the modal.
  const rows = (table.refineCore.tableQuery.data?.data ?? []) as Booking[];
  const openBooking = rows.find(b => b.id === openId) ?? null;

  // Filtering can land the user past the end of the shorter result set.
  const resetPage = () => setCurrentPage(1);

  /**
   * Every booking the filters currently select, not just the page on screen —
   * the table shows 30 at a time, and a file holding only those would be a
   * quiet lie about what was exported. Fetched in batches because PostgREST
   * caps a single response well below what a busy season holds.
   */
  const fetchFilteredBookings = async (): Promise<ExportableBooking[]> => {
    const getList = dataProvider().getList;
    const pageSize = 500;
    const all: ExportableBooking[] = [];

    for (let page = 1; ; page++) {
      const { data, total } = await getList<Booking>({
        resource: 'bookings',
        filters,
        sorters: [{ field: 'created_at', order: 'desc' }],
        pagination: { currentPage: page, pageSize },
        meta: { select: SELECT_WITH_ROUTE },
      });

      all.push(...data);
      if (data.length < pageSize || all.length >= (total ?? all.length)) break;
    }

    return all;
  };

  /**
   * What the filters add up to, in words — the sheet's title when its rows
   * span more than one departure and so cannot name a single one.
   */
  const exportTitle = () => {
    const parts = [
      locationId === ALL ? 'Tất cả cung' : locations.find(l => String(l.id) === locationId)?.name,
      status === ALL ? null : STATUS_LABEL[status],
    ];
    return parts.filter(Boolean).join(' · ');
  };

  /** `bookings-phu-sa-phin-cho-xac-nhan-2026-08-27.xlsx` */
  const exportFileName = () => {
    const parts = [
      'bookings',
      locationId === ALL ? null : locations.find(l => String(l.id) === locationId)?.name,
      selectedDay,
      status === ALL ? null : STATUS_LABEL[status],
      new Date().toISOString().slice(0, 10),
    ];
    return `${parts.filter(Boolean).map(part => slugify(String(part))).join('-')}.xlsx`;
  };

  const handleExport = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const bookings = await fetchFilteredBookings();
      if (bookings.length === 0) {
        setExportError('Không có booking nào khớp bộ lọc hiện tại.');
        return;
      }
      await writeBookingsXlsx({
        bookings,
        fileName: exportFileName(),
        fallbackTitle: exportTitle(),
        trekRange,
      });
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-full items-stretch">
      <BookingCalendar
        months={months}
        todayISO={todayISO}
        countByDay={countByDay}
        mutedByDay={mutedByDay}
        selectedDay={selectedDay}
        loading={calendarLoading}
        onSelect={day => { setSelectedDay(day); resetPage(); }}
        onShift={by => setAnchor(a => new Date(a.getFullYear(), a.getMonth() + by, 1))}
        onToday={() => {
          const now = new Date();
          setAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
          setSelectedDay(toISO(now));
          resetPage();
        }}
      />

      <div className="min-w-0 flex-1 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold">📋 Bookings</h2>
          <div className="flex flex-wrap gap-2">
            <SimpleSelect
              ariaLabel="Lọc theo cung"
              value={locationId}
              onValueChange={next => { setLocationId(next); resetPage(); }}
              options={[
                { value: ALL, label: 'Tất cả cung' },
                ...locations.map(l => ({ value: String(l.id), label: l.name })),
              ]}
            />
            <SimpleSelect
              ariaLabel="Lọc theo trạng thái"
              value={status}
              onValueChange={next => { setStatus(next); resetPage(); }}
              options={[
                { value: ALL, label: 'Tất cả trạng thái' },
                ...STATUS_ITEMS,
              ]}
            />
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Spinner /> : <Download size={15} strokeWidth={1.75} />}
              Xuất Excel
            </Button>
          </div>
        </div>

        {exportError && (
          <p className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{exportError}</p>
        )}

        <DataTable table={table} emptyText="Chưa có booking nào." />

        <div className="flex gap-2 mt-4 items-center">
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
          <span className="text-sm text-muted-foreground">Trang {currentPage} / {pageCount}</span>
          <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount}>→</Button>
        </div>
      </div>

      <Modal
        open={Boolean(openBooking)}
        onClose={() => setOpenId(null)}
        title={openBooking?.full_name ?? ''}
        description={openBooking ? `Booking #${openBooking.id}` : undefined}
      >
        {openBooking ? <BookingDetails booking={openBooking} /> : null}
      </Modal>
    </div>
  );
}

/**
 * The badge *is* the control: the status pill wearing its own tonal styling,
 * so the row reads at a glance and still edits in place without a second
 * column repeating the same value.
 *
 * Built on the panel's own select rather than a native one — a native `select`
 * drops the operating system's list on the page, which matches nothing else
 * here, and takes its width from the longest option so every pill was as wide
 * as "Cần xác nhận lại liên hệ".
 */
function StatusSelect({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <Select value={value} onValueChange={next => onChange(String(next))} items={STATUS_ITEMS}>
      <SelectTrigger
        aria-label="Trạng thái"
        className={cn(
          badgeVariants({ variant: statusVariant(value) }),
          'h-8 cursor-pointer gap-1 rounded-full px-3 pr-2.5 text-sm',
          // The chevron is the only sign the pill can be changed at all, so it
          // takes the pill's own colour instead of the default muted grey.
          '[&_svg]:size-3.5! [&_svg]:text-current [&_svg]:opacity-60',
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_ITEMS.map(({ value: option, label }) => (
          <SelectItem key={option} value={option}>
            {/* The list shows the same pills the table does, so picking one is
                choosing the thing you will see in the row afterwards. */}
            <Badge variant={statusVariant(option)}>{label}</Badge>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Three months of climbs, as the way into the list beside it.
 *
 * Staff work by departure day — "who is on the hill on the 26th" — which the
 * old list of departures answered for them. With customers naming their own
 * dates there is no such list, so the calendar builds one: a day is lit when
 * somebody is out on it, and clicking it narrows the table to that departure.
 *
 * Same width as the app's nav so the two read as one rail down the left.
 */
function BookingCalendar({
  months,
  todayISO,
  countByDay,
  mutedByDay,
  selectedDay,
  loading,
  onSelect,
  onShift,
  onToday,
}: {
  months: Date[];
  todayISO: string;
  countByDay: DayTally;
  mutedByDay: DayTally;
  selectedDay: string | null;
  loading: boolean;
  onSelect: (day: string | null) => void;
  onShift: (by: number) => void;
  onToday: () => void;
}) {
  return (
    // Sticky rather than scrolling with the page: the calendar is what the
    // table is being read against, so it should stay put.
    <aside className="sticky top-0 flex max-h-screen w-64 shrink-0 flex-col self-start overflow-y-auto border-r border-border p-3">
      <div className="mb-3 flex items-center justify-between gap-1">
        <Button variant="outline" size="sm" title="3 tháng trước" onClick={() => onShift(-3)}>←</Button>
        <span className="text-xs font-semibold">
          T{months[0].getMonth() + 1}/{months[0].getFullYear()} – T{months[2].getMonth() + 1}/{months[2].getFullYear()}
          {loading && <Spinner className="ml-2 inline-block size-3" />}
        </span>
        <Button variant="outline" size="sm" title="3 tháng sau" onClick={() => onShift(3)}>→</Button>
      </div>

      <div className="mb-3 flex gap-2">
        <Button variant="ghost" size="sm" className="flex-1" onClick={onToday}>Hôm nay</Button>
        {selectedDay && (
          <Button variant="ghost" size="sm" className="flex-1" onClick={() => onSelect(null)}>
            Bỏ lọc ngày
          </Button>
        )}
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
                // Only reachable when the picked route has nobody out that day:
                // a day belonging to other routes is shown, but leads nowhere.
                const muted = count === 0 ? (mutedByDay.get(key) ?? 0) : 0;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={muted > 0}
                    onClick={() => onSelect(selectedDay === key ? null : key)}
                    title={
                      count ? `${count} đăng ký` : muted ? `${muted} đăng ký của cung khác` : undefined
                    }
                    className={cn(
                      'relative aspect-square rounded-md text-xs transition-colors',
                      count > 0 && 'bg-primary/15 font-semibold text-primary hover:bg-primary/25',
                      muted > 0 && 'cursor-not-allowed bg-muted/60 text-muted-foreground/60 saturate-0',
                      count === 0 && muted === 0 && 'text-foreground/70 hover:bg-muted',
                      selectedDay === key && 'ring-2 ring-primary',
                      todayISO === key && selectedDay !== key && 'ring-1 ring-border',
                    )}
                  >
                    {d.getDate()}
                    {count > 1 && (
                      <span className="absolute top-0.5 right-0.5 text-[9px] leading-none font-bold">
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
    </aside>
  );
}

function BookingDetails({ booking }: { booking: Booking }) {
  const rows: [string, ReactNode][] = [
    ['Trạng thái', <Badge variant={statusVariant(booking.status)}>{STATUS_LABEL[booking.status]}</Badge>],
    ['Số điện thoại', booking.phone || '—'],
    ['Email', booking.email || '—'],
    ['Cung', booking.locations?.name ?? '—'],
    ['Ngày leo', trekRange(booking.trek_date, booking.locations?.default_trek_days ?? null)],
    ['Tên HCV', booking.medal_name || '—'],
    ['Ngày sinh', formatDate(booking.dob)],
    ['CCCD/CMND', booking.citizen_id || '—'],
    ['SĐT người thân', booking.emergency_phone || '—'],
    ['Ngày đặt', formatDateTime(booking.created_at)],
  ];

  return (
    <div className="text-sm">
      <dl className="divide-y divide-border">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[9rem_1fr] gap-3 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium break-words">{value}</dd>
          </div>
        ))}
      </dl>
      <StatusNoteEditor booking={booking} />

      <div className="mt-4">
        <p className="text-muted-foreground mb-1">Ghi chú của khách</p>
        <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">
          {booking.note?.trim() || '—'}
        </p>
      </div>
    </div>
  );
}

/**
 * The note the customer sees under their booking status.
 *
 * Shown while the booking asks the customer to do something, and also whenever
 * a note is already stored — otherwise moving the booking to another status
 * would hide a message that is still on the customer's screen.
 */
function StatusNoteEditor({ booking }: { booking: Booking }) {
  const { mutate: update } = useUpdate();
  const [draft, setDraft] = useState(booking.status_note ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reset when the modal moves to another booking: this component is not
  // remounted between them.
  useEffect(() => {
    setDraft(booking.status_note ?? '');
    setSaved(false);
  }, [booking.id, booking.status_note]);

  if (booking.status !== NEEDS_CONTACT && !booking.status_note?.trim()) return null;

  const dirty = draft !== (booking.status_note ?? '');

  return (
    <div className="mt-4 rounded-md border border-sky-500/40 bg-sky-500/5 p-3">
      <p className="font-medium">Ghi chú gửi khách</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        Khách sẽ đọc được dòng này ngay dưới trạng thái, ở màn “Tour đã đặt”.
        Ghi rõ cần kiểm tra lại gì — ví dụ số điện thoại sai một chữ số.
      </p>
      <textarea
        value={draft}
        onChange={e => { setDraft(e.target.value); setSaved(false); }}
        rows={3}
        placeholder="VD: Số 09xx xxx xxx gọi không liên lạc được, bạn kiểm tra lại giúp bọn mình nhé."
        className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm"
      />
      <div className="mt-2 flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || saving}
          onClick={() => {
            setSaving(true);
            update(
              { resource: 'bookings', id: booking.id, values: { status_note: draft.trim() } },
              { onSuccess: () => setSaved(true), onSettled: () => setSaving(false) },
            );
          }}
        >
          {saving ? <Spinner /> : 'Lưu ghi chú'}
        </Button>
        {saved && !dirty && <span className="text-xs text-emerald-600">Đã lưu</span>}
      </div>
    </div>
  );
}
