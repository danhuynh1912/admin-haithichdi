import { supabase } from './supabase';

/**
 * Client cho edge function `storage-usage` — nơi duy nhất đọc được dung lượng
 * bucket S3, vì AWS credentials chỉ nằm ở phía server. Không bao giờ đặt
 * credentials vào panel này: đây là SPA, mọi thứ trong bundle đều công khai.
 */
const FN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/storage-usage`;

export interface PrefixUsage {
  prefix: string;
  bytes: number;
  count: number;
}

export interface S3Usage {
  bucket: string;
  totalBytes: number;
  objectCount: number;
  /** true khi bucket vượt số trang mà function chịu duyệt — số liệu là tối thiểu. */
  truncated: boolean;
  byPrefix: PrefixUsage[];
  largest: Array<{ key: string; bytes: number }>;
}

export interface DbUsage {
  bytes: number;
  limitBytes: number;
}

export async function fetchS3Usage(): Promise<S3Usage> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Phiên đăng nhập đã hết hạn');

  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const json = await res.json().catch(() => ({})) as S3Usage & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Lỗi ${res.status}`);
  return json;
}

export async function fetchDbUsage(): Promise<DbUsage> {
  const { data, error } = await supabase.rpc('storage_usage');
  if (error) throw new Error(error.message);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Không đọc được dung lượng database');

  return { bytes: Number(row.db_bytes), limitBytes: Number(row.db_limit_bytes) };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 100 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}
