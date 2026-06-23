import { useForm } from '@refinedev/react-hook-form';
import { useNavigation } from '@refinedev/core';
import { useController } from 'react-hook-form';
import { ImageUpload } from '@/components/ImageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface LeaderFormData {
  full_name: string; display_role: string; bio: string; highlight: string;
  location: string; relationship_status: string; date_of_birth: string;
  years_experience: number; is_active: boolean;
  avatar_path: string; avatar_url: string; strengths: string[];
  role: string;
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

export function LeaderForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list } = useNavigation();
  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<LeaderFormData>({ refineCoreProps: { resource: 'leaders' } });

  const avatarPath = watch('avatar_path');
  const avatarUrl = watch('avatar_url');

  const { field: strengthsField } = useController({ control, name: 'strengths', defaultValue: [] });
  const strengthsStr = (strengthsField.value ?? []).join('\n');

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('leaders')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Leader' : 'Sửa Leader'}</h2>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onFinish)} className="flex flex-col gap-5">

            <ImageUpload prefix="profiles/avatars" currentPath={avatarPath} currentUrl={avatarUrl} onUploaded={key => setValue('avatar_path', key)} label="Avatar" />
            <Field label="Hoặc URL avatar ngoài">
              <Input type="url" {...register('avatar_url')} placeholder="https://..." />
            </Field>

            <Field label="Họ tên *" error={errors.full_name?.message as string}>
              <Input {...register('full_name', { required: 'Bắt buộc' })} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Role">
                <select {...register('role')} className={selectCls}>
                  <option value="leader">Leader</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
              <Field label="Chức danh hiển thị">
                <Input {...register('display_role')} placeholder="Trek Leader" />
              </Field>
              <Field label="Kinh nghiệm (năm)">
                <Input type="number" {...register('years_experience', { valueAsNumber: true })} />
              </Field>
              <Field label="Ngày sinh">
                <Input type="date" {...register('date_of_birth')} />
              </Field>
              <Field label="Tình trạng hôn nhân">
                <select {...register('relationship_status')} className={selectCls}>
                  <option value="">—</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="complicated">Complicated</option>
                  <option value="hidden">Hidden</option>
                </select>
              </Field>
              <Field label="Địa điểm">
                <Input {...register('location')} placeholder="TP. Hồ Chí Minh" />
              </Field>
            </div>

            <Field label="Bio">
              <Textarea {...register('bio')} rows={3} />
            </Field>
            <Field label="Highlight (câu mô tả ngắn)">
              <Textarea {...register('highlight')} rows={2} />
            </Field>
            <Field label="Strengths (mỗi dòng 1 strength)">
              <Textarea
                value={strengthsStr}
                onChange={e => strengthsField.onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                rows={4}
                placeholder={"Thể lực bền bỉ\nKĩ năng dẫn đoàn\nXử lý tình huống"}
              />
            </Field>

            <Field label="Active">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} defaultChecked className="w-4 h-4 accent-[#d00600]" />
                <span className="text-sm">Hiện trên trang About</span>
              </label>
            </Field>

            <div className="flex gap-3 mt-2">
              <Button type="submit" disabled={formLoading}>{formLoading ? 'Đang lưu…' : 'Lưu'}</Button>
              <Button type="button" variant="outline" onClick={() => list('leaders')}>Hủy</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
