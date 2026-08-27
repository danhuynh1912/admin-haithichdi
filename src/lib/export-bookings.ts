import type { Cell, Column, SheetData } from 'write-excel-file/browser';

import { formatDate } from '@/lib/utils';

/**
 * A booking as the spreadsheet needs it — the columns below are the public
 * site's registration form, in the order it asks for the fields, and nothing
 * else: the sheet is a start list, not a copy of the admin table.
 */
export interface ExportableBooking {
  full_name: string;
  medal_name: string | null;
  phone: string;
  dob: string | null;
  email: string;
  citizen_id: string | null;
  note: string;
  created_at: string;
  tours: {
    title: string;
    start_date: string | null;
    end_date: string | null;
    locations: { name: string } | null;
  } | null;
}

type TourDates = (start: string | null | undefined, end: string | null | undefined) => string;

const HEADER = {
  fontWeight: 'bold',
  backgroundColor: '#F3F4F6',
  align: 'left',
  wrap: false,
} as const;

/**
 * Phone numbers and citizen IDs are digit strings, not numbers: left to guess,
 * Excel reads `0329031998` as a number and eats the leading zero, which is the
 * one thing a start list cannot afford. Writing them as text keeps them whole.
 */
function formColumns(): Column<ExportableBooking>[] {
  return [
    { header: { value: 'Họ và tên', ...HEADER }, width: 24, cell: b => b.full_name },
    { header: { value: 'Tên in trên huy chương', ...HEADER }, width: 24, cell: b => b.medal_name ?? '' },
    { header: { value: 'Số điện thoại', ...HEADER }, width: 15, cell: b => ({ value: b.phone, type: String }) },
    { header: { value: 'Ngày sinh', ...HEADER }, width: 13, cell: b => (b.dob ? formatDate(b.dob) : '') },
    { header: { value: 'Email', ...HEADER }, width: 26, cell: b => b.email },
    { header: { value: 'Căn cước công dân', ...HEADER }, width: 18, cell: b => ({ value: b.citizen_id ?? '', type: String }) },
    { header: { value: 'Ghi chú của khách', ...HEADER }, width: 40, cell: b => b.note },
  ];
}

/**
 * Which departure a row belongs to, but only when the sheet needs telling.
 *
 * A file for one departure says so once, in its title. A file spanning several
 * — "Tất cả tour" — cannot, and without these two columns its rows are people
 * from different treks with nothing to separate them.
 */
function departureColumns(tourDates: TourDates): Column<ExportableBooking>[] {
  return [
    { header: { value: 'Cung', ...HEADER }, width: 18, cell: b => b.tours?.locations?.name ?? '' },
    { header: { value: 'Ngày đi', ...HEADER }, width: 18, cell: b => tourDates(b.tours?.start_date, b.tours?.end_date) },
  ];
}

/** `Phu Sa Phìn — 19–20/09/2026`, or null when the rows span more than one. */
function singleDeparture(bookings: ExportableBooking[], tourDates: TourDates): string | null {
  const seen = new Set(
    bookings.map(b => `${b.tours?.locations?.name ?? ''}|${tourDates(b.tours?.start_date, b.tours?.end_date)}`),
  );
  if (seen.size !== 1) return null;
  const [name, dates] = [...seen][0].split('|');
  return [name, dates].filter(Boolean).join(' — ');
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
  fallbackTitle,
  tourDates,
}: {
  bookings: ExportableBooking[];
  fileName: string;
  /** Used when the rows span several departures — the filters describe it. */
  fallbackTitle: string;
  tourDates: TourDates;
}): Promise<void> {
  // Loaded on demand: the writer is far and away the heaviest thing on this
  // screen, and most visits to Bookings never export anything.
  const { default: writeXlsxFile, getSheetData } = await import('write-excel-file/browser');

  const departure = singleDeparture(bookings, tourDates);
  const columns = departure ? formColumns() : [...formColumns(), ...departureColumns(tourDates)];

  // The objects API writes a header and the rows; the title has to go above
  // both, so the sheet is built as raw rows from there on.
  const title: Cell[] = [{
    value: departure ?? fallbackTitle,
    fontSize: 14,
    fontWeight: 'bold',
    align: 'center',
    height: 26,
    // Merged across every column, so "centered" means centered on the sheet
    // rather than inside column A.
    columnSpan: columns.length,
  }];

  const sheetData: SheetData = [title, ...getSheetData(bookings, columns)];

  await writeXlsxFile(sheetData, {
    columns: columns.map(({ width }) => ({ width })),
    sheet: 'Bookings',
    // Title and header both stay put while scrolling a long start list.
    stickyRowsCount: 2,
  }).toFile(fileName);
}
