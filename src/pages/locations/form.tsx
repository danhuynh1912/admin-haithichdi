import { useEffect, useState } from 'react';
import { useForm } from '@refinedev/react-hook-form';
import { useNavigation } from '@refinedev/core';
import { useFieldArray } from 'react-hook-form';
import { ImageUpload } from '@/components/ImageUpload';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';

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
  default_itinerary_md: string;
  default_itinerary_md_en: string;
  default_price: string;
  default_max_guests: number;
  name: string;
  elevation_m: number;
  image_path: string;
  image_url: string;
  quotation_path: string;
  description: string;
  home_display_name: string;
  home_subtitle: string;
  home_feature_summary: string;
  description_en: string;
  home_display_name_en: string;
  home_subtitle_en: string;
  home_feature_summary_en: string;
  home_feature_order: number | null;
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

export function LocationForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list } = useNavigation();
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    refineCore: { onFinish, formLoading, id },
    formState: { errors },
  } = useForm<LocationFormData>({ refineCoreProps: { resource: 'locations' } });

  const { fields: imgFields, append: addImg, remove: removeImg } =
    useFieldArray({ control, name: 'images' });
  const { fields: dayFields, append: addDay, remove: removeDay } =
    useFieldArray({ control, name: 'itinerary_days' });

  const imagePath = watch('image_path');
  const imageUrl = watch('image_url');
  const quotationPath = watch('quotation_path');
  const imageValues = watch('images') ?? [];

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
    list('locations');
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('locations')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Location' : 'Sửa Location'}</h2>
      </div>

      {mode === 'edit' && (formLoading || loadingRelated) ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(handleSubmitWithRelated as never)} className="flex flex-col gap-5">
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
            />
            <Field label="Hoặc dùng URL ảnh ngoài">
              <Input type="url" {...register('image_url')} placeholder="https://..." />
            </Field>

            <hr className="border-border" />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Thư viện ảnh ({imgFields.length})
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Dùng chung cho mọi tour thuộc cung này — chỉ cần upload một lần.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addImg({ image_path: '', image_url: '', caption: '', caption_en: '', sort_order: imgFields.length })}
                className="border-dashed border-primary text-primary hover:text-primary"
              >
                + Thêm ảnh
              </Button>
            </div>
            {imgFields.map((field, i) => (
              <div key={field.id} className="border border-border rounded-lg p-3 flex gap-3 items-start">
                <ImageUpload
                  prefix="locations/images"
                  currentPath={imageValues[i]?.image_path}
                  currentUrl={imageValues[i]?.image_url}
                  onUploaded={key => setValue(`images.${i}.image_path`, key)}
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

            <hr className="border-border" />

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
              label="Lịch trình tổng mặc định (Markdown)"
              vi={<Textarea {...register('default_itinerary_md')} rows={5} className="font-mono" />}
              en={<Textarea {...register('default_itinerary_md_en')} rows={5} className="font-mono" placeholder={EN_PLACEHOLDER} />}
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
                  <span className="font-bold text-sm min-w-[60px]">Ngày {i + 1}</span>
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
              />
            </Field>

            <hr className="border-border" />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trang chủ</p>

            <BilingualField
              label="Tên hiển thị trang chủ (để trống = dùng tên gốc)"
              vi={<Input {...register('home_display_name')} />}
              en={<Input {...register('home_display_name_en')} placeholder={EN_PLACEHOLDER} />}
            />

            <BilingualField
              label="Subtitle trang chủ"
              vi={<Input {...register('home_subtitle')} />}
              en={<Input {...register('home_subtitle_en')} placeholder={EN_PLACEHOLDER} />}
            />

            <BilingualField
              label="Tóm tắt trang chủ"
              vi={<Textarea {...register('home_feature_summary')} rows={2} />}
              en={<Textarea {...register('home_feature_summary_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
            />

            <Field label="Thứ tự featured (1–4, để trống = không hiển thị)">
              <Input
                type="number"
                min={1}
                max={4}
                className="w-20"
                {...register('home_feature_order', {
                  setValueAs: v => (v === '' || v === null ? null : Number(v)),
                })}
              />
            </Field>

            <div className="flex gap-3 mt-2">
              <Button type="submit" disabled={formLoading}>{formLoading ? <><Spinner /> Đang lưu…</> : 'Lưu'}</Button>
              <Button type="button" variant="outline" onClick={() => list('locations')}>Hủy</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}
    </div>
  );
}
