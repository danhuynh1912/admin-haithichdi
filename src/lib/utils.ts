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
