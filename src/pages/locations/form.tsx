import { useEffect, useState } from 'react';
import { useForm } from '@refinedev/react-hook-form';
import { useInvalidate, useNavigation } from '@refinedev/core';
import { useFieldArray } from 'react-hook-form';
import { ImageUpload } from '@/components/ImageUpload';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SaveBar, useSavedFlash } from '@/components/SaveBar';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';
import { StringListEditor } from '@/components/StringListEditor';
import { durationLabel, itineraryRowsNeeded, type RouteDuration } from '@/lib/duration';

/** One photo in the route's gallery — shared by every tour up that route. */
interface LocationImage {
  id?: number;
  image_path: string;
  image_url: string;
  caption: string;
  caption_en: string;
  sort_order: number;
}

/** One day of the walk. Shared by every tour up the route, like the gallery. */
interface LocationDay {
  id?: number;
  day_number: number;
  title: string;
  title_en: string;
  content_md: string;
  content_md_en: string;
}

interface LocationFormData {
  images: LocationImage[];
  itinerary_days: LocationDay[];
  default_summary: string;
  default_summary_en: string;
  default_description_md: string;
  default_description_md_en: string;
  /** What the tour price covers, and what it does not. One short line each,
   *  in display order — see StringListEditor. */
  price_includes: string[];
  price_excludes: string[];
  price_includes_en: string[];
  price_excludes_en: string[];
  default_price: string;
  default_max_guests: number;
  default_trek_days: number;
  /** Not edited here — read only so the summary below the field can be honest. */
  default_lead_nights: number;
  name: string;
  elevation_m: number;
  image_path: string;
  image_url: string;
  quotation_path: string;
  description: string;
  description_en: string;
  home_feature_order: number | null;
}

/** Drops blank rows and trims the rest, so the array matches what is shown. */
function cleanLines(lines: string[] | undefined): string[] {
  return (lines ?? []).map(line => line.trim()).filter(Boolean);
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

/**
 * @param recordId  Which route to edit. Only needed away from `/locations/edit/:id`,
 *                  where refine reads the id off the route itself.
 * @param onDone    Present when the form is embedded in a dialog: it replaces the
 *                  page chrome — no back link, no card, and "Đóng" instead of
 *                  "Quay lại danh sách" — and saving stays put rather than
 *                  navigating, since the caller is still mid-edit behind it.
 */
export function LocationForm({
  mode,
  recordId,
  onDone,
}: {
  mode: 'create' | 'edit';
  recordId?: number;
  onDone?: () => void;
}) {
  const { list, edit } = useNavigation();
  const invalidate = useInvalidate();
  const { saved, flash } = useSavedFlash();
  const embedded = Boolean(onDone);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    refineCore: { onFinish, formLoading, id },
    formState: { errors },
  } = useForm<LocationFormData>({
    refineCoreProps: recordId
      ? { resource: 'locations', action: 'edit', id: recordId }
      : { resource: 'locations' },
  });

  const { fields: imgFields, append: addImg, remove: removeImg } =
    useFieldArray({ control, name: 'images' });
  const { fields: dayFields, append: addDay, remove: removeDay } =
    useFieldArray({ control, name: 'itinerary_days' });

  const imagePath = watch('image_path');
  const imageUrl = watch('image_url');
  const quotationPath = watch('quotation_path');
  const imageValues = watch('images') ?? [];
  const priceIncludes = watch('price_includes') ?? [];
  const priceExcludes = watch('price_excludes') ?? [];
  const priceIncludesEn = watch('price_includes_en') ?? [];
  const priceExcludesEn = watch('price_excludes_en') ?? [];

  // Read live so the summary under the field tracks what is being typed. Lead
  // nights are not editable here: every route today leaves the evening before,
  // and the column exists so the exception is an update rather than a release.
  const leadNights = Number(watch('default_lead_nights'));
  const duration: RouteDuration = {
    trekDays: Number(watch('default_trek_days')) || 0,
    leadNights: Number.isFinite(leadNights) ? leadNights : 1,
  };

  // The gallery is a separate table, so refine's form cannot load or save it —
  // both halves are done by hand here, mirroring what the tour form used to do.
  const [loadingRelated, setLoadingRelated] = useState(mode === 'edit');
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      const [{ data: imgs }, { data: days }] = await Promise.all([
        supabase.from('location_images').select('*').eq('location_id', id).order('sort_order'),
        supabase.from('location_itinerary_days').select('*').eq('location_id', id).order('day_number'),
      ]);
      if (imgs?.length) setValue('images', imgs as LocationImage[]);
      if (days?.length) setValue('itinerary_days', days as LocationDay[]);
      setLoadingRelated(false);
    })();
  }, [id, mode, setValue]);

  async function handleSubmitWithRelated(data: LocationFormData) {
    const { images, itinerary_days, ...locationData } = data;
    const result = await onFinish({
      ...locationData,
      default_price: locationData.default_price === '' ? null : locationData.default_price,
      // The columns are NOT NULL text[]: a route nobody has filled in yet is an
      // empty list, never null. Blank rows are dropped here rather than being
      // stored and rendered as an empty bullet.
      price_includes: cleanLines(locationData.price_includes),
      price_excludes: cleanLines(locationData.price_excludes),
      price_includes_en: cleanLines(locationData.price_includes_en),
      price_excludes_en: cleanLines(locationData.price_excludes_en),
    }) as { data?: { id: number } } | undefined;
    const locationId = (result?.data?.id ?? id) as number;
    if (!locationId) return;

    // Both are replaced wholesale: position in the form is what defines
    // sort_order and day_number, so a reorder or a deletion has to rewrite the
    // whole set anyway.
    await supabase.from('location_images').delete().eq('location_id', locationId);
    if (images?.length) {
      await supabase.from('location_images').insert(
        images
          .filter(img => img.image_path?.trim() || img.image_url?.trim())
          .map(({ id: _id, ...img }, i) => ({ ...img, location_id: locationId, sort_order: i })),
      );
    }

    await supabase.from('location_itinerary_days').delete().eq('location_id', locationId);
    if (itinerary_days?.length) {
      await supabase.from('location_itinerary_days').insert(
        itinerary_days.map(({ id: _id, ...d }, i) => ({ ...d, location_id: locationId, day_number: i + 1 })),
      );
    }

    // These two tables are written straight through supabase, so refine never
    // learns they changed. A tour form open behind this dialog is reading both
    // to preview what the route lends it, and would otherwise keep showing the
    // gallery and the itinerary as they were before this save.
    invalidate({ resource: 'location_images', invalidates: ['list'] });
    invalidate({ resource: 'location_itinerary_days', invalidates: ['list'] });

    // Saving stays on the record. A create has to move to that record's edit
    // page even so, or the form is still in create mode and pressing Lưu again
    // would make a second copy — except in a dialog, where navigating would
    // take the page underneath with it.
    if (mode === 'create' && !embedded) edit('locations', locationId);
    else flash();
  }

  const loading = mode === 'edit' && (formLoading || loadingRelated);

  return (
    <div className={embedded ? undefined : 'p-6'}>
      {!embedded && (
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" onClick={() => list('locations')}>← Quay lại</Button>
          <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Location' : 'Sửa Location'}</h2>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
      <Shell embedded={embedded}>
          <form
            // A portalled dialog still sits inside its opener in the React tree,
            // so this submit would bubble to the tour form behind it and create
            // a tour every time a route is saved.
            onSubmit={event => { event.stopPropagation(); handleSubmit(handleSubmitWithRelated as never)(event); }}
            className="flex flex-col gap-5"
          >
            <Field label="Tên *" error={errors.name?.message as string}>
              <Input {...register('name', { required: 'Bắt buộc' })} />
            </Field>

            <Field label="Độ cao (m) *" error={errors.elevation_m?.message as string}>
              <Input type="number" {...register('elevation_m', { required: 'Bắt buộc', valueAsNumber: true })} />
            </Field>

            <BilingualField
              label="Mô tả"
              vi={<Textarea {...register('description')} rows={3} />}
              en={<Textarea {...register('description_en')} rows={3} placeholder={EN_PLACEHOLDER} />}
            />

            <ImageUpload
              prefix="locations/images"
              currentPath={imagePath}
              currentUrl={imageUrl}
              onUploaded={key => setValue('image_path', key)}
              label="Ảnh đại diện"
              field={register('image_path')}
            />
            <Field label="Hoặc dùng URL ảnh ngoài">
              <Input type="url" {...register('image_url')} placeholder="https://..." />
            </Field>

            <hr className="border-border" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Thư viện ảnh ({imgFields.length})
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Dùng chung cho mọi tour thuộc cung này — chỉ cần upload một lần.
              </p>
            </div>
            {imgFields.map((field, i) => (
              <div key={field.id} className="border border-border rounded-lg p-3 flex gap-3 items-start">
                <ImageUpload
                  prefix="locations/images"
                  currentPath={imageValues[i]?.image_path}
                  currentUrl={imageValues[i]?.image_url}
                  onUploaded={key => setValue(`images.${i}.image_path`, key)}
                  field={register(`images.${i}.image_path`)}
                />
                <div className="flex-1 flex flex-col gap-2">
                  <Input placeholder="Hoặc URL ngoài" {...register(`images.${i}.image_url`)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Caption (VI)" {...register(`images.${i}.caption`)} />
                    <Input placeholder="Caption (EN)" {...register(`images.${i}.caption_en`)} />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeImg(i)}
                  className="text-destructive text-lg p-1 bg-transparent border-none cursor-pointer"
                  aria-label="Xoá ảnh"
                >
                  ×
                </button>
              </div>
            ))}

            {/* Below the list, not beside the heading: a route with a dozen
                photos otherwise means scrolling back up to add the thirteenth. */}
            <Button
              type="button"
              variant="outline"
              onClick={() => addImg({ image_path: '', image_url: '', caption: '', caption_en: '', sort_order: imgFields.length })}
              className="w-full border-dashed border-primary text-primary hover:text-primary"
            >
              + Thêm ảnh
            </Button>

            <hr className="border-border" />
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mặc định cho tour
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tour thuộc cung này để trống ô nào thì lấy nội dung ở đây. Sửa một lần,
                mọi tour chưa ghi đè đổi theo.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Giá mặc định (VND)">
                <Input type="number" {...register('default_price')} placeholder="—" />
              </Field>
              <Field label="Số khách tối đa mặc định">
                <Input type="number" {...register('default_max_guests', { valueAsNumber: true })} placeholder="20" />
              </Field>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Hai giá trị này chỉ được điền sẵn khi tạo tour mới, sau đó tour tự quản —
              sửa ở đây không làm đổi giá tour đã tạo.
            </p>

            <Field label="Số ngày leo" error={errors.default_trek_days?.message as string}>
              <Input
                type="number"
                min={0}
                max={30}
                className="w-24"
                {...register('default_trek_days', { valueAsNumber: true })}
              />
            </Field>
            <DurationSummary duration={duration} itineraryRows={dayFields.length} />

            <BilingualField
              label="Tóm tắt mặc định"
              vi={<Textarea {...register('default_summary')} rows={2} />}
              en={<Textarea {...register('default_summary_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
            />
            <BilingualField
              label="Mô tả mặc định (Markdown)"
              vi={<Textarea {...register('default_description_md')} rows={5} className="font-mono" />}
              en={<Textarea {...register('default_description_md_en')} rows={5} className="font-mono" placeholder={EN_PLACEHOLDER} />}
            />
            <BilingualField
              label="Giá tour đã bao gồm"
              hint="Mỗi dòng một mục. Hiện thành cột ✓ ở trang cung và trang tour, ngay dưới phần mô tả."
              vi={
                <StringListEditor
                  value={priceIncludes}
                  onChange={next => setValue('price_includes', next, { shouldDirty: true })}
                  placeholder="VD: Xe đưa đón 2 chiều Hà Nội - điểm leo"
                  addLabel="+ Thêm mục đã bao gồm"
                />
              }
              en={
                <StringListEditor
                  value={priceIncludesEn}
                  onChange={next => setValue('price_includes_en', next, { shouldDirty: true })}
                  placeholder={EN_PLACEHOLDER}
                  addLabel="+ Add included item"
                />
              }
            />

            <BilingualField
              label="Chi phí chưa bao gồm"
              hint="Ghi rõ mức tiền nếu có (VD: xe ôm 150K/chiều) — đây là chỗ khách hay thắc mắc nhất."
              vi={
                <StringListEditor
                  value={priceExcludes}
                  onChange={next => setValue('price_excludes', next, { shouldDirty: true })}
                  placeholder="VD: Tiền tip porter/leader (nếu có)"
                  addLabel="+ Thêm mục chưa bao gồm"
                />
              }
              en={
                <StringListEditor
                  value={priceExcludesEn}
                  onChange={next => setValue('price_excludes_en', next, { shouldDirty: true })}
                  placeholder={EN_PLACEHOLDER}
                  addLabel="+ Add excluded item"
                />
              }
            />

            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Lịch trình ngày ({dayFields.length})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ngày cụ thể trên trang booking tính từ ngày khởi hành của từng tour.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addDay({ day_number: dayFields.length + 1, title: '', title_en: '', content_md: '', content_md_en: '' })}
                className="border-dashed border-primary text-primary hover:text-primary"
              >
                + Thêm ngày
              </Button>
            </div>
            {dayFields.map((field, i) => (
              <div key={field.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex gap-2 items-center">
                  {/* Numbered from 0 to match the public page, where the first
                      entry is the travel-in day. The stored day_number stays
                      1-based; only the label shifts. */}
                  <span className="font-bold text-sm min-w-[60px]">Ngày {i}</span>
                  <Input placeholder="Tiêu đề ngày (VI)" {...register(`itinerary_days.${i}.title`)} className="flex-1" />
                  <Input placeholder="Tiêu đề ngày (EN)" {...register(`itinerary_days.${i}.title_en`)} className="flex-1" />
                  <button
                    type="button"
                    onClick={() => removeDay(i)}
                    className="text-destructive text-lg bg-transparent border-none cursor-pointer"
                    aria-label="Xoá ngày"
                  >
                    ×
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <Textarea placeholder="Nội dung VI (Markdown)" {...register(`itinerary_days.${i}.content_md`)} rows={4} className="font-mono" />
                  <Textarea placeholder="Nội dung EN (Markdown)" {...register(`itinerary_days.${i}.content_md_en`)} rows={4} className="font-mono" />
                </div>
              </div>
            ))}

            <hr className="border-border" />

            <Field label="File PDF báo giá">
              {quotationPath && <span className="text-xs text-green-700">✓ {quotationPath}</span>}
              <ImageUpload
                prefix="locations/quotations"
                currentPath={quotationPath}
                currentUrl={null}
                onUploaded={key => setValue('quotation_path', key)}
                accept="application/pdf"
                label="Upload PDF"
                field={register('quotation_path')}
              />
            </Field>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trang chủ</p>

            {/* No upper bound: this number orders the whole route carousel on
                the home page, not just the four featured cards. The featured
                block takes the first four of this same order. */}
            <Field label="Thứ tự hiển thị ở trang chủ">
              <Input
                type="number"
                min={1}
                className="w-20"
                {...register('home_feature_order', {
                  setValueAs: v => (v === '' || v === null ? null : Number(v)),
                })}
              />
              <span className="text-xs text-muted-foreground">
                Số nhỏ hiện trước. Để trống thì cung xếp sau cùng theo thứ tự tên.
                Bốn cung có số nhỏ nhất cũng là 4 thẻ “Cung nổi bật”.
              </span>
            </Field>

            <SaveBar
              busy={formLoading}
              saved={saved}
              onCancel={onDone ?? (() => list('locations'))}
              cancelLabel={embedded ? 'Đóng' : undefined}
            />
          </form>
      </Shell>
      )}
    </div>
  );
}

/**
 * Says out loud what the number above it means, and whether the day rows
 * agree with it.
 *
 * Two places describe the same trip — this field and the itinerary — and
 * letting them disagree quietly is exactly what put one tour's last day after
 * its own return date.
 */
function DurationSummary({
  duration,
  itineraryRows,
}: {
  duration: RouteDuration;
  itineraryRows: number;
}) {
  if (duration.trekDays <= 0) {
    return (
      <p className="-mt-2 text-xs text-muted-foreground">
        Chưa khai báo số ngày leo — cung này chưa tạo tour hàng loạt được.
      </p>
    );
  }

  const needed = itineraryRowsNeeded(duration);
  const agrees = needed === itineraryRows;

  return (
    <div className="-mt-2 flex flex-col gap-1 text-xs">
      <p className="text-muted-foreground">
        <strong className="font-semibold text-foreground">{durationLabel(duration)}</strong>
        {' · '}khởi hành tối hôm trước, ngày di chuyển không tính vào nhãn này
      </p>
      <p className={agrees ? 'text-muted-foreground' : 'font-medium text-destructive'}>
        Lịch trình cần {needed} dòng ({duration.leadNights} di chuyển +{' '}
        {duration.trekDays} ngày leo) — đang có {itineraryRows}.
      </p>
    </div>
  );
}

/** The card the form sits in on its own page, and nothing at all inside a dialog. */
function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return (
    <Card>
      <CardContent className="pt-6">{children}</CardContent>
    </Card>
  );
}
