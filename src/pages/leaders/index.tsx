import { useTable } from '@refinedev/react-table';
import { useNavigation } from '@refinedev/core';
import { createColumnHelper, flexRender, getCoreRowModel } from '@tanstack/react-table';
import { resolveMediaUrl } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Profile {
  id: string;
  full_name: string;
  role: string;
  display_role: string;
  is_active: boolean;
  avatar_path: string | null;
  avatar_url: string;
  years_experience: number;
}

const col = createColumnHelper<Profile>();

export function LeaderList() {
  const { edit } = useNavigation();

  const columns = [
    col.display({
      id: 'avatar', header: 'Avatar', size: 60,
      cell: info => {
        const r = info.row.original;
        const url = resolveMediaUrl(r.avatar_path, r.avatar_url);
        return url
          ? <img src={url} alt="" className="w-9 h-9 object-cover rounded-full" />
          : <div className="w-9 h-9 rounded-full bg-[#d00600] flex items-center justify-center text-white font-bold text-sm">{r.full_name[0]}</div>;
      },
    }),
    col.accessor('full_name', { header: 'Họ tên' }),
    col.accessor('role', { header: 'Role', size: 80 }),
    col.accessor('display_role', { header: 'Chức danh' }),
    col.accessor('years_experience', { header: 'Kinh nghiệm', size: 110, cell: i => `${i.getValue()} năm` }),
    col.accessor('is_active', {
      header: 'Active', size: 80,
      cell: i => <Badge variant={i.getValue() ? 'success' : 'secondary'}>{i.getValue() ? 'ON' : 'OFF'}</Badge>,
    }),
    col.display({
      id: 'actions', header: '',
      cell: info => (
        <Button variant="outline" size="sm" onClick={() => edit('leaders', info.row.original.id)}>Sửa</Button>
      ),
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: { resource: 'leaders', meta: { select: 'id,full_name,role,display_role,is_active,avatar_path,avatar_url,years_experience' } },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">👤 Leaders</h2>
        <p className="text-sm text-muted-foreground">Leaders được tạo qua Supabase Auth → Profiles</p>
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
    </div>
  );
}
