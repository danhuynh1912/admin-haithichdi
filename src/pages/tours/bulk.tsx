import { useEffect, useState } from 'react';
import { useInvalidate, useList, useNavigation } from '@refinedev/core';
import { CalendarDays, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SimpleSelect } from '@/components/SimpleSelect';
import { Modal } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { DepartureCalendar } from '@/components/DepartureCalendar';
import { LocationForm } from '@/pages/locations/form';
import {
  departDateOf, durationLabel, endDateOf, formatDdMm,
  itineraryRowsNeeded, todayIso, type RouteDuration,
} from '@/lib/duration';

interface Route {
  id: number;
  name: string;
  default_trek_days: number;
  default_lead_nights: number;
  default_price: string | null;
  default_max_guests: number;
}

const ROUTE_SELECT =
  'id,name,default_trek_days,default_lead_nights,default_price,default_max_guests';

/** Stands in for "no route yet": a blank select value reads as unset. */
const NONE = 'none';

/** The same auto-title the single-tour form uses, so both produce one naming. */
const autoTitle = (routeName: string) => `Chinh phục ${routeName}`;

/**
 * Ten departures up the same route used to mean filling the same form ten
 * times, changing one date each pass. Here the route is chosen once, its dates
 * are ticked on a calendar, and every tour is written in one insert.
 *
 * The route's declared length is what makes this possible: pick the first day
 * on the mountain and the return date follows, so a departure is genuinely one
 * click of information.
 */
export function TourBulkCreate() {
  const { list } = useNavigation();
  const invalidate = useInvalidate();

  const [routeId, setRouteId] = useState(0);
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [price, setPrice] = useState('');
  const [maxGuests, setMaxGuests] = useState(20);
  const [editingRoute, setEditingRoute] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  const { query: routesQuery } = useList<Route>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
    meta: { select: ROUTE_SELECT },
  });
  const routes = routesQuery?.data?.data ?? [];
  const route = routes.find(r => r.id === routeId);

  // Every departure this route already has, so the calendar can refuse to make
  // a second one on the same day — the database has no constraint against it,
  // and a double click would otherwise quietly produce twenty tours.
  const { query: existingQuery } = useList<{ id: number; start_date: string | null }>({
    resource: 'tours',
    filters: [{ field: 'location_id', operator: 'eq', value: routeId }],
    pagination: { pageSize: 200 },
    meta: { select: 'id,start_date' },
    queryOptions: { enabled: routeId > 0 },
  });
  const taken = new Set(
    (existingQuery?.data?.data ?? []).map(t => t.start_date).filter(Boolean) as string[],
  );

  const { query: daysQuery } = useList<{ id: number }>({
    resource: 'location_itinerary_days',
    filters: [{ field: 'location_id', operator: 'eq', value: routeId }],
    pagination: { pageSize: 50 },
    queryOptions: { enabled: routeId > 0 },
  });
  const itineraryRows = daysQuery?.data?.total ?? 0;

  const duration: RouteDuration = {
    trekDays: route?.default_trek_days ?? 0,
    leadNights: route?.default_lead_nights ?? 1,
  };
  const declared = duration.trekDays > 0;

  // Picking a route resets the run: its dates, price and capacity all belong
  // to that route, and carrying them across would be a silent mistake.
  useEffect(() => {
    setDates(new Set());
    setCreatedCount(0);
    setError(null);
    if (!route) return;
    setPrice(route.default_price != null ? String(route.default_price) : '');
    setMaxGuests(route.default_max_guests ?? 20);
  }, [route]);

  const planned = [...dates].sort().map(startDate => ({
    startDate,
    endDate: endDateOf(startDate, duration),
    departDate: departDateOf(startDate, duration),
    title: `${autoTitle(route?.name ?? '')} (${formatDdMm(startDate)})`,
  }));

  async function createAll() {
    if (!route || planned.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const { data, error: insertError } = await supabase
        .from('tours')
        .insert(
          planned.map(row => ({
            title: row.title,
            location_id: route.id,
            start_date: row.startDate,
            end_date: row.endDate,
            price: price === '' ? null : price,
            max_guests: maxGuests,
            is_active: true,
          })),
        )
        .select('id');

      if (insertError) throw new Error(insertError.message);

      setCreatedCount(data?.length ?? 0);
      setDates(new Set());
      invalidate({ resource: 'tours', invalidates: ['list'] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('tours')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">Tạo nhiều tour</h2>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 pt-6">
          <div className="flex flex-col gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
            <Label className="text-base font-bold">Cung *</Label>
            <p className="text-xs text-muted-foreground">
              Mọi tour tạo ở đây đều thuộc cung này và dùng chung nội dung của nó.
            </p>
            {routesQuery?.isLoading ? (
              <div className="flex items-center gap-2 py-2 text-muted-foreground"><Spinner /> Đang tải…</div>
            ) : (
              <SimpleSelect
                ariaLabel="Cung"
                value={routeId ? String(routeId) : NONE}
                onValueChange={next => setRouteId(next === NONE ? 0 : Number(next))}
                options={[
                  { value: NONE, label: '— Chọn cung —' },
                  ...routes.map(r => ({ value: String(r.id), label: r.name })),
                ]}
                className="w-full text-base font-semibold data-[size=default]:h-12"
              />
            )}
          </div>

          {!route ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              Chọn cung ở trên để bắt đầu.
            </div>
          ) : !declared ? (
            // Without the number there is no return date, so this cannot guess
            // its way forward — but it can hand over the place to fix it.
            <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-6 text-sm">
              <p className="font-medium text-destructive">
                Cung {route.name} chưa khai báo số ngày leo, chưa tính được ngày về.
              </p>
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingRoute(true)}>
                Khai báo số ngày leo ở cung {route.name}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <CalendarDays className="size-4" />
                <span>
                  <strong className="font-semibold text-foreground">{durationLabel(duration)}</strong>
                  {' · '}khởi hành tối hôm trước
                </span>
                {itineraryRows !== itineraryRowsNeeded(duration) && (
                  <span className="font-medium text-destructive">
                    · lịch trình cần {itineraryRowsNeeded(duration)} dòng, đang có {itineraryRows}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditingRoute(true)}
                  className="ml-auto font-semibold text-primary underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
                >
                  Sửa cung này →
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>Chọn ngày leo đầu tiên</Label>
                  <DepartureCalendar
                    selected={dates}
                    onChange={setDates}
                    taken={taken}
                    minDate={todayIso()}
                  />
                  <p className="text-xs text-muted-foreground">
                    Ngày gạch ngang là ngày cung này đã có tour. Ngày di chuyển tự lùi
                    lại {duration.leadNights} hôm, không cần chọn.
                  </p>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Giá (VND)</Label>
                      <Input
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="—"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Số khách tối đa</Label>
                      <Input
                        type="number"
                        value={maxGuests}
                        onChange={e => setMaxGuests(Number(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <p className="-mt-2 text-xs text-muted-foreground">
                    Áp cho toàn bộ tour tạo lần này. Sửa riêng từng tour sau nếu cần.
                  </p>

                  <PlannedTable planned={planned} />
                </div>
              </div>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              {createdCount > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                  <Check className="size-4" />
                  Đã tạo {createdCount} tour.
                  <button
                    type="button"
                    onClick={() => list('tours')}
                    className="font-semibold underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Xem danh sách →
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <Button type="button" disabled={planned.length === 0 || creating} onClick={createAll}>
                  {creating ? <><Spinner /> Đang tạo…</> : `Tạo ${planned.length} tour`}
                </Button>
                <Button type="button" variant="outline" onClick={() => list('tours')}>
                  Quay lại danh sách
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {route && (
        <Modal
          open={editingRoute}
          onClose={() => setEditingRoute(false)}
          title={`Cung — ${route.name}`}
          description="Nội dung sửa ở đây dùng chung cho mọi tour của cung này. Bấm Lưu rồi Đóng khi xong."
          dismissible={false}
          className="top-4 left-4 h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none translate-x-0 translate-y-0"
        >
          <LocationForm mode="edit" recordId={route.id} onDone={() => setEditingRoute(false)} />
        </Modal>
      )}
    </div>
  );
}

/**
 * Exactly what the button is about to write. Ten tours is too many to undo by
 * hand, so nothing here should be a surprise — the travel date is shown even
 * though it is not stored, because that is the day the guests actually leave.
 */
function PlannedTable({
  planned,
}: {
  planned: { startDate: string; endDate: string; departDate: string; title: string }[];
}) {
  if (planned.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        Chưa chọn ngày nào.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Đi</th>
            <th className="px-3 py-2 font-semibold">Leo</th>
            <th className="px-3 py-2 font-semibold">Tên tour</th>
          </tr>
        </thead>
        <tbody>
          {planned.map(row => (
            <tr key={row.startDate} className="border-t border-border">
              <td className="px-3 py-2 text-muted-foreground">{formatDdMm(row.departDate)}</td>
              <td className="px-3 py-2 font-medium whitespace-nowrap">
                {formatDdMm(row.startDate)} – {formatDdMm(row.endDate)}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{row.title}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
