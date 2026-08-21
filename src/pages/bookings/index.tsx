import { useEffect, useState, type ReactNode } from 'react';
import { useTable } from '@refinedev/react-table';
import { useList, useUpdate, type CrudFilter } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Modal } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/SimpleSelect';
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
    location_id: number;
    locations: { id: number; name: string } | null;
  } | null;
}

interface LocationOption {
  id: number;
  name: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  needs_contact_check: 'Cần xác nhận lại liên hệ',
  cancelled: 'Đã hủy',
};

/** The one status that carries a note the customer is meant to act on. */
const NEEDS_CONTACT = 'needs_contact_check';

// `tours!inner` is what makes the `tours.location_id` filter narrow the
// bookings themselves rather than just blanking out the embed.
const SELECT_WITH_TOUR = '*, tours!inner(id, title, location_id, locations(id, name))';

/** "No filter" as a real value — a blank one reads as nothing chosen. */
const ALL = 'all';

const statusVariant = (s: string) =>
  s === 'confirmed' ? 'success'
  : s === 'pending' ? 'warning'
  : s === NEEDS_CONTACT ? 'info'
  : 'destructive';

const col = createColumnHelper<Booking>();

export function BookingList() {
  const { mutate: update } = useUpdate<Booking>();
  const [locationId, setLocationId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [openId, setOpenId] = useState<number | null>(null);

  const { query: locationsQuery } = useList<LocationOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
  });
  const locations = locationsQuery?.data?.data ?? [];

  const filters: CrudFilter[] = [];
  if (locationId !== ALL) filters.push({ field: 'tours.location_id', operator: 'eq', value: Number(locationId) });
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
    col.accessor('status', {
      header: 'Trạng thái',
      // The badge *is* the control: a native select wearing the badge's own
      // tonal styling, so the row reads at a glance and still edits in place
      // without a second column repeating the same value.
      cell: info => {
        const id = info.row.original.id;
        return (
          <select
            value={info.getValue()}
            onChange={e => {
              const next = e.target.value;
              update({ resource: 'bookings', id, values: { status: next } });
              // This status is only half-entered without a note saying what to
              // check, so picking it opens the booking on the note field
              // rather than leaving the customer a bare "something is wrong".
              if (next === NEEDS_CONTACT) setOpenId(id);
            }}
            className={cn(
              badgeVariants({ variant: statusVariant(info.getValue()) }),
              'h-8 cursor-pointer appearance-none rounded-full px-3.5 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            )}
          >
            {Object.entries(STATUS_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
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

  return (
    <div className="p-6">
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
              ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
      </div>

      <DataTable table={table} emptyText="Chưa có booking nào." />

      <div className="flex gap-2 mt-4 items-center">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
        <span className="text-sm text-muted-foreground">Trang {currentPage} / {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount}>→</Button>
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
