import { useForm } from '@refinedev/react-hook-form';
import { useNavigation } from '@refinedev/core';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';

interface LocationFormData {
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
    setValue,
    watch,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<LocationFormData>({ refineCoreProps: { resource: 'locations' } });

  const imagePath = watch('image_path');
  const imageUrl = watch('image_url');
  const quotationPath = watch('quotation_path');

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('locations')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Location' : 'Sửa Location'}</h2>
      </div>

      {mode === 'edit' && formLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onFinish)} className="flex flex-col gap-5">
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
