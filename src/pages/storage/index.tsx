import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Database, HardDrive, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import {
  fetchDbUsage,
  fetchS3Usage,
  formatBytes,
  type DbUsage,
  type S3Usage,
} from '@/lib/storageApi';

/**
 * Dung lượng — ảnh nằm ở S3, database nằm ở Supabase, và hai bên tính tiền
 * theo hai cách khác nhau, nên màn này không gộp chúng vào một con số:
 *
 *  - Database có hạn mức cứng (500 MB ở gói free), vượt là bị khoá ghi.
 *  - S3 không có hạn mức, chỉ tính tiền theo GB lưu trữ, nên hiển thị con số
 *    tuyệt đối kèm ước tính chi phí thay vì thanh phần trăm.
 *
 * Hạn mức Egress 5 GB/tháng của Supabase không hiện ở đây: Management API
 * không có endpoint trả về mức đã dùng, và token gọi được nó có toàn quyền
 * tài khoản nên không thể đặt trong panel này. Xem ở dashboard Supabase.
 */

/** us-east-1 S3 Standard, xấp xỉ đủ để biết đang ở mức vài nghìn đồng hay vài trăm nghìn. */
const USD_PER_GB_MONTH = 0.023;

export function StoragePage() {
  const [s3, setS3] = useState<S3Usage | null>(null);
  const [db, setDb] = useState<DbUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s3Result, dbResult] = await Promise.all([
        fetchS3Usage(),
        fetchDbUsage(),
      ]);
      setS3(s3Result);
      setDb(dbResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được dung lượng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const dbPercent = db ? (db.bytes / db.limitBytes) * 100 : 0;
  const s3Gb = s3 ? s3.totalBytes / 1024 ** 3 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dung lượng</h1>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? 'animate-spin' : ''} size={15} />
          Tải lại
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading && !s3 && !db ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Database size={16} />
                  Database (Supabase)
                </div>
                <div className="text-3xl font-semibold">
                  {db ? formatBytes(db.bytes) : '—'}
                </div>
                {db && (
                  <>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          dbPercent > 80
                            ? 'h-full bg-red-500'
                            : dbPercent > 50
                              ? 'h-full bg-amber-500'
                              : 'h-full bg-emerald-500'
                        }
                        style={{ width: `${Math.min(dbPercent, 100)}%` }}
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {dbPercent.toFixed(1)}% của {formatBytes(db.limitBytes)} (gói free)
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <HardDrive size={16} />
                  Ảnh &amp; file (S3)
                </div>
                <div className="text-3xl font-semibold">
                  {s3 ? formatBytes(s3.totalBytes) : '—'}
                </div>
                {s3 && (
                  <p className="text-sm text-muted-foreground">
                    {s3.objectCount.toLocaleString('vi-VN')} file · không có hạn mức,
                    ước tính {(s3Gb * USD_PER_GB_MONTH).toFixed(2)} USD/tháng
                    {s3.truncated && ' · số liệu tối thiểu (bucket quá lớn để duyệt hết)'}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {s3 && s3.byPrefix.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">Theo thư mục</h2>
                <div className="space-y-2">
                  {s3.byPrefix.map(({ prefix, bytes, count }) => (
                    <div key={prefix} className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate font-mono text-xs">{prefix}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {count} file · {formatBytes(bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {s3 && s3.largest.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <h2 className="mb-1 text-sm font-medium text-muted-foreground">File nặng nhất</h2>
                <p className="mb-3 text-xs text-muted-foreground">
                  Ảnh trên ~1.5 MB thường là ảnh chưa được thu nhỏ khi upload — chúng
                  làm lần xem đầu tiên chậm hẳn vì trình tối ưu phải tải trọn file gốc.
                </p>
                <div className="space-y-2">
                  {s3.largest.map(({ key, bytes }) => (
                    <div key={key} className="flex items-center justify-between gap-4 text-sm">
                      <span className="truncate font-mono text-xs" title={key}>{key}</span>
                      <span
                        className={
                          bytes > 1.5 * 1024 * 1024
                            ? 'shrink-0 font-medium text-amber-600'
                            : 'shrink-0 text-muted-foreground'
                        }
                      >
                        {formatBytes(bytes)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
