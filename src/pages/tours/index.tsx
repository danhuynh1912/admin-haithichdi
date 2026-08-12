import { useEffect, useState } from 'react';
import { useTable } from '@refinedev/react-table';
import { useDelete, useList, useNavigation, type CrudFilter } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { X } from 'lucide-react';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Tour {
  id: number;
  title: string;
  title_en: string | null;
  summary_en: string | null;
  start_date: string | null;
  end_date: string | null;
  price: string | null;
  max_guests: number;
  is_active: boolean;
  location_id: number;
}

interface RouteOption {
  id: number;
  name: string;
}

/** Today as `YYYY-MM-DD`, which is how a `date` column compares in PostgREST. */
const today = () => new Date().toISOString().slice(0, 10);

const PERIOD_LABEL = {
  upcoming: 'Sắp khởi hành',
  ongoing: 'Đang diễn ra',
  past: 'Đã kết thúc',
  undated: 'Chưa có ngày',
} as const;

const I18N_LABEL = {
  done: 'Đã dịch xong',
  todo: 'Còn thiếu bản dịch',
} as const;

/** Waits for typing to stop before it becomes a query. */
function useDebounced<T>(value: T, ms = 300) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

const col = createColumnHelper<Tour>();

export function TourList() {
  const { edit, create } = useNavigation();
  const { mutate: del } = useDelete();

  const [search, setSearch] = useState('');
  const [routeId, setRouteId] = useState('');
  const [active, setActive] = useState('');
  const [period, setPeriod] = useState('');
  const [i18n, setI18n] = useState('');
  const query = useDebounced(search.trim());

  const { query: routesQuery } = useList<RouteOption>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
    meta: { select: 'id, name' },
  });
  const routes = routesQuery?.data?.data ?? [];

  const filters: CrudFilter[] = [];
  if (query) {
    // Both titles, so an English name someone searches for still finds its tour.
    filters.push({
      operator: 'or',
      value: [
        { field: 'title', operator: 'contains', value: query },
        { field: 'title_en', operator: 'contains', value: query },
      ],
    });
  }
  if (routeId) filters.push({ field: 'location_id', operator: 'eq', value: Number(routeId) });
  if (active) filters.push({ field: 'is_active', operator: 'eq', value: active === 'on' });

  // Departures are the reason this list gets long, so the date window is the
  // filter that actually shortens it. `end_date` decides "past" rather than
  // `start_date`: a trip that left yesterday and returns tomorrow is running,
  // not finished.
  if (period === 'upcoming') filters.push({ field: 'start_date', operator: 'gte', value: today() });
  if (period === 'ongoing') {
    filters.push({ field: 'start_date', operator: 'lte', value: today() });
    filters.push({ field: 'end_date', operator: 'gte', value: today() });
  }
  if (period === 'past') filters.push({ field: 'end_date', operator: 'lt', value: today() });
  if (period === 'undated') filters.push({ field: 'start_date', operator: 'null', value: true });

  // Matches what the EN column shows: both fields filled counts as translated,
  // so "còn thiếu" is either one of them still empty.
  if (i18n === 'done') {
    filters.push({ field: 'title_en', operator: 'ne', value: '' });
    filters.push({ field: 'summary_en', operator: 'ne', value: '' });
  }
  if (i18n === 'todo') {
    filters.push({
      operator: 'or',
      value: [
        { field: 'title_en', operator: 'eq', value: '' },
        { field: 'summary_en', operator: 'eq', value: '' },
      ],
    });
  }

  const columns = [
    col.accessor('id', { header: 'ID', size: 60 }),
    col.accessor('title', { header: 'Tên tour' }),
    col.accessor('start_date', { header: 'Ngày đi', cell: i => i.getValue() ?? '—' }),
    col.accessor('end_date', { header: 'Ngày về', cell: i => i.getValue() ?? '—' }),
    col.accessor('price', { header: 'Giá', cell: i => i.getValue() ? Number(i.getValue()).toLocaleString('vi-VN') + '₫' : '—' }),
    col.accessor('max_guests', { header: 'Slot', size: 70 }),
    col.accessor('is_active', {
      header: 'Active', size: 80,
      cell: i => <Badge variant={i.getValue() ? 'success' : 'secondary'}>{i.getValue() ? 'ON' : 'OFF'}</Badge>,
    }),
    // Flags the two fields that actually matter for an English visitor: the
    // title (SEO + every list) and the summary (under the h1 on the booking
    // page). Long-form markdown is deliberately not counted here.
    col.display({
      id: 'i18n', header: 'EN', size: 90,
      cell: info => {
        const { title_en, summary_en } = info.row.original;
        const done = Boolean(title_en?.trim()) && Boolean(summary_en?.trim());
        const partial = Boolean(title_en?.trim()) || Boolean(summary_en?.trim());
        return (
          <Badge variant={done ? 'success' : 'secondary'}>
            {done ? 'Đã dịch' : partial ? 'Thiếu' : 'Chưa dịch'}
          </Badge>
        );
      },
    }),
    col.display({
      id: 'actions', header: '',
      cell: info => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => edit('tours', info.row.original.id)}>Sửa</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm('Xóa tour này?')) del({ resource: 'tours', id: info.row.original.id }); }}>Xóa</Button>
        </div>
      ),
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: {
      resource: 'tours',
      filters: { permanent: filters },
      sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
      pagination: { pageSize: 30 },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const { pageCount, currentPage, setCurrentPage, tableQuery } = table.refineCore;
  const total = tableQuery.data?.total ?? 0;
  const filtering = filters.length > 0;

  // Narrowing usually leaves fewer pages than the one being viewed, and page 4
  // of a 1-page result reads as "no tours" rather than as a stale page number.
  const onFilter = (set: (value: string) => void) => (value: string) => {
    set(value);
    setCurrentPage(1);
  };

  const reset = () => {
    setSearch('');
    setRouteId('');
    setActive('');
    setPeriod('');
    setI18n('');
    setCurrentPage(1);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🏔️ Tours</h2>
        <Button onClick={() => create('tours')}>+ Thêm Tour</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Input
          value={search}
          onChange={e => onFilter(setSearch)(e.target.value)}
          placeholder="Tìm theo tên tour…"
          aria-label="Tìm theo tên tour"
          className="w-56"
        />
        <Select
          aria-label="Lọc theo cung"
          value={routeId}
          onChange={e => onFilter(setRouteId)(e.target.value)}
        >
          <option value="">Tất cả cung</option>
          {routes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
        <Select
          aria-label="Lọc theo thời gian"
          value={period}
          onChange={e => onFilter(setPeriod)(e.target.value)}
        >
          <option value="">Mọi thời điểm</option>
          {Object.entries(PERIOD_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
        <Select
          aria-label="Lọc theo trạng thái"
          value={active}
          onChange={e => onFilter(setActive)(e.target.value)}
        >
          <option value="">Bật và tắt</option>
          <option value="on">Đang bật</option>
          <option value="off">Đã tắt</option>
        </Select>
        <Select
          aria-label="Lọc theo tình trạng dịch"
          value={i18n}
          onChange={e => onFilter(setI18n)(e.target.value)}
        >
          <option value="">Mọi bản dịch</option>
          {Object.entries(I18N_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>

        {filtering && (
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="size-4" /> Xoá lọc
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">
          {filtering ? `${total} tour khớp` : `${total} tour`}
        </span>
      </div>

      <DataTable
        table={table}
        emptyText={filtering ? 'Không có tour nào khớp bộ lọc.' : 'Chưa có tour nào.'}
      />

      <div className="flex gap-2 mt-4 items-center">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
        <span className="text-sm text-muted-foreground">Trang {currentPage} / {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount}>→</Button>
      </div>
    </div>
  );
}
