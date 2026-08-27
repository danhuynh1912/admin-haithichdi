import { useTable } from '@refinedev/react-table';
import { useNavigation } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface CampaignRow {
  id: number;
  slug: string;
  title: string;
  is_published: boolean;
  is_closed: boolean;
  result_md: string;
  updated_at: string;
}

const col = createColumnHelper<CampaignRow>();

export function CampaignList() {
  const { create, edit } = useNavigation();

  const columns = [
    col.accessor('title', {
      header: 'Chiến dịch',
      cell: info => (
        <button
          type="button"
          onClick={() => edit('campaigns', info.row.original.id)}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {info.getValue()}
        </button>
      ),
    }),
    col.accessor('slug', {
      header: 'Đường dẫn',
      cell: info => <span className="text-muted-foreground">/thien-nguyen/{info.getValue()}</span>,
    }),
    col.display({
      id: 'state',
      header: 'Trạng thái',
      // Two independent things, so two badges rather than one merged label:
      // whether it is visible at all, and whether it is still running.
      cell: info => {
        const row = info.row.original;
        return (
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={row.is_published ? 'success' : 'secondary'}>
              {row.is_published ? 'Đang hiện' : 'Nháp'}
            </Badge>
            {row.is_closed && <Badge variant="secondary">Đã kết thúc</Badge>}
          </div>
        );
      },
    }),
    col.display({
      id: 'result',
      header: 'Kết quả',
      cell: info =>
        info.row.original.result_md?.trim()
          ? <Badge variant="info">Đã viết</Badge>
          : <span className="text-muted-foreground">—</span>,
    }),
    col.accessor('updated_at', {
      header: 'Cập nhật',
      cell: info => formatDate(info.getValue()),
    }),
  ];

  const table = useTable({
    columns,
    refineCoreProps: {
      resource: 'campaigns',
      sorters: { initial: [{ field: 'id', order: 'desc' }] },
      pagination: { pageSize: 30 },
    },
    enableSorting: false,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold">❤️ Chiến dịch thiện nguyện</h2>
        <Button onClick={() => create('campaigns')}>+ Thêm chiến dịch</Button>
      </div>
      <DataTable table={table} emptyText="Chưa có chiến dịch nào." />
    </div>
  );
}
