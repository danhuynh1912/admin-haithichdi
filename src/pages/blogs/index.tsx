import { useTable } from '@refinedev/react-table';
import { useDelete, useNavigation } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BlogRow {
  id: number;
  slug: string;
  title: string;
  title_en: string;
  status: 'draft' | 'published';
  published_at: string | null;
  updated_at: string;
}

const col = createColumnHelper<BlogRow>();

export function BlogList() {
  const { edit, create } = useNavigation();
  const { mutate: del } = useDelete();

  const columns = [
    col.accessor('title', {
      header: 'Tiêu đề',
      cell: info => (
        <div className="flex flex-col">
          <span className="font-medium">{info.getValue()}</span>
          <span className="text-xs text-muted-foreground">/{info.row.original.slug}</span>
        </div>
      ),
    }),
    col.accessor('status', {
      header: 'Trạng thái', size: 120,
      cell: info => (
        <Badge variant={info.getValue() === 'published' ? 'success' : 'secondary'}>
          {info.getValue() === 'published' ? 'Đã đăng' : 'Nháp'}
        </Badge>
      ),
    }),
    col.accessor('published_at', {
      header: 'Ngày đăng', size: 120,
      cell: info => (info.getValue() ? new Date(info.getValue() as string).toLocaleDateString('vi-VN') : '—'),
    }),
    // Flags the two fields an English reader actually needs; long-form markdown
    // is deliberately not counted, matching how the tour list reports this.
    col.accessor('title_en', {
      header: 'EN', size: 90,
      cell: info => (
        <Badge variant={info.getValue()?.trim() ? 'success' : 'secondary'}>
          {info.getValue()?.trim() ? 'Đã dịch' : 'Chưa dịch'}
        </Badge>
      ),
    }),
    col.display({
      id: 'actions', header: '',
      cell: info => (
        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => edit('blogs', info.row.original.id)}>Sửa</Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Xoá bài "${info.row.original.title}"?\nHành động này không thể hoàn tác.`)) {
                del({ resource: 'blogs', id: info.row.original.id });
              }
            }}
          >
            Xoá
          </Button>
        </div>
      ),
    }),
  ];

  const table = useTable<BlogRow>({
    columns,
    refineCoreProps: {
      resource: 'blogs',
      sorters: { initial: [{ field: 'updated_at', order: 'desc' }] },
      pagination: { pageSize: 30 },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  const { pageCount, currentPage, setCurrentPage } = table.refineCore;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-xl font-bold">📝 Blog</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => (window.location.href = '/blog-tags')}>
            Quản lý chủ đề
          </Button>
          <Button onClick={() => create('blogs')}>+ Viết bài</Button>
        </div>
      </div>
      <DataTable table={table} emptyText="Chưa có bài viết nào." />
      <div className="flex gap-2 mt-4 items-center">
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage <= 1}>←</Button>
        <span className="text-sm text-muted-foreground">Trang {currentPage} / {pageCount}</span>
        <Button variant="outline" size="sm" onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage >= pageCount}>→</Button>
      </div>
    </div>
  );
}
