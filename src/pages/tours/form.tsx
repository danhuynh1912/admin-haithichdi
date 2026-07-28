import { useEffect, useState } from 'react';
import { useForm } from '@refinedev/react-hook-form';
import { useList, useNavigation } from '@refinedev/core';
import { useFieldArray } from 'react-hook-form';
import { ImageUpload } from '@/components/ImageUpload';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
interface TourImage { id?: number; image_path: string; image_url: string; caption: string; sort_order: number; }
interface ItineraryDay { id?: number; day_number: number; title: string; content_md: string; }
interface TourFormData {
  title: string; summary: string; description_md: string; itinerary_md: string;
  start_date: string; end_date: string; price: string; location_id: number;
  max_guests: number; is_active: boolean;
  images: TourImage[]; itinerary_days: ItineraryDay[];
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

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export function TourForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list } = useNavigation();
  const { query: locationsQuery } = useList({ resource: 'locations', pagination: { pageSize: 100 } });

  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading, id },
    formState: { errors },
  } = useForm<TourFormData>({ refineCoreProps: { resource: 'tours' } });

  const { fields: imgFields, append: addImg, remove: removeImg } = useFieldArray({ control, name: 'images' });
  const { fields: dayFields, append: addDay, remove: removeDay } = useFieldArray({ control, name: 'itinerary_days' });

  const [loadingRelated, setLoadingRelated] = useState(mode === 'edit');
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      const [{ data: imgs }, { data: days }] = await Promise.all([
        supabase.from('tour_images').select('*').eq('tour_id', id).order('sort_order'),
        supabase.from('tour_itinerary_days').select('*').eq('tour_id', id).order('day_number'),
      ]);
      if (imgs?.length) setValue('images', imgs as TourImage[]);
      if (days?.length) setValue('itinerary_days', days as ItineraryDay[]);
      setLoadingRelated(false);
    })();
  }, [id, mode, setValue]);

  const imageValues = watch('images') ?? [];

  async function handleSubmitWithRelated(data: TourFormData) {
    const { images, itinerary_days, ...tourData } = data;
    const result = await onFinish(tourData) as { data?: { id: number } } | undefined;
    const tourId = (result?.data?.id ?? id) as number;
    if (!tourId) return;

    if (images?.length) {
      await supabase.from('tour_images').delete().eq('tour_id', tourId);
      await supabase.from('tour_images').insert(
        images.map(({ id: _id, ...img }, i) => ({ ...img, tour_id: tourId, sort_order: i }))
      );
    }
    if (itinerary_days?.length) {
      await supabase.from('tour_itinerary_days').delete().eq('tour_id', tourId);
      await supabase.from('tour_itinerary_days').insert(
        itinerary_days.map(({ id: _id, ...d }) => ({ ...d, tour_id: tourId }))
      );
    }
    list('tours');
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('tours')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Tour' : 'Sửa Tour'}</h2>
      </div>

      {loadingRelated ? <p className="text-muted-foreground">Đang tải…</p> : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(handleSubmitWithRelated as never)} className="flex flex-col gap-5">

              <Field label="Tiêu đề *" error={errors.title?.message as string}>
                <Input {...register('title', { required: 'Bắt buộc' })} />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Location *">
                  <select {...register('location_id', { required: true, valueAsNumber: true })} className={selectCls}>
                    <option value="">Chọn location…</option>
                    {((locationsQuery?.data?.data ?? []) as { id: number; name: string }[]).map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </Field>
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

              <Field label="Tóm tắt">
                <Textarea {...register('summary')} rows={2} />
              </Field>
              <Field label="Mô tả (Markdown)">
                <Textarea {...register('description_md')} rows={5} className="font-mono" />
              </Field>
              <Field label="Lịch trình tổng (Markdown)">
                <Textarea {...register('itinerary_md')} rows={5} className="font-mono" />
              </Field>

              <hr className="border-border" />
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Ảnh tour ({imgFields.length})</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addImg({ image_path: '', image_url: '', caption: '', sort_order: imgFields.length })} className="border-dashed border-primary text-primary hover:text-primary">+ Thêm ảnh</Button>
              </div>
              {imgFields.map((field, i) => (
                <div key={field.id} className="border border-border rounded-lg p-3 flex gap-3 items-start">
                  <ImageUpload
                    prefix="tours/images"
                    currentPath={imageValues[i]?.image_path}
                    currentUrl={imageValues[i]?.image_url}
                    onUploaded={key => setValue(`images.${i}.image_path`, key)}
                  />
                  <div className="flex-1 flex flex-col gap-2">
                    <Input placeholder="Hoặc URL ngoài" {...register(`images.${i}.image_url`)} />
                    <Input placeholder="Caption" {...register(`images.${i}.caption`)} />
                  </div>
                  <button type="button" onClick={() => removeImg(i)} className="text-destructive text-lg p-1 bg-transparent border-none cursor-pointer">×</button>
                </div>
              ))}

              <hr className="border-border" />
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch trình ngày ({dayFields.length})</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addDay({ day_number: dayFields.length + 1, title: '', content_md: '' })} className="border-dashed border-primary text-primary hover:text-primary">+ Thêm ngày</Button>
              </div>
              {dayFields.map((field, i) => (
                <div key={field.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-sm min-w-[60px]">Ngày {i + 1}</span>
                    <Input placeholder="Tiêu đề ngày" {...register(`itinerary_days.${i}.title`)} className="flex-1" />
                    <button type="button" onClick={() => removeDay(i)} className="text-destructive text-lg bg-transparent border-none cursor-pointer">×</button>
                  </div>
                  <Textarea placeholder="Nội dung (Markdown)" {...register(`itinerary_days.${i}.content_md`)} rows={4} className="font-mono" />
                </div>
              ))}

              <div className="flex gap-3 mt-2">
                <Button type="submit" disabled={formLoading}>{formLoading ? 'Đang lưu…' : 'Lưu'}</Button>
                <Button type="button" variant="outline" onClick={() => list('tours')}>Hủy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
