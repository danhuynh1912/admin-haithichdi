import { useTable } from '@refinedev/react-table';
import { useDelete, useNavigation, useUpdate } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { resolveMediaUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface Location {
  id: number;
  name: string;
  elevation_m: number;
  image_path: string | null;
  image_url: string;
  home_feature_order: number | null;
  is_active: boolean;
}

const col = createColumnHelper<Location>();

export function LocationList() {
  const { edit, create } = useNavigation();
  const { mutate: del } = useDelete();
  const { mutate: update } = useUpdate();

  const columns = [
    col.accessor('id', { header: 'ID', size: 60 }),
    col.display({
      id: 'img', header: 'Ảnh', size: 70,
      cell: info => {
        const row = info.row.original;
        const url = resolveMediaUrl(row.image_path, row.image_url);
        return url ? <img src={url} alt="" className="w-14 h-9 object-cover rounded" /> : <span className="text-muted-foreground">—</span>;
      },
    }),
    col.accessor('name', { header: 'Tên' }),
    col.accessor('elevation_m', { header: 'Độ cao (m)', size: 110 }),
    col.accessor('home_feature_order', { header: 'Thứ tự', size: 80 }),
    col.accessor('is_active', {
      header: 'Hiện',
      size: 90,
      // Toggling here writes only this column, so a route's tours keep their
      // own is_active — hiding is a filter on the public side, not a mass edit.
      cell: info => {
        const row = info.row.original;
        const shown = info.getValue() !== false;
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={shown}
              ariaLabel={shown ? `Ẩn cung ${row.name}` : `Hiện cung ${row.name}`}
              onCheckedChange={next => {
                if (!next && !confirm(`Ẩn cung “${row.name}”?\n\nCung này và mọi tour thuộc nó sẽ không còn hiện trên web. Không xoá gì cả — bật lại là về như cũ.`)) return;
                update({ resource: 'locations', id: row.id, values: { is_active: next } });
              }}
            />
            <span className={shown ? 'text-xs text-muted-foreground' : 'text-xs font-medium text-amber-600'}>
              {shown ? 'Hiện' : 'Đang ẩn'}
            </span>
          </div>
        );
      },
    }),
    col.display({
      id: 'actions', header: '',
      cell: info => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => edit('locations', info.row.original.id)}>Sửa</Button>
          <Button variant="destructive" size="sm" onClick={() => { if (confirm('Xóa location này?')) del({ resource: 'locations', id: info.row.original.id }); }}>Xóa</Button>
        </div>
      ),
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: {
      resource: 'locations',
      sorters: { initial: [{ field: 'name', order: 'asc' }] },
      pagination: { pageSize: 20 },
    },
    // These columns have not been checked against what PostgREST can order by,
    // so the headers stay plain rather than offering a sort that may 400.
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">📍 Locations</h2>
        <Button onClick={() => create('locations')}>+ Thêm Location</Button>
      </div>
      <DataTable table={table} emptyText="Chưa có location nào." />
      <Pagination table={table} unit="cung" />
    </div>
  );
}
