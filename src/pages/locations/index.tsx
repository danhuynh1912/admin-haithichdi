import { useTable } from '@refinedev/react-table';
import { useDelete, useNavigation } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { resolveMediaUrl } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

interface Location {
  id: number;
  name: string;
  elevation_m: number;
  image_path: string | null;
  image_url: string;
  home_feature_order: number | null;
  home_display_name: string;
}

const col = createColumnHelper<Location>();

export function LocationList() {
  const { edit, create } = useNavigation();
  const { mutate: del } = useDelete();

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
    col.accessor('home_display_name', { header: 'Tên trang chủ' }),
    col.accessor('home_feature_order', { header: 'Thứ tự', size: 80 }),
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
    refineCoreProps: { resource: 'locations', sorters: { initial: [{ field: 'name', order: 'asc' }] } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">📍 Locations</h2>
        <Button onClick={() => create('locations')}>+ Thêm Location</Button>
      </div>
      <DataTable table={table} emptyText="Chưa có location nào." />
    </div>
  );
}
