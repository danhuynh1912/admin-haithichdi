import { flexRender } from '@tanstack/react-table';
import type { UseTableReturnType } from '@refinedev/react-table';
import type { BaseRecord } from '@refinedev/core';
import { Spinner } from '@/components/ui/spinner';

/**
 * The list markup every resource page shared, with one place to render the
 * loading and empty states so they stay identical across pages.
 */
export function DataTable<T extends BaseRecord>({
  table,
  emptyText = 'Chưa có dữ liệu.',
}: {
  table: UseTableReturnType<T>;
  emptyText?: string;
}) {
  const rows = table.reactTable.getRowModel().rows;
  const colCount = table.reactTable.getAllLeafColumns().length;
  // isFetching, not isLoading: also covers refetches after a create or delete.
  const loading = table.refineCore.tableQuery.isFetching;

  return (
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
          {loading && (
            <tr>
              <td colSpan={colCount} className="px-4 py-12">
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Spinner />
                  <span>Đang tải…</span>
                </div>
              </td>
            </tr>
          )}

          {!loading && rows.length === 0 && (
            <tr>
              <td colSpan={colCount} className="px-4 py-12 text-center text-muted-foreground">
                {emptyText}
              </td>
            </tr>
          )}

          {!loading && rows.map(row => (
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
  );
}
