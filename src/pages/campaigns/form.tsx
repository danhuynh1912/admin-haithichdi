import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from '@refinedev/react-hook-form';
import { useList, useNavigation } from '@refinedev/core';
import { useController } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { slugifyTitle } from '@/lib/utils';
import { ImageUpload } from '@/components/ImageUpload';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { SaveBar, useSavedFlash } from '@/components/SaveBar';

interface CampaignFormData {
  slug: string;
  is_published: boolean;
  is_closed: boolean;
  title: string; title_en: string;
  summary: string; summary_en: string;
  body_md: string; body_md_en: string;
  donate_md: string; donate_md_en: string;
  result_md: string; result_md_en: string;
  poster_path: string; poster_url: string;
  poster_alt: string; poster_alt_en: string;
}

interface RouteRow {
  id: number;
  name: string;
  default_trek_days: number | null;
}

/** One outing a campaign is raising through: a route and the days it runs. */
interface CampaignDate {
  location_id: number | '';
  start_date: string;
  end_date: string;
}

/** One figure counted up on the public page. */
interface Stat { label: string; label_en: string; value: string }

interface GalleryImage { image_path: string; caption: string; caption_en: string }

const selectCls =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

/** `2026-09-19` + 2 days → `2026-09-20`, so the end date fills itself in. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return '';
  const end = new Date(y, m - 1, d + days);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
}

export function CampaignForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list, edit } = useNavigation();
  const { saved, flash } = useSavedFlash();
  const { id } = useParams<{ id: string }>();

  const { query: routesQuery } = useList<RouteRow>({
    resource: 'locations',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'name', order: 'asc' }],
    meta: { select: 'id,name,default_trek_days' },
  });
  const routes = routesQuery?.data?.data ?? [];

  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<CampaignFormData>({
    refineCoreProps: mode === 'edit'
      ? { resource: 'campaigns', action: 'edit', id }
      : { resource: 'campaigns', action: 'create' },
    defaultValues: {
      is_published: false, is_closed: false,
      body_md: '', body_md_en: '', result_md: '', result_md_en: '',
      donate_md: '', donate_md_en: '',
    },
  });

  const { field: bodyVi } = useController({ control, name: 'body_md', defaultValue: '' });
  const { field: bodyEn } = useController({ control, name: 'body_md_en', defaultValue: '' });
  const { field: resultVi } = useController({ control, name: 'result_md', defaultValue: '' });
  const { field: resultEn } = useController({ control, name: 'result_md_en', defaultValue: '' });

  const [dates, setDates] = useState<CampaignDate[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const slug = watch('slug');
  const posterPath = watch('poster_path');
  const posterUrl = watch('poster_url');
  const isPublished = watch('is_published');
  const isClosed = watch('is_closed');

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      const [{ data: linked }, { data: gallery }, { data: row }] = await Promise.all([
        supabase.from('campaign_dates').select('location_id,start_date,end_date')
          .eq('campaign_id', id).order('sort_order'),
        supabase.from('campaign_images').select('image_path,caption,caption_en')
          .eq('campaign_id', id).order('sort_order'),
        supabase.from('campaigns').select('result_stats').eq('id', id).single(),
      ]);
      setDates((linked ?? []).map(r => ({
        location_id: r.location_id as number,
        start_date: (r.start_date as string) ?? '',
        end_date: (r.end_date as string) ?? '',
      })));
      setImages((gallery ?? []) as GalleryImage[]);
      setStats(((row?.result_stats ?? []) as Stat[]).map(s => ({
        label: s.label ?? '', label_en: s.label_en ?? '', value: s.value ?? '',
      })));
      setLoadingRelated(false);
    })();
  }, [id, mode]);

  // The slug follows the title until it is published; after that it is the URL
  // people have shared, so it stops moving.
  const slugTouched = useRef(false);
  const title = watch('title');
  useEffect(() => {
    if (mode !== 'create' || slugTouched.current) return;
    setValue('slug', slugifyTitle(title ?? ''));
  }, [title, mode, setValue]);

  const setDate = (index: number, patch: Partial<CampaignDate>) =>
    setDates(prev => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));

  /** Picking a route fills the end date in from how long it takes. */
  const pickRoute = (index: number, locationId: number) => {
    const days = routes.find(r => r.id === locationId)?.default_trek_days ?? 1;
    const start = dates[index]?.start_date;
    setDate(index, {
      location_id: locationId,
      end_date: start && days > 1 ? addDays(start, days - 1) : dates[index]?.end_date ?? '',
    });
  };

  async function onSubmit(raw: Record<string, unknown>) {
    const values = raw as unknown as CampaignFormData;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const result = await onFinish({
        ...values,
        // Blank rows are what a repeatable editor leaves behind; they would
        // render as an empty statistic on the public page.
        result_stats: stats.filter(s => s.value.trim() && s.label.trim()),
      }) as { data?: { id: number } } | undefined;

      const campaignId = (result?.data?.id ?? id) as number;
      if (!campaignId) return;

      await supabase.from('campaign_dates').delete().eq('campaign_id', campaignId);
      // Half-filled rows are what a repeatable editor leaves behind.
      const usable = dates.filter(d => d.location_id !== '' && d.start_date);
      if (usable.length) {
        await supabase.from('campaign_dates').insert(
          usable.map((d, sort_order) => ({
            campaign_id: campaignId,
            location_id: d.location_id,
            start_date: d.start_date,
            end_date: d.end_date || null,
            sort_order,
          })),
        );
      }

      await supabase.from('campaign_images').delete().eq('campaign_id', campaignId);
      const rows = images.filter(i => i.image_path.trim());
      if (rows.length) {
        await supabase.from('campaign_images').insert(
          rows.map((image, sort_order) => ({ campaign_id: campaignId, sort_order, ...image })),
        );
      }

      if (mode === 'create') edit('campaigns', campaignId);
      else flash();
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = formLoading || submitting;

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('campaigns')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">
          {mode === 'create' ? 'Chiến dịch mới' : 'Sửa chiến dịch'}
        </h2>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {mode === 'edit' && (formLoading || loadingRelated) ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Spinner /> Đang tải…
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

              <BilingualField
                label="Tên chiến dịch *"
                error={errors.title?.message as string}
                vi={<Input {...register('title', { required: 'Bắt buộc' })} />}
                en={<Input {...register('title_en')} placeholder={EN_PLACEHOLDER} />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Slug *"
                  error={errors.slug?.message as string}
                  hint={isPublished
                    ? 'Đang hiện — đổi slug là gãy mọi link đã chia sẻ.'
                    : 'Tự sinh từ tên. Chỉ a-z, 0-9 và dấu gạch ngang.'}
                >
                  <Input {...register('slug', {
                    required: 'Bắt buộc',
                    pattern: {
                      value: /^[a-z0-9]+(-[a-z0-9]+)*$/,
                      message: 'Chỉ a-z, 0-9, phân tách bằng dấu gạch ngang',
                    },
                    onChange: () => { slugTouched.current = true; },
                  })} />
                </Field>
                <Field label="URL công khai">
                  <p className="pt-2 text-sm text-muted-foreground break-all">
                    /thien-nguyen/{slug || '…'}
                  </p>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Hiện trên web" hint="Tắt là nháp — không ai ngoài admin thấy.">
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      ariaLabel="Hiện chiến dịch trên web"
                      checked={isPublished}
                      onCheckedChange={v => setValue('is_published', v)}
                    />
                    <span className="text-sm">{isPublished ? 'Đang hiện' : 'Nháp'}</span>
                  </div>
                </Field>
                <Field
                  label="Đã kết thúc"
                  hint="Bình thường không cần bật: chiến dịch tự đóng khi chuyến cuối đi xong. Chỉ dùng khi chiến dịch không gắn chuyến nào, hoặc muốn đóng sớm."
                >
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      ariaLabel="Đánh dấu chiến dịch đã kết thúc"
                      checked={isClosed}
                      onCheckedChange={v => setValue('is_closed', v)}
                    />
                    <span className="text-sm">{isClosed ? 'Đã kết thúc' : 'Theo lịch chuyến'}</span>
                  </div>
                </Field>
              </div>

              <BilingualField
                label="Tóm tắt"
                hint="2–3 câu hiện trên thẻ và dưới kết quả tìm kiếm của Google."
                vi={<Textarea {...register('summary')} rows={3} />}
                en={<Textarea {...register('summary_en')} rows={3} placeholder={EN_PLACEHOLDER} />}
              />

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Ảnh bìa
              </p>
              <ImageUpload
                prefix="campaigns/posters"
                currentPath={posterPath}
                currentUrl={posterUrl}
                onUploaded={key => setValue('poster_path', key)}
                label="Poster"
                field={register('poster_path')}
              />
              <BilingualField
                label="Mô tả ảnh (alt)"
                vi={<Input {...register('poster_alt')} />}
                en={<Input {...register('poster_alt_en')} placeholder={EN_PLACEHOLDER} />}
              />

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Các chuyến của chiến dịch
              </p>
              <p className="text-xs text-muted-foreground -mt-3">
                Cung và ngày đi. Chọn cung xong thì ngày về tự tính theo số ngày của cung, sửa
                lại được. Chiến dịch tự đóng khi chuyến cuối cùng đi xong; không có chuyến nào
                thì dùng công tắc “Đã kết thúc” ở trên.
              </p>
              <div className="flex flex-col gap-2">
                {dates.map((date, index) => (
                  <div key={index} className="grid grid-cols-[1fr_10rem_10rem_auto] items-center gap-2">
                    <select
                      value={date.location_id}
                      onChange={e => pickRoute(index, Number(e.target.value))}
                      className={selectCls}
                    >
                      <option value="">— Chọn cung —</option>
                      {routes.map(route => (
                        <option key={route.id} value={route.id}>{route.name}</option>
                      ))}
                    </select>
                    <Input
                      type="date"
                      value={date.start_date}
                      onChange={e => {
                        const start = e.target.value;
                        const days = routes.find(r => r.id === date.location_id)?.default_trek_days ?? 1;
                        setDate(index, {
                          start_date: start,
                          end_date: start && days > 1 ? addDays(start, days - 1) : date.end_date,
                        });
                      }}
                    />
                    <Input
                      type="date"
                      value={date.end_date}
                      onChange={e => setDate(index, { end_date: e.target.value })}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDates(dates.filter((_, i) => i !== index))}
                    >
                      Xoá
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={() => setDates([...dates, { location_id: '', start_date: '', end_date: '' }])}
                >
                  + Thêm chuyến
                </Button>
              </div>

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lời kêu gọi
              </p>
              <p className="text-xs text-muted-foreground -mt-3">
                Chính là nội dung bài đăng Facebook. Khi đã viết phần kết quả bên dưới, phần này
                sẽ tự động không hiện nữa.
              </p>
              <BilingualField
                label="Nội dung"
                vi={<MarkdownEditor value={bodyVi.value ?? ''} onChange={bodyVi.onChange} />}
                en={<MarkdownEditor value={bodyEn.value ?? ''} onChange={bodyEn.onChange} />}
              />
              <BilingualField
                label="Ghi chú ủng hộ"
                hint="Cần gì, không cần gì. Nút nhắn Zalo và Facebook đã có sẵn trên trang."
                vi={<Textarea {...register('donate_md')} rows={2} />}
                en={<Textarea {...register('donate_md_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
              />

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kết quả
              </p>
              <p className="text-xs text-muted-foreground -mt-3">
                Viết sau khi chiến dịch xong. Đây là phần thuyết phục người sau nhất — và khi có
                nó, lời kêu gọi ở trên sẽ được thay thế hoàn toàn.
              </p>
              <StatsEditor stats={stats} onChange={setStats} />
              <BilingualField
                label="Tường thuật"
                vi={<MarkdownEditor value={resultVi.value ?? ''} onChange={resultVi.onChange} />}
                en={<MarkdownEditor value={resultEn.value ?? ''} onChange={resultEn.onChange} />}
              />

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Kho ảnh
              </p>
              <GalleryEditor images={images} onChange={setImages} />

              <SaveBar busy={busy} saved={saved} onCancel={() => list('campaigns')} />
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** The two or three figures counted up on the public page. */
function StatsEditor({ stats, onChange }: { stats: Stat[]; onChange: (next: Stat[]) => void }) {
  const set = (index: number, patch: Partial<Stat>) =>
    onChange(stats.map((s, i) => (i === index ? { ...s, ...patch } : s)));

  return (
    <div className="flex flex-col gap-2">
      <Label>Con số</Label>
      <span className="text-xs text-muted-foreground -mt-1">
        Tối đa 3 con số, hiện to và chạy số trên trang. VD: 120 / phần quà.
      </span>
      {stats.map((stat, index) => (
        <div key={index} className="grid grid-cols-[7rem_1fr_1fr_auto] gap-2 items-center">
          <Input
            value={stat.value}
            onChange={e => set(index, { value: e.target.value })}
            placeholder="120"
          />
          <Input
            value={stat.label}
            onChange={e => set(index, { label: e.target.value })}
            placeholder="phần quà"
          />
          <Input
            value={stat.label_en}
            onChange={e => set(index, { label_en: e.target.value })}
            placeholder={EN_PLACEHOLDER}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(stats.filter((_, i) => i !== index))}
          >
            Xoá
          </Button>
        </div>
      ))}
      {stats.length < 3 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => onChange([...stats, { label: '', label_en: '', value: '' }])}
        >
          + Thêm con số
        </Button>
      )}
    </div>
  );
}

/** Photographs from the trip, shown with the result. */
function GalleryEditor({
  images,
  onChange,
}: {
  images: GalleryImage[];
  onChange: (next: GalleryImage[]) => void;
}) {
  const set = (index: number, patch: Partial<GalleryImage>) =>
    onChange(images.map((image, i) => (i === index ? { ...image, ...patch } : image)));

  return (
    <div className="flex flex-col gap-3">
      {images.map((image, index) => (
        <div key={index} className="grid grid-cols-[12rem_1fr_auto] gap-3 items-start rounded-md border border-border p-3">
          <ImageUpload
            prefix="campaigns/gallery"
            currentPath={image.image_path}
            currentUrl=""
            onUploaded={key => set(index, { image_path: key })}
            label={`Ảnh ${index + 1}`}
          />
          <div className="flex flex-col gap-2">
            <Input
              value={image.caption}
              onChange={e => set(index, { caption: e.target.value })}
              placeholder="Chú thích (tuỳ chọn)"
            />
            <Input
              value={image.caption_en}
              onChange={e => set(index, { caption_en: e.target.value })}
              placeholder={EN_PLACEHOLDER}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(images.filter((_, i) => i !== index))}
          >
            Xoá
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...images, { image_path: '', caption: '', caption_en: '' }])}
      >
        + Thêm ảnh
      </Button>
    </div>
  );
}
