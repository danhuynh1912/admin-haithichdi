import { useTable } from '@refinedev/react-table';
import { useUpdate } from '@refinedev/core';
import { createColumnHelper, flexRender, getCoreRowModel } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Booking {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  medal_name: string | null;
  dob: string | null;
  citizen_id: string | null;
  note: string;
  created_at: string;
  tour_id: number;
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
};

const selectCls = "flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const col = createColumnHelper<Booking>();

export function BookingList() {
  const { mutate: update } = useUpdate<Booking>();

  const columns = [
    col.accessor('id', { header: 'ID', size: 60 }),
    col.accessor('full_name', { header: 'Họ tên' }),
    col.accessor('phone', { header: 'SĐT' }),
    col.accessor('email', { header: 'Email' }),
    col.accessor('tour_id', { header: 'Tour ID', size: 80 }),
    col.accessor('medal_name', { header: 'Tên HCV' }),
    col.accessor('dob', { header: 'Ngày sinh', size: 110 }),
    col.accessor('created_at', {
      header: 'Ngày đặt',
      cell: info => new Date(info.getValue() ?? '').toLocaleDateString('vi-VN'),
    }),
    col.accessor('status', {
      header: 'Trạng thái',
      cell: info => {
        const status = info.getValue();
        const id = info.row.original.id;
        return (
          <select
            value={status}
            onChange={e => update({ resource: 'bookings', id, values: { status: e.target.value } })}
            className={selectCls}
          >
            {Object.entries(STATUS_LABEL).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        );
      },
    }),
    col.display({
      id: 'badge', header: '',
      cell: info => {
        const s = info.row.original.status;
        const variant = s === 'confirmed' ? 'success' : s === 'pending' ? 'warning' : 'destructive';
        return <Badge variant={variant}>{STATUS_LABEL[s]}</Badge>;
      },
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: {
      resource: 'bookings',
      sorters: { initial: [{ field: 'created_at', order: 'desc' }] },
      pagination: { pageSize: 30 },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const { pageCount, currentPage, setCurrentPage } = table.refineCore;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-5">📋 Bookings</h2>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.reactTable.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="bg-muted/50">
                {hg.headers.map(h => (
                  <th key={h.id} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">
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
