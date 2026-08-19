import type { UseTableReturnType } from '@refinedev/react-table';
import type { BaseRecord } from '@refinedev/core';
import { Button } from '@/components/ui/button';

/**
 * Page controls for a `useTable` list, plus the total row count.
 *
 * The count is not decoration: a table that silently shows its first page reads
 * as the whole table, and an admin who has more rows than fit concludes the
 * missing ones were deleted. Showing "14 mục" next to "Trang 1 / 2" says
 * plainly that there is more to see.
 */
export function Pagination<T extends BaseRecord>({
  table,
  unit = 'mục',
}: {
  table: UseTableReturnType<T>;
  /** What the rows are called, for the count — "tour", "location", "bài viết". */
  unit?: string;
}) {
  const { pageCount, currentPage, setCurrentPage, tableQuery } = table.refineCore;
  const total = tableQuery.data?.total ?? 0;

  if (!total) return null;

  return (
    <div className="flex items-center gap-2 mt-4">
      {pageCount > 1 && (
        <>
          <Button
            variant="outline"
            size="sm"
            aria-label="Trang trước"
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            ←
          </Button>
          <span className="text-sm text-muted-foreground">
            Trang {currentPage} / {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="Trang sau"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
          >
            →
          </Button>
        </>
      )}
      <span className="ml-auto text-sm text-muted-foreground">
        {total} {unit}
      </span>
    </div>
  );
}
