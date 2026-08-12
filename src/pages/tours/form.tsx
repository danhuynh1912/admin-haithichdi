import { useEffect, useRef, useState } from 'react';
import { useForm } from '@refinedev/react-hook-form';
import { useController } from 'react-hook-form';
import { useList, useNavigation } from '@refinedev/core';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SaveBar, useSavedFlash } from '@/components/SaveBar';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';
import { Modal } from '@/components/ui/dialog';
import { SimpleSelect } from '@/components/SimpleSelect';
import { LocationForm } from '@/pages/locations/form';
interface TourFormData {
  title: string; summary: string; description_md: string;
  title_en: string; summary_en: string; description_md_en: string;
  start_date: string; end_date: string; price: string; location_id: number;
  max_guests: number; is_active: boolean;
}

/** The columns a route carries as a starting point for its tours. */
interface RouteDefaults {
  id: number;
  name: string;
  default_summary: string;
  default_summary_en: string;
  default_description_md: string;
  default_description_md_en: string;
  default_price: string | null;
  default_max_guests: number;
}

/** The fields a tour may either inherit from its route or hold its own copy of. */
type InheritableField = 'summary' | 'description_md';

const ROUTE_SELECT =
  'id,name,default_summary,default_summary_en,default_description_md,' +
  'default_description_md_en,default_price,default_max_guests';

/** Stands in for "no route yet": a blank select value reads as unset. */
const NONE = 'none';

/** What a tour is called before anyone renames it. */
const autoTitle = (routeName: string) => `Chinh phục ${routeName}`;

/**
 * The route's copy, shown as-is so the admin can read what this tour will say
 * before saving. Nothing is copied into the tour until they ask to edit it.
 */
function InheritedField({
  label,
  vi,
  en,
  onEdit,
}: {
  label: string;
  vi: string;
  en: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Đang lấy từ cung</span>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Sửa riêng tour này
          </Button>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <ReadOnlyText code="VI" text={vi} />
        <ReadOnlyText code="EN" text={en || vi} fellBack={!en.trim()} />
      </div>
    </div>
  );
}

function ReadOnlyText({ code, text, fellBack = false }: { code: string; text: string; fellBack?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="w-fit rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {code}{fellBack && ' · theo tiếng Việt'}
      </span>
      <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        {text.trim() || '—'}
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

export function TourForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list, edit } = useNavigation();
  const { saved, flash } = useSavedFlash();
  const { query: locationsQuery } = useList<RouteDefaults>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    meta: { select: ROUTE_SELECT },
  });
  const routes = locationsQuery?.data?.data ?? [];
  // The <option> list has to exist before the record's location_id is written
  // into the <select>: assigning a value a browser has no matching option for
  // is silently discarded, and nothing reassigns it once the options arrive.
  // The tour would then look like it had no route while the form state held
  // one — every inherited field populated, the picker blank.
  const routesLoading = locationsQuery?.isLoading ?? false;

  const {
    register, handleSubmit, watch, setValue, control,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<TourFormData>({ refineCoreProps: { resource: 'tours' } });

  // The route picker is a popup rather than a native <select>, so it cannot be
  // registered — it is driven through the form's own controller instead.
  const { field: routeField } = useController({
    control, name: 'location_id', rules: { required: true },
  });
  const routeId = Number(routeField.value) || 0;
  const route = routes.find(r => r.id === routeId);

  // Read-only look at what the route contributes, so the tour can be reviewed
  // whole before saving without any of it being copied in.
  const routeFilter = routeId
    ? [{ field: 'location_id', operator: 'eq' as const, value: routeId }]
    : [];
  const enabled = { enabled: routeId > 0 };
  const { query: daysQuery } = useList<{ id: number; day_number: number; title: string }>({
    resource: 'location_itinerary_days',
    filters: routeFilter,
    sorters: [{ field: 'day_number', order: 'asc' }],
    pagination: { pageSize: 50 },
    queryOptions: enabled,
  });
  const { query: imagesQuery } = useList<{ id: number }>({
    resource: 'location_images',
    filters: routeFilter,
    pagination: { pageSize: 1 },
    queryOptions: enabled,
  });
  const routeDays = daysQuery?.data?.data ?? [];
  const routeImageCount = imagesQuery?.data?.total ?? 0;

  // Picking a route fills in the fields a departure must own outright. Only on
  // create, and the title is left alone once it has been renamed by hand —
  // switching route should not throw away a title someone typed.
  const lastRouteId = useRef<number | null>(null);
  useEffect(() => {
    if (mode !== 'create' || !route || lastRouteId.current === route.id) return;
    lastRouteId.current = route.id;

    const currentTitle = (watch('title') ?? '').trim();
    const isUntouched = currentTitle === '' || routes.some(r => autoTitle(r.name) === currentTitle);
    if (isUntouched) setValue('title', autoTitle(route.name));

    setValue('max_guests', route.default_max_guests ?? 20);
    if (route.default_price != null) setValue('price', String(route.default_price));
  }, [mode, route, routes, setValue, watch]);

  async function handleSubmitTour(data: TourFormData) {
    const result = await onFinish(data) as { data?: { id: number } } | undefined;
    // Saving stays on the record; a create still has to move to that record's
    // edit page, or pressing Lưu again would make a second tour.
    const created = result?.data?.id;
    if (mode === 'create' && created) edit('tours', created);
    else flash();
  }

  // A field is overridden when the tour holds its own text — empty means the
  // route supplies it, exactly how tours_resolved reads it in SQL. `editing`
  // is tracked separately so clearing the box to retype does not yank the
  // editor away mid-edit; only Huỷ closes it.
  const [editingRoute, setEditingRoute] = useState(false);
  const [editing, setEditing] = useState<Partial<Record<InheritableField, boolean>>>({});
  const isOverridden = (field: InheritableField) => Boolean(String(watch(field) ?? '').trim());
  const isEditing = (field: InheritableField) => Boolean(editing[field]) || isOverridden(field);

  /** Seed the tour's own copy from the route so there is something to edit. */
  function startOverride(field: InheritableField, viText: string, enText: string) {
    setEditing(prev => ({ ...prev, [field]: true }));
    setValue(field, viText as never, { shouldDirty: true });
    setValue(`${field}_en` as keyof TourFormData, enText as never, { shouldDirty: true });
  }

  /** Throw the tour's copy away and go back to reading the route's. */
  function cancelOverride(field: InheritableField, viText: string) {
    const current = String(watch(field) ?? '');
    if (current.trim() && current !== viText &&
        !confirm('Bỏ nội dung riêng của tour này và dùng lại nội dung của cung?')) {
      return;
    }
    setEditing(prev => ({ ...prev, [field]: false }));
    setValue(field, '' as never, { shouldDirty: true });
    setValue(`${field}_en` as keyof TourFormData, '' as never, { shouldDirty: true });
  }

  /**
   * Three states per field: the route has nothing to lend (plain editor), the
   * tour is reading the route (preview + "Sửa"), or the tour has its own copy
   * (editor + "Huỷ").
   */
  function renderInheritable(
    field: InheritableField,
    label: string,
    routeVi: string,
    routeEn: string,
    rows: number,
    mono = false,
  ) {
    const editor = (name: keyof TourFormData, placeholder?: string) => (
      <Textarea {...register(name)} rows={rows} className={mono ? 'font-mono' : undefined} placeholder={placeholder} />
    );

    if (!routeVi.trim()) {
      return (
        <BilingualField
          label={label}
          hint="Cung chưa có nội dung mặc định cho mục này — viết riêng cho tour này, hoặc điền vào cung để mọi tour sau đều dùng được."
          action={
            <button
              type="button"
              onClick={() => setEditingRoute(true)}
              className="text-xs font-semibold text-primary underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer text-left"
            >
              Sửa thông tin này ở cung {route?.name}
            </button>
          }
          vi={editor(field)}
          en={editor(`${field}_en` as keyof TourFormData, EN_PLACEHOLDER)}
        />
      );
    }

    if (!isEditing(field)) {
      return (
        <InheritedField
          label={label}
          vi={routeVi}
          en={routeEn}
          onEdit={() => startOverride(field, routeVi, routeEn)}
        />
      );
    }

    return (
      <BilingualField
        label={label}
        hint="Nội dung riêng của tour này. Huỷ để quay lại dùng của cung."
        action={
          <button
            type="button"
            onClick={() => cancelOverride(field, routeVi)}
            className="text-xs font-semibold text-primary underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
          >
            Huỷ · dùng lại của cung
          </button>
        }
        vi={editor(field)}
        en={editor(`${field}_en` as keyof TourFormData, EN_PLACEHOLDER)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('tours')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Tour' : 'Sửa Tour'}</h2>
      </div>

      {(mode === 'edit' && formLoading) || routesLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(handleSubmitTour as never)} className="flex flex-col gap-5">

              {/* The route decides what the rest of this form is even about —
                  title, price, capacity and every block of copy default from
                  it — so it is picked first and alone. */}
              <div className="flex flex-col gap-2 rounded-xl border-2 border-primary/30 bg-primary/5 p-4">
                <Label className="text-base font-bold">Cung *</Label>
                <p className="text-xs text-muted-foreground">
                  Chọn cung trước. Tên tour, giá, số khách và toàn bộ nội dung bên dưới
                  lấy mặc định từ cung.
                </p>
                <SimpleSelect
                  ariaLabel="Cung"
                  value={routeId ? String(routeId) : NONE}
                  onValueChange={next => routeField.onChange(next === NONE ? undefined : Number(next))}
                  options={[
                    { value: NONE, label: '— Chọn cung —' },
                    ...routes.map(l => ({ value: String(l.id), label: l.name })),
                  ]}
                  className="w-full text-base font-semibold data-[size=default]:h-12"
                />
              </div>

              {!routeId ? (
                <div className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  Chọn cung ở trên để bắt đầu tạo tour.
                </div>
              ) : (
              <>
              <BilingualField
                label="Tiêu đề *"
                error={errors.title?.message as string}
                hint="Tiêu đề vào SEO title và hiện ở mọi danh sách tour — nên dịch."
                vi={<Input {...register('title', { required: 'Bắt buộc' })} />}
                en={<Input {...register('title_en')} placeholder={EN_PLACEHOLDER} />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Field label="Số khách tối đa *">
                  <Input type="number" {...register('max_guests', { required: true, valueAsNumber: true })} />
                </Field>
                <Field label="Ngày đi">
                  <Input type="date" {...register('start_date')} />
                </Field>
                <Field label="Ngày về">
                  <Input type="date" {...register('end_date')} />
                </Field>
                <Field label="Giá (VND)">
                  <Input type="number" {...register('price')} />
                </Field>
                <Field label="Active">
                  <label className="flex items-center gap-2 pt-2 cursor-pointer">
                    <input type="checkbox" {...register('is_active')} defaultChecked className="w-4 h-4 accent-primary" />
                    <span className="text-sm">Nhận đặt tour</span>
                  </label>
                </Field>
              </div>

              {renderInheritable('summary', 'Tóm tắt', route?.default_summary ?? '', route?.default_summary_en ?? '', 2)}
              {renderInheritable('description_md', 'Mô tả (Markdown)', route?.default_description_md ?? '', route?.default_description_md_en ?? '', 5, true)}

              {/* Photos and the day-by-day plan belong to the route: every
                  departure walks the same trail, so they are edited once there.
                  Shown read-only here so the tour can be reviewed whole. */}
              <hr className="border-border" />
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground">
                    Ảnh và lịch trình theo ngày lấy theo{' '}
                    <strong className="font-semibold text-foreground">Cung</strong>
                    {route ? ` — ${route.name}` : ''}.
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingRoute(true)}
                    className="font-semibold text-primary underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Sửa thông tin cung này →
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <p className={routeImageCount === 0 ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'}>
                    {routeImageCount === 0
                      ? 'Cung này chưa có ảnh nào — trang booking sẽ không có thư viện ảnh.'
                      : `${routeImageCount} ảnh trong thư viện của cung.`}
                  </p>
                  {routeDays.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Cung này chưa có lịch trình theo ngày.</p>
                  ) : (
                    <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
                      {routeDays.map((d, i) => (
                        <li key={d.id}>
                          <span className="font-semibold text-foreground">Ngày {i + 1}</span>
                          {d.title ? ` — ${d.title}` : ''}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
              </>
              )}

              <SaveBar
                busy={formLoading || !routeId}
                saved={saved}
                onCancel={() => list('tours')}
              />
            </form>
          </CardContent>
        </Card>
      )}

      {/* Editing the route without leaving the tour. Navigating to
          /locations/edit/:id would throw away everything typed here, which is
          exactly what someone hits when they discover mid-form that the route
          has no default text yet. */}
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
