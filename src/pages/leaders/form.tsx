import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from '@refinedev/react-hook-form';
import { useNavigation, useOne } from '@refinedev/core';
import { useController } from 'react-hook-form';
import { ImageUpload } from '@/components/ImageUpload';
import { createLeader, updateLeaderCredentials, randomPassword } from '@/lib/adminApi';
import { emailToUsername, USERNAME_PATTERN } from '@/lib/username';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';

interface LeaderFormData {
  username: string; password: string;
  full_name: string; display_role: string; bio: string; highlight: string;
  location: string; relationship_status: string; date_of_birth: string;
  display_role_en: string; bio_en: string; highlight_en: string;
  location_en: string; strengths_en: string[];
  years_experience: number; is_active: boolean;
  avatar_path: string; avatar_url: string; strengths: string[];
  role: string;
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Strip form-only fields and normalise empties the DB can't take. */
function toProfilePayload(v: LeaderFormData) {
  const { username: _u, password: _p, ...profile } = v;
  return {
    ...profile,
    date_of_birth: profile.date_of_birth || null,
    years_experience: Number.isFinite(profile.years_experience) ? profile.years_experience : 0,
    strengths: profile.strengths ?? [],
    strengths_en: profile.strengths_en ?? [],
  };
}

export function LeaderForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list } = useNavigation();
  const { id } = useParams<{ id: string }>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<LeaderFormData>({
    refineCoreProps: mode === 'edit'
      ? { resource: 'profiles', action: 'edit', id, redirect: false }
      : { resource: 'profiles', action: 'create' },
    defaultValues: { role: 'leader', is_active: true, years_experience: 0, strengths: [] },
  });

  const avatarPath = watch('avatar_path');
  const avatarUrl = watch('avatar_url');

  const { field: strengthsField } = useController({ control, name: 'strengths', defaultValue: [] });
  const strengthsStr = (strengthsField.value ?? []).join('\n');
  const { field: strengthsEnField } = useController({ control, name: 'strengths_en', defaultValue: [] });
  const strengthsEnStr = (strengthsEnField.value ?? []).join('\n');

  async function onSubmit(raw: Record<string, unknown>) {
    const values = raw as unknown as LeaderFormData;
    setSubmitError(null);
    if (mode === 'edit') {
      await onFinish(toProfilePayload(values));
      list('profiles');
      return;
    }
    setSubmitting(true);
    try {
      await createLeader(values.username, values.password, toProfilePayload(values));
      list('profiles');
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = formLoading || submitting;

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('profiles')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Thêm Leader' : 'Sửa Leader'}</h2>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {mode === 'edit' && formLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

            {mode === 'create' && (
              <div className="rounded-lg border bg-muted/30 p-4 flex flex-col gap-4">
                <p className="text-sm font-semibold">Tài khoản đăng nhập</p>
                <Field
                  label="Tên đăng nhập *"
                  error={errors.username?.message as string}
                  hint="3–30 ký tự, chỉ gồm chữ thường, số, dấu chấm, gạch ngang, gạch dưới. Không đổi được về sau trừ khi admin sửa."
                >
                  <Input
                    type="text"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="hoangtuan"
                    {...register('username', {
                      required: 'Bắt buộc',
                      setValueAs: (v: string) => (v ?? '').trim().toLowerCase(),
                      pattern: { value: USERNAME_PATTERN, message: 'Chỉ a-z, 0-9, . - _ ; bắt đầu bằng chữ hoặc số; 3–30 ký tự' },
                    })}
                  />
                </Field>
                <Field
                  label="Mật khẩu *"
                  error={errors.password?.message as string}
                  hint="Tối thiểu 8 ký tự. Gửi lại cho leader sau khi tạo — mật khẩu không xem lại được."
                >
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      {...register('password', { required: 'Bắt buộc', minLength: { value: 8, message: 'Tối thiểu 8 ký tự' } })}
                    />
                    <Button type="button" variant="outline" onClick={() => setValue('password', randomPassword())}>
                      Tạo ngẫu nhiên
                    </Button>
                  </div>
                </Field>
              </div>
            )}

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
              <Field label="Chức danh hiển thị (VI)">
                <Input {...register('display_role')} placeholder="Trek Leader" />
              </Field>
              <Field label="Chức danh hiển thị (EN)">
                <Input {...register('display_role_en')} placeholder={EN_PLACEHOLDER} />
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
              <Field label="Địa điểm (VI)">
                <Input {...register('location')} placeholder="TP. Hồ Chí Minh" />
              </Field>
              <Field label="Địa điểm (EN)">
                <Input {...register('location_en')} placeholder={EN_PLACEHOLDER} />
              </Field>
            </div>

            <BilingualField
              label="Bio"
              vi={<Textarea {...register('bio')} rows={3} />}
              en={<Textarea {...register('bio_en')} rows={3} placeholder={EN_PLACEHOLDER} />}
            />
            <BilingualField
              label="Highlight (câu mô tả ngắn)"
              vi={<Textarea {...register('highlight')} rows={2} />}
              en={<Textarea {...register('highlight_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
            />
            <BilingualField
              label="Strengths (mỗi dòng 1 strength)"
              hint="Danh sách EN để trống sẽ dùng nguyên danh sách tiếng Việt."
              vi={
                <Textarea
                  value={strengthsStr}
                  onChange={e => strengthsField.onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  rows={4}
                  placeholder={"Thể lực bền bỉ\nKĩ năng dẫn đoàn\nXử lý tình huống"}
                />
              }
              en={
                <Textarea
                  value={strengthsEnStr}
                  onChange={e => strengthsEnField.onChange(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
                  rows={4}
                  placeholder={"Endurance\nGroup leadership\nProblem solving"}
                />
              }
            />

            <Field label="Active">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" {...register('is_active')} className="w-4 h-4 accent-primary" />
                <span className="text-sm">Hiện trên trang About</span>
              </label>
            </Field>

            <div className="flex gap-3 mt-2">
              <Button type="submit" disabled={busy}>{busy ? <><Spinner /> Đang lưu…</> : 'Lưu'}</Button>
              <Button type="button" variant="outline" onClick={() => list('profiles')}>Hủy</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      )}

      {mode === 'edit' && id && <CredentialsCard id={id} />}
    </div>
  );
}

/** Separate card: changing email/password goes through the edge function, not the table. */
function CredentialsCard({ id }: { id: string }) {
  const { result } = useOne<{ id: string; email: string }>({
    resource: 'leaders_admin', id, meta: { select: 'id,email' },
  });
  const currentUsername = emailToUsername(result?.email);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<{ busy: boolean; error?: string; ok?: string }>({ busy: false });

  async function save() {
    const patch: { username?: string; password?: string } = {};
    const next = username.trim().toLowerCase();
    if (next && next !== currentUsername) {
      if (!USERNAME_PATTERN.test(next)) {
        setState({ busy: false, error: 'Tên đăng nhập chỉ gồm a-z, 0-9, . - _ ; 3–30 ký tự' });
        return;
      }
      patch.username = next;
    }
    if (password) patch.password = password;
    if (!patch.username && !patch.password) {
      setState({ busy: false, error: 'Chưa thay đổi gì' });
      return;
    }
    setState({ busy: true });
    try {
      await updateLeaderCredentials(id, patch);
      setPassword('');
      setState({ busy: false, ok: 'Đã cập nhật tài khoản đăng nhập' });
    } catch (e) {
      setState({ busy: false, error: (e as Error).message });
    }
  }

  return (
    <Card className="mt-6">
      <CardContent className="pt-6 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold">Tài khoản đăng nhập</p>
          <p className="text-xs text-muted-foreground mt-1">Tên đăng nhập hiện tại: {currentUsername || '…'}</p>
        </div>

        {state.error && <span className="text-xs text-destructive">{state.error}</span>}
        {state.ok && <span className="text-xs text-emerald-600">{state.ok}</span>}

        <Field label="Tên đăng nhập mới" hint="Để trống nếu không đổi.">
          <Input
            type="text"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={currentUsername}
          />
        </Field>
        <Field label="Mật khẩu mới" hint="Để trống nếu không đổi. Tối thiểu 8 ký tự.">
          <div className="flex gap-2">
            <Input type="text" value={password} onChange={e => setPassword(e.target.value)} />
            <Button type="button" variant="outline" onClick={() => setPassword(randomPassword())}>
              Tạo ngẫu nhiên
            </Button>
          </div>
        </Field>

        <div>
          <Button type="button" onClick={save} disabled={state.busy}>
            {state.busy ? <><Spinner /> Đang lưu…</> : 'Cập nhật tài khoản'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
