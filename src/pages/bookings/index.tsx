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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
  note: string;
  created_at: string;
  tour_id: number;
  // Embedded by `SELECT_WITH_TOUR` below — a booking always has a tour, but
  // PostgREST types the embed as nullable, so guard when reading it.
  tours: {
    id: number;
    title: string;
    start_date: string | null;
    end_date: string | null;
    location_id: number;
    locations: { id: number; name: string } | null;
  } | null;
}

interface LocationOption {
  id: number;
  name: string;
}

/** A tour that at least one booking points at — what the tour rail lists. */
interface TourOption {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
}

interface TourWithCount extends TourOption {
  /** How many bookings point at this tour, ignoring the status filter. */
  count: number;
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

// `tours!inner` is what makes the `tours.location_id` filter narrow the
// bookings themselves rather than just blanking out the embed.
const SELECT_WITH_TOUR = '*, tours!inner(id, title, start_date, end_date, location_id, locations(id, name))';

// Just enough of a booking to learn which tours are worth offering as filters.
const SELECT_TOUR_ONLY = 'tour_id, tours!inner(id, title, start_date, end_date, location_id)';

/** "No filter" as a real value — a blank one reads as nothing chosen. */
const ALL = 'all';

const statusVariant = (s: string) =>
  s === 'confirmed' ? 'success'
  : s === 'pending' ? 'warning'
  : s === NEEDS_CONTACT ? 'info'
  : 'destructive';

/**
 * A departure as the days it runs: `26–27/08/2026` for the usual two-day trek,
 * `30/08 – 01/09/2026` when it crosses a month, one plain date for a day trip.
 * The shared month and year are written once — the pair of days is the part
 * being read.
 */
function tourDates(start: string | null | undefined, end: string | null | undefined): string {
  if (!start) return '—';
  const from = new Date(start);
  const to = end ? new Date(end) : from;
  if (Number.isNaN(from.valueOf()) || Number.isNaN(to.valueOf())) return formatDate(start);
  if (start === end || !end) return formatDate(start);

  const sameYear = from.getFullYear() === to.getFullYear();
  const sameMonth = sameYear && from.getMonth() === to.getMonth();
  const day = (d: Date) => String(d.getDate()).padStart(2, '0');
  const dayMonth = (d: Date) => `${day(d)}/${String(d.getMonth() + 1).padStart(2, '0')}`;

  if (sameMonth) return `${day(from)}–${formatDate(end)}`;
  if (sameYear) return `${dayMonth(from)} – ${formatDate(end)}`;
  return `${formatDate(start)} – ${formatDate(end)}`;
}

const col = createColumnHelper<Booking>();

export function BookingList() {
  const { mutate: update } = useUpdate<Booking>();
  const dataProvider = useDataProvider();
  const [locationId, setLocationId] = useState(ALL);
  const [tourId, setTourId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [openId, setOpenId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { query: locationsQuery } = useList<LocationOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
  });
  const locations = locationsQuery?.data?.data ?? [];

  // The tour list is drawn from the bookings themselves, not from `tours`:
  // departures are generated in bulk months ahead, so a plain tour list would
  // be hundreds of options where all but a few match nothing. Deliberately not
  // narrowed by `status` — filtering by status must not make a tour disappear
  // from the picker while it is the one selected.
  const { query: bookedToursQuery } = useList<{ tour_id: number; tours: TourOption | null }>({
    resource: 'bookings',
    pagination: { pageSize: 1000 },
    filters:
      locationId === ALL
        ? []
        : [{ field: 'tours.location_id', operator: 'eq', value: Number(locationId) }],
    meta: { select: SELECT_TOUR_ONLY },
  });

  const tours = useMemo(() => {
    const byId = new Map<number, TourWithCount>();
    for (const row of bookedToursQuery?.data?.data ?? []) {
      if (!row.tours) continue;
      const seen = byId.get(row.tours.id);
      if (seen) seen.count += 1;
      else byId.set(row.tours.id, { ...row.tours, count: 1 });
    }
    // Newest departures first: those are the ones still being worked on.
    return [...byId.values()].sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''));
  }, [bookedToursQuery?.data?.data]);

  const filters: CrudFilter[] = [];
  if (locationId !== ALL) filters.push({ field: 'tours.location_id', operator: 'eq', value: Number(locationId) });
  if (tourId !== ALL) filters.push({ field: 'tour_id', operator: 'eq', value: Number(tourId) });
  if (status !== ALL) filters.push({ field: 'status', operator: 'eq', value: status });

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
      cell: info => info.row.original.tours?.locations?.name ?? '—',
    }),
    col.display({
      id: 'tour_dates',
      header: 'Ngày đi',
      cell: info => tourDates(info.row.original.tours?.start_date, info.row.original.tours?.end_date),
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
      meta: { select: SELECT_WITH_TOUR },
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
        meta: { select: SELECT_WITH_TOUR },
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
    const tour = tours.find(t => String(t.id) === tourId);
    const parts = [
      'bookings',
      // The cung is already in the tour's own title, so naming both just makes
      // the file name twice as long as it needs to be.
      tour
        ? `${tour.title} ${tourDates(tour.start_date, tour.end_date)}`
        : locationId === ALL ? null : locations.find(l => String(l.id) === locationId)?.name,
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
        tourDates,
      });
    } catch (e) {
      setExportError((e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex min-h-full items-stretch">
      <TourRail
        tours={tours}
        loading={bookedToursQuery?.isLoading ?? false}
        selected={tourId}
        onSelect={next => { setTourId(next); resetPage(); }}
      />

      <div className="min-w-0 flex-1 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 className="text-xl font-bold">📋 Bookings</h2>
          <div className="flex flex-wrap gap-2">
            <SimpleSelect
              ariaLabel="Lọc theo cung"
              value={locationId}
              onValueChange={next => {
                setLocationId(next);
                // The chosen tour likely belongs to the cung being left behind,
                // which would leave the table showing nothing.
                setTourId(ALL);
                resetPage();
              }}
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
 * The tours people have actually signed up for, as a column of their own.
 *
 * Same width as the app's nav so the two read as one rail down the left, and
 * a departure is one click rather than a trip through a dropdown — the counts
 * are the point as much as the filtering is: staff want to see, at a glance,
 * which departure is filling up.
 */
function TourRail({
  tours,
  loading,
  selected,
  onSelect,
}: {
  tours: TourWithCount[];
  loading: boolean;
  selected: string;
  onSelect: (value: string) => void;
}) {
  const total = tours.reduce((sum, t) => sum + t.count, 0);

  return (
    // Sticky rather than scrolling with the page: the list of departures is
    // what the table is being read against, so it should stay put.
    <aside className="sticky top-0 flex max-h-screen w-56 shrink-0 flex-col self-start overflow-y-auto border-r border-border p-3">
      <p className="px-2 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Tour có khách đặt
      </p>

      {loading ? (
        <div className="px-2 py-3"><Spinner /></div>
      ) : (
        <div className="flex flex-col gap-0.5">
          <TourRailItem
            label="Tất cả tour"
            count={total}
            active={selected === ALL}
            onClick={() => onSelect(ALL)}
          />
          {tours.map(t => (
            <TourRailItem
              key={t.id}
              label={t.title}
              // The rail is narrow enough that longer titles are cut off, so
              // hovering has to be able to give the whole name back.
              tooltip={`${t.title} — ${tourDates(t.start_date, t.end_date)}`}
              detail={tourDates(t.start_date, t.end_date)}
              count={t.count}
              active={selected === String(t.id)}
              onClick={() => onSelect(String(t.id))}
            />
          ))}
          {tours.length === 0 && (
            <p className="px-2 py-2 text-sm text-muted-foreground">Chưa có tour nào có khách đặt.</p>
          )}
        </div>
      )}
    </aside>
  );
}

function TourRailItem({
  label,
  tooltip,
  detail,
  count,
  active,
  onClick,
}: {
  label: string;
  tooltip?: string;
  detail?: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip disabled={!tooltip}>
      <TooltipTrigger
        type="button"
        // Shorter than the 600ms default: the whole point is reading a name the
        // rail cut off, and at that delay you have moved on before it appears.
        delay={250}
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
          'focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          active
            // Tonal, not the nav's solid fill: this picks a row *within* the
            // screen and should not read as loudly as which screen you are on.
            ? 'bg-primary/10 font-semibold text-primary'
            : 'text-foreground/70 hover:bg-muted',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate">{label}</span>
          {detail && (
            <span className={cn('block text-xs', active ? 'text-primary/70' : 'text-muted-foreground')}>
              {detail}
            </span>
          )}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-1.5 py-0.5 text-xs tabular-nums',
            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      </TooltipTrigger>
      {/* To the right, over the table: above would cover the neighbouring rows. */}
      <TooltipContent side="right">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

function BookingDetails({ booking }: { booking: Booking }) {
  const rows: [string, ReactNode][] = [
    ['Trạng thái', <Badge variant={statusVariant(booking.status)}>{STATUS_LABEL[booking.status]}</Badge>],
    ['Số điện thoại', booking.phone || '—'],
    ['Email', booking.email || '—'],
    ['Cung', booking.tours?.locations?.name ?? '—'],
    ['Tour', booking.tours?.title ?? `#${booking.tour_id}`],
    ['Tên HCV', booking.medal_name || '—'],
    ['Ngày sinh', formatDate(booking.dob)],
    ['CCCD/CMND', booking.citizen_id || '—'],
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
