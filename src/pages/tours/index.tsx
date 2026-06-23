import { useTable } from '@refinedev/react-table';
import { useDelete, useNavigation } from '@refinedev/core';
import { createColumnHelper, flexRender, getCoreRowModel } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Tour {
  id: number;
  title: string;
  start_date: string | null;
  end_date: string | null;
  price: string | null;
  max_guests: number;
  is_active: boolean;
  location_id: number;
}

const col = createColumnHelper<Tour>();

export function TourList() {
  const { edit, create } = useNavigation();
  const { mutate: del } = useDelete();

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
    refineCoreProps: { resource: 'tours', sorters: { initial: [{ field: 'created_at', order: 'desc' }] }, pagination: { pageSize: 30 } },
    getCoreRowModel: getCoreRowModel(),
  });

  const { pageCount, currentPage, setCurrentPage } = table.refineCore;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">🏔️ Tours</h2>
        <Button onClick={() => create('tours')}>+ Thêm Tour</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.reactTable.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-muted/50">
                {hg.headers.map(h => (
                  <th key={h.id} className="px-4 py-3 text-left font-semibold text-muted-foreground">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.reactTable.getRowModel().rows.map(row => (
              <tr key={row.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2 mt-4 items-center">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
        <span className="text-sm text-muted-foreground">Trang {currentPage} / {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount}>→</Button>
      </div>
    </div>
  );
}
