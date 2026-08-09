import { useState } from 'react';
import { useTable } from '@refinedev/react-table';
import { useNavigation, useInvalidate } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { resolveMediaUrl } from '@/lib/supabase';
import { emailToUsername } from '@/lib/username';
import { deleteStaff } from '@/lib/adminApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface StaffAccount {
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

const col = createColumnHelper<StaffAccount>();

const SELECT = 'id,email,full_name,role,display_role,is_active,avatar_path,avatar_url,years_experience,last_sign_in_at';

export function StaffList() {
  const { edit, create } = useNavigation();
  const invalidate = useInvalidate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onDelete(row: StaffAccount) {
    if (!confirm(`Xoá tài khoản "${row.full_name}" (${emailToUsername(row.email)})?\nHành động này không thể hoàn tác.`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await deleteStaff(row.id);
      await invalidate({ resource: 'staff_admin', invalidates: ['list'] });
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
          : <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">{(r.full_name || emailToUsername(r.email))[0]?.toUpperCase()}</div>;
      },
    }),
    col.accessor('full_name', { header: 'Họ tên' }),
    col.accessor('email', { header: 'Tên đăng nhập', cell: i => emailToUsername(i.getValue()) }),
    col.accessor('role', {
      header: 'Role', size: 90,
      cell: i => (
        <Badge variant={i.getValue() === 'admin' ? 'default' : 'secondary'}>
          {i.getValue() === 'admin' ? 'Admin' : 'Sale'}
        </Badge>
      ),
    }),
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
              {busyId === r.id ? <Spinner /> : 'Xoá'}
            </Button>
          </div>
        );
      },
    }),
  ];

  const table = useTable<StaffAccount>({
    columns,
    refineCoreProps: { resource: 'staff_admin', meta: { select: SELECT } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">👤 Tài khoản</h2>
        <Button onClick={() => create('profiles')}>+ Thêm tài khoản</Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <DataTable table={table} emptyText="Chưa có tài khoản nào. Bấm “+ Thêm tài khoản” để tạo tài khoản đầu tiên." />
    </div>
  );
}
