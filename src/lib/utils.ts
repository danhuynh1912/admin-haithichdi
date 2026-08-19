import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Vietnamese title → URL slug, matching the `^[a-z0-9]+(-[a-z0-9]+)*$` check on
 * `blogs.slug`. Distinct from the frontend's `slugify`, which strips separators
 * entirely because it is matching a location name inside a query string.
 */
export function slugifyTitle(value: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

/** Date (or date-time) value → `29/08/2026`. Falsy → em dash, unparseable → as-is. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Date-time value → `29/08/2026 14:05`. Falsy → em dash, unparseable → as-is. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) return value;
  return parsed.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** S3 keys referenced by `![alt](key)` in a markdown body. */
export function markdownImageKeys(markdown: string): string[] {
  const keys = new Set<string>();
  const pattern = /!\[[^\]]*\]\(([^)\s]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(markdown ?? '')) !== null) {
    const key = match[1].trim();
    if (key && !/^https?:\/\//.test(key)) keys.add(key);
  }
  return [...keys];
}
