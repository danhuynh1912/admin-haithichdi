import { flexRender, type Header } from '@tanstack/react-table';
import type { UseTableReturnType } from '@refinedev/react-table';
import type { BaseRecord } from '@refinedev/core';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

/**
 * The list markup every resource page shared, with one place to render the
 * loading and empty states so they stay identical across pages.
 */
/**
 * A column header, clickable when the column can be sorted.
 *
 * Sorting is decided per column rather than turned on for the whole table:
 * refine sends the column id straight to PostgREST as an `order` clause, so a
 * column the database has no matching field for — a computed badge, a joined
 * name — would ask the server to sort by something that does not exist.
 * `getCanSort` already refuses display columns, and a list that has not been
 * checked against its own schema opts out with `enableSorting: false`.
 */
function HeaderCell<T extends BaseRecord>({ header }: { header: Header<T, unknown> }) {
  const content = flexRender(header.column.columnDef.header, header.getContext());
  if (!header.column.getCanSort()) return <>{content}</>;

  const direction = header.column.getIsSorted();
  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown;

  return (
    <button
      type="button"
      onClick={header.column.getToggleSortingHandler()}
      // The neutral icon stays dim until hover so seven sortable columns do not
      // read as seven active ones.
      className="group inline-flex items-center gap-1.5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none rounded-sm"
      aria-label={`Sắp xếp theo ${typeof header.column.columnDef.header === 'string' ? header.column.columnDef.header : header.column.id}`}
    >
      {content}
      <Icon
        className={cn(
          'size-3.5 shrink-0',
          direction ? 'text-foreground' : 'text-muted-foreground/40 group-hover:text-muted-foreground',
        )}
      />
    </button>
  );
}

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
                  <HeaderCell header={h} />
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
