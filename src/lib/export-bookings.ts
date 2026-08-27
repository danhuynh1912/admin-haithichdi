import type { Column } from 'write-excel-file/browser';

import { formatDate, formatDateTime } from '@/lib/utils';

/**
 * A booking as the spreadsheet needs it — the columns below are the public
 * site's registration form, in the order it asks for them, followed by the
 * context staff need to act on a row.
 */
export interface ExportableBooking {
  full_name: string;
  medal_name: string | null;
  phone: string;
  dob: string | null;
  email: string;
  citizen_id: string | null;
  note: string;
  status: string;
  status_note: string;
  created_at: string;
  tours: {
    title: string;
    start_date: string | null;
    end_date: string | null;
    locations: { name: string } | null;
  } | null;
}

const HEADER = {
  fontWeight: 'bold',
  backgroundColor: '#F3F4F6',
  align: 'left',
  wrap: false,
} as const;

/**
 * Phone numbers and citizen IDs are digit strings, not numbers: left to guess,
 * Excel reads `0329031998` as a number and eats the leading zero, which is the
 * one thing a call list cannot afford. Writing them as text keeps them whole.
 */
export function bookingColumns(
  statusLabel: (status: string) => string,
  tourDates: (start: string | null | undefined, end: string | null | undefined) => string,
): Column<ExportableBooking>[] {
  return [
    { header: { value: 'Họ và tên', ...HEADER }, width: 24, cell: b => b.full_name },
    { header: { value: 'Tên in trên huy chương', ...HEADER }, width: 24, cell: b => b.medal_name ?? '' },
    { header: { value: 'Số điện thoại', ...HEADER }, width: 15, cell: b => ({ value: b.phone, type: String }) },
    { header: { value: 'Ngày sinh', ...HEADER }, width: 13, cell: b => (b.dob ? formatDate(b.dob) : '') },
    { header: { value: 'Email', ...HEADER }, width: 26, cell: b => b.email },
    { header: { value: 'Căn cước công dân', ...HEADER }, width: 18, cell: b => ({ value: b.citizen_id ?? '', type: String }) },
    { header: { value: 'Ghi chú của khách', ...HEADER }, width: 40, cell: b => b.note },
    { header: { value: 'Cung', ...HEADER }, width: 18, cell: b => b.tours?.locations?.name ?? '' },
    { header: { value: 'Tour', ...HEADER }, width: 30, cell: b => b.tours?.title ?? '' },
    { header: { value: 'Ngày đi', ...HEADER }, width: 18, cell: b => tourDates(b.tours?.start_date, b.tours?.end_date) },
    { header: { value: 'Trạng thái', ...HEADER }, width: 22, cell: b => statusLabel(b.status) },
    { header: { value: 'Ghi chú gửi khách', ...HEADER }, width: 32, cell: b => b.status_note ?? '' },
    { header: { value: 'Ngày đặt', ...HEADER }, width: 18, cell: b => formatDateTime(b.created_at) },
  ];
}

/** `Phu Sa Phìn` → `phu-sa-phin`, so the filter shows up in the file name. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function writeBookingsXlsx({
  bookings,
  fileName,
  statusLabel,
  tourDates,
}: {
  bookings: ExportableBooking[];
  fileName: string;
  statusLabel: (status: string) => string;
  tourDates: (start: string | null | undefined, end: string | null | undefined) => string;
}): Promise<void> {
  // Loaded on demand: the writer is far and away the heaviest thing on this
  // screen, and most visits to Bookings never export anything.
  const { default: writeXlsxFile } = await import('write-excel-file/browser');

  await writeXlsxFile(bookings, {
    columns: bookingColumns(statusLabel, tourDates),
    sheet: 'Bookings',
    // The header stays put while scrolling a long list.
    stickyRowsCount: 1,
  }).toFile(fileName);
}
