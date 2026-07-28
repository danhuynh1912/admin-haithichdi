import { useState } from 'react';
import { useTable } from '@refinedev/react-table';
import { useNavigation, useInvalidate } from '@refinedev/core';
import { createColumnHelper, flexRender, getCoreRowModel } from '@tanstack/react-table';
import { resolveMediaUrl } from '@/lib/supabase';
import { deleteLeader } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Leader {
  id: string;
  email: string;
  full_name: string;
  role: string;
  display_role: string;
  is_active: boolean;
  avatar_path: string | null;
  avatar_url: string;
  years_experience: number;
  last_sign_in_at: string | null;
}

const col = createColumnHelper<Leader>();

const SELECT = 'id,email,full_name,role,display_role,is_active,avatar_path,avatar_url,years_experience,last_sign_in_at';

export function LeaderList() {
  const { edit, create } = useNavigation();
  const invalidate = useInvalidate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(row: Leader) {
    if (!confirm(`Xoá tài khoản "${row.full_name}" (${row.email})?\nHành động này không thể hoàn tác.`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await deleteLeader(row.id);
      await invalidate({ resource: 'leaders_admin', invalidates: ['list'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const columns = [
    col.display({
      id: 'avatar', header: 'Avatar', size: 60,
      cell: info => {
        const r = info.row.original;
        const url = resolveMediaUrl(r.avatar_path, r.avatar_url);
        return url
          ? <img src={url} alt="" className="w-9 h-9 object-cover rounded-full" />
          : <div className="w-9 h-9 rounded-full bg-[#d00600] flex items-center justify-center text-white font-bold text-sm">{(r.full_name || r.email)[0]?.toUpperCase()}</div>;
      },
    }),
    col.accessor('full_name', { header: 'Họ tên' }),
    col.accessor('email', { header: 'Email đăng nhập' }),
    col.accessor('role', { header: 'Role', size: 80 }),
    col.accessor('display_role', { header: 'Chức danh' }),
    col.accessor('years_experience', { header: 'Kinh nghiệm', size: 110, cell: i => `${i.getValue() ?? 0} năm` }),
    col.accessor('last_sign_in_at', {
      header: 'Đăng nhập gần nhất', size: 150,
      cell: i => i.getValue() ? new Date(i.getValue() as string).toLocaleDateString('vi-VN') : '—',
    }),
    col.accessor('is_active', {
      header: 'Active', size: 80,
      cell: i => <Badge variant={i.getValue() ? 'success' : 'secondary'}>{i.getValue() ? 'ON' : 'OFF'}</Badge>,
    }),
    col.display({
      id: 'actions', header: '',
      cell: info => {
        const r = info.row.original;
        return (
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => edit('profiles', r.id)}>Sửa</Button>
            <Button variant="outline" size="sm" disabled={busyId === r.id} onClick={() => onDelete(r)}>
              {busyId === r.id ? '…' : 'Xoá'}
            </Button>
          </div>
        );
      },
    }),
  ];

  const table = useTable<Leader>({
    columns,
    refineCoreProps: { resource: 'leaders_admin', meta: { select: SELECT } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">👤 Leaders</h2>
        <Button onClick={() => create('profiles')}>+ Thêm Leader</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
            {table.reactTable.getRowModel().rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                  Chưa có leader nào. Bấm “+ Thêm Leader” để tạo tài khoản đầu tiên.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
