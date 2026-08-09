import { useEffect, useState } from 'react';
import { useForm } from '@refinedev/react-hook-form';
import { useList, useNavigation } from '@refinedev/core';
import { useFieldArray } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';
interface ItineraryDay { id?: number; day_number: number; title: string; title_en: string; content_md: string; content_md_en: string; }
interface TourFormData {
  title: string; summary: string; description_md: string; itinerary_md: string;
  title_en: string; summary_en: string; description_md_en: string; itinerary_md_en: string;
  start_date: string; end_date: string; price: string; location_id: number;
  max_guests: number; is_active: boolean;
  itinerary_days: ItineraryDay[];
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
  const { list, edit } = useNavigation();
  const { query: locationsQuery } = useList({ resource: 'locations', pagination: { pageSize: 100 } });

  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading, id },
    formState: { errors },
  } = useForm<TourFormData>({ refineCoreProps: { resource: 'tours' } });

  const { fields: dayFields, append: addDay, remove: removeDay } = useFieldArray({ control, name: 'itinerary_days' });

  const selectedLocationId = watch('location_id');

  const [loadingRelated, setLoadingRelated] = useState(mode === 'edit');
  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      const { data: days } = await supabase
        .from('tour_itinerary_days').select('*').eq('tour_id', id).order('day_number');
      if (days?.length) setValue('itinerary_days', days as ItineraryDay[]);
      setLoadingRelated(false);
    })();
  }, [id, mode, setValue]);

  async function handleSubmitWithRelated(data: TourFormData) {
    const { itinerary_days, ...tourData } = data;
    const result = await onFinish(tourData) as { data?: { id: number } } | undefined;
    const tourId = (result?.data?.id ?? id) as number;
    if (!tourId) return;

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

      {loadingRelated ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(handleSubmitWithRelated as never)} className="flex flex-col gap-5">

              <BilingualField
                label="Tiêu đề *"
                error={errors.title?.message as string}
                hint="Tiêu đề vào SEO title và hiện ở mọi danh sách tour — nên dịch."
                vi={<Input {...register('title', { required: 'Bắt buộc' })} />}
                en={<Input {...register('title_en')} placeholder={EN_PLACEHOLDER} />}
              />

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

              <BilingualField
                label="Tóm tắt"
                hint="Hiện ngay dưới tiêu đề ở trang booking — nên dịch."
                vi={<Textarea {...register('summary')} rows={2} />}
                en={<Textarea {...register('summary_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
              />
              <BilingualField
                label="Mô tả (Markdown)"
                vi={<Textarea {...register('description_md')} rows={5} className="font-mono" />}
                en={<Textarea {...register('description_md_en')} rows={5} className="font-mono" placeholder={EN_PLACEHOLDER} />}
              />
              <BilingualField
                label="Lịch trình tổng (Markdown)"
                vi={<Textarea {...register('itinerary_md')} rows={5} className="font-mono" />}
                en={<Textarea {...register('itinerary_md_en')} rows={5} className="font-mono" placeholder={EN_PLACEHOLDER} />}
              />

              {/* The gallery lives on the location now — every tour up the
                  same route shares it, so it is uploaded once over there. */}
              <hr className="border-border" />
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                Ảnh của tour lấy theo <strong className="font-semibold text-foreground">Cung</strong>.{' '}
                {selectedLocationId ? (
                  <button
                    type="button"
                    onClick={() => edit('locations', selectedLocationId)}
                    className="font-semibold text-primary underline-offset-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
                  >
                    Sửa ảnh của cung này →
                  </button>
                ) : (
                  'Chọn cung ở trên để quản lý ảnh.'
                )}
              </div>

              <hr className="border-border" />
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lịch trình ngày ({dayFields.length})</p>
                <Button type="button" variant="outline" size="sm" onClick={() => addDay({ day_number: dayFields.length + 1, title: '', title_en: '', content_md: '', content_md_en: '' })} className="border-dashed border-primary text-primary hover:text-primary">+ Thêm ngày</Button>
              </div>
              {dayFields.map((field, i) => (
                <div key={field.id} className="border border-border rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex gap-2 items-center">
                    <span className="font-bold text-sm min-w-[60px]">Ngày {i + 1}</span>
                    <Input placeholder="Tiêu đề ngày (VI)" {...register(`itinerary_days.${i}.title`)} className="flex-1" />
                    <Input placeholder="Tiêu đề ngày (EN)" {...register(`itinerary_days.${i}.title_en`)} className="flex-1" />
                    <button type="button" onClick={() => removeDay(i)} className="text-destructive text-lg bg-transparent border-none cursor-pointer">×</button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Textarea placeholder="Nội dung VI (Markdown)" {...register(`itinerary_days.${i}.content_md`)} rows={4} className="font-mono" />
                    <Textarea placeholder="Nội dung EN (Markdown)" {...register(`itinerary_days.${i}.content_md_en`)} rows={4} className="font-mono" />
                  </div>
                </div>
              ))}

              <div className="flex gap-3 mt-2">
                <Button type="submit" disabled={formLoading}>{formLoading ? <><Spinner /> Đang lưu…</> : 'Lưu'}</Button>
                <Button type="button" variant="outline" onClick={() => list('tours')}>Hủy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
