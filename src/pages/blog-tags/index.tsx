import { useState } from 'react';
import { useTable } from '@refinedev/react-table';
import { useCreate, useDelete, useInvalidate, useUpdate } from '@refinedev/core';
import { createColumnHelper, getCoreRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { slugifyTitle } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface TagRow {
  id: number;
  slug: string;
  name: string;
  name_en: string;
  sort_order: number;
}

const col = createColumnHelper<TagRow>();

/**
 * Tags are three short fields, so they are edited inline rather than through a
 * second route — one screen is less to keep in sync than a list plus a form.
 */
export function BlogTagList() {
  const invalidate = useInvalidate();
  const { mutate: create } = useCreate();
  const { mutate: update } = useUpdate();
  const { mutate: del } = useDelete();

  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = () => invalidate({ resource: 'blog_tags', invalidates: ['list'] });

  function addTag() {
    const slug = slugifyTitle(name);
    if (!slug) {
      setError('Tên chủ đề phải có ít nhất một chữ cái hoặc số.');
      return;
    }
    setError(null);
    create(
      { resource: 'blog_tags', values: { slug, name: name.trim(), name_en: nameEn.trim() } },
      {
        onSuccess: () => { setName(''); setNameEn(''); refresh(); },
        onError: e => setError(e.message),
      },
    );
  }

  const columns = [
    col.accessor('name', {
      header: 'Tên (VI)',
      cell: info => (
        <Input
          defaultValue={info.getValue()}
          onBlur={e => {
            if (e.target.value !== info.getValue()) {
              update({ resource: 'blog_tags', id: info.row.original.id, values: { name: e.target.value } },
                { onSuccess: refresh });
            }
          }}
        />
      ),
    }),
    col.accessor('name_en', {
      header: 'Tên (EN)',
      cell: info => (
        <Input
          defaultValue={info.getValue()}
          placeholder="Để trống → dùng tiếng Việt"
          onBlur={e => {
            if (e.target.value !== info.getValue()) {
              update({ resource: 'blog_tags', id: info.row.original.id, values: { name_en: e.target.value } },
                { onSuccess: refresh });
            }
          }}
        />
      ),
    }),
    col.accessor('slug', {
      header: 'Slug', size: 200,
      cell: info => <code className="text-xs text-muted-foreground">{info.getValue()}</code>,
    }),
    col.accessor('sort_order', {
      header: 'Thứ tự', size: 90,
      cell: info => (
        <Input
          type="number"
          className="w-20"
          defaultValue={info.getValue()}
          onBlur={e => {
            const next = Number(e.target.value);
            if (next !== info.getValue()) {
              update({ resource: 'blog_tags', id: info.row.original.id, values: { sort_order: next } },
                { onSuccess: refresh });
            }
          }}
        />
      ),
    }),
    col.display({
      id: 'actions', header: '', size: 80,
      cell: info => (
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            // The join rows cascade, so this only unlabels posts — it never
            // deletes one.
            if (confirm(`Xoá chủ đề "${info.row.original.name}"?\nCác bài đang gắn sẽ mất nhãn này.`)) {
              del({ resource: 'blog_tags', id: info.row.original.id }, { onSuccess: refresh });
            }
          }}
        >
          Xoá
        </Button>
      ),
    }),
  ];

  const table = useTable<TagRow>({
    columns,
    refineCoreProps: {
      resource: 'blog_tags',
      sorters: { initial: [{ field: 'sort_order', order: 'asc' }] },
      pagination: { pageSize: 100 },
    },
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-5">
        <Button variant="ghost" size="sm" onClick={() => (window.location.href = '/blogs')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">🏷️ Chủ đề blog</h2>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 flex flex-col gap-3">
          <p className="text-sm font-semibold">Thêm chủ đề</p>
          {error && <span className="text-xs text-destructive">{error}</span>}
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label>Tên (VI)</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Kinh nghiệm" />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Tên (EN)</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} placeholder="Experience" />
            </div>
            <Button type="button" onClick={addTag} disabled={!name.trim()}>+ Thêm</Button>
            <span className="text-xs text-muted-foreground">
              Slug sinh tự động: <code>{slugifyTitle(name) || '…'}</code>
            </span>
          </div>
        </CardContent>
      </Card>

      <DataTable table={table} emptyText="Chưa có chủ đề nào." />
      <p className="mt-3 text-xs text-muted-foreground">
        Sửa trực tiếp trong bảng — rời khỏi ô là lưu.
      </p>
    </div>
  );
}
