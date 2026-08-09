import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from '@refinedev/react-hook-form';
import { useList, useNavigation } from '@refinedev/core';
import { useController } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { markdownImageKeys, slugifyTitle } from '@/lib/utils';
import { ImageUpload } from '@/components/ImageUpload';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { BilingualField, EN_PLACEHOLDER } from '@/components/BilingualField';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface BlogFormData {
  slug: string;
  status: 'draft' | 'published';
  published_at: string;
  title: string; title_en: string;
  excerpt: string; excerpt_en: string;
  content_md: string; content_md_en: string;
  hero_path: string; hero_url: string;
  hero_alt: string; hero_alt_en: string;
}

interface TagRow { id: number; slug: string; name: string }

/** Intrinsic size of an uploaded body image, remembered until the post saves. */
interface ImageSize { image_path: string; width: number | null; height: number | null }

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

export function BlogForm({ mode }: { mode: 'create' | 'edit' }) {
  const { list } = useNavigation();
  // Read from the route rather than from useForm's own result — refineCoreProps
  // is an argument to that same call, so it cannot reference what it returns.
  const { id } = useParams<{ id: string }>();
  const { query: tagsQuery } = useList<TagRow>({
    resource: 'blog_tags',
    pagination: { pageSize: 100 },
    sorters: [{ field: 'sort_order', order: 'asc' }],
  });
  const tags = tagsQuery?.data?.data ?? [];

  const {
    register, handleSubmit, control, watch, setValue,
    refineCore: { onFinish, formLoading },
    formState: { errors },
  } = useForm<BlogFormData>({
    refineCoreProps: mode === 'edit'
      ? { resource: 'blogs', action: 'edit', id, redirect: false }
      : { resource: 'blogs', action: 'create' },
    defaultValues: { status: 'draft', content_md: '', content_md_en: '' },
  });

  const { field: contentVi } = useController({ control, name: 'content_md', defaultValue: '' });
  const { field: contentEn } = useController({ control, name: 'content_md_en', defaultValue: '' });

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [imageSizes, setImageSizes] = useState<ImageSize[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(mode === 'edit');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const status = watch('status');
  const slug = watch('slug');
  const heroPath = watch('hero_path');
  const heroUrl = watch('hero_url');

  useEffect(() => {
    if (mode !== 'edit' || !id) return;
    (async () => {
      const [{ data: postTags }, { data: images }] = await Promise.all([
        supabase.from('blog_post_tags').select('tag_id').eq('blog_id', id),
        supabase.from('blog_images').select('image_path,width,height').eq('blog_id', id),
      ]);
      setSelectedTagIds((postTags ?? []).map(r => r.tag_id as number));
      setImageSizes((images ?? []) as ImageSize[]);
      setLoadingRelated(false);
    })();
  }, [id, mode]);

  // The slug follows the title until it is published; after that it is the URL
  // people have shared and search engines have indexed, so it stops moving.
  const slugTouched = useRef(false);
  const title = watch('title');
  useEffect(() => {
    if (mode !== 'create' || slugTouched.current) return;
    setValue('slug', slugifyTitle(title ?? ''));
  }, [title, mode, setValue]);

  function toggleTag(tagId: number) {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(x => x !== tagId) : [...prev, tagId],
    );
  }

  function rememberImage(key: string, size: { width: number; height: number } | null) {
    setImageSizes(prev =>
      prev.some(i => i.image_path === key)
        ? prev
        : [...prev, { image_path: key, width: size?.width ?? null, height: size?.height ?? null }],
    );
  }

  async function onSubmit(raw: Record<string, unknown>) {
    const values = raw as unknown as BlogFormData;
    setSubmitError(null);

    if (values.status === 'published' && !values.published_at) {
      setSubmitError('Bài đã đăng phải có ngày đăng.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await onFinish({
        ...values,
        published_at: values.published_at || null,
      }) as { data?: { id: number } } | undefined;

      const blogId = (result?.data?.id ?? id) as number;
      if (!blogId) return;

      await supabase.from('blog_post_tags').delete().eq('blog_id', blogId);
      if (selectedTagIds.length) {
        await supabase.from('blog_post_tags').insert(
          selectedTagIds.map(tag_id => ({ blog_id: blogId, tag_id })),
        );
      }

      // Only images the body still references are recorded. Deleting a picture
      // from the text is therefore also what releases its row, which is the
      // whole point of tracking them separately from the markdown.
      const referenced = new Set([
        ...markdownImageKeys(values.content_md ?? ''),
        ...markdownImageKeys(values.content_md_en ?? ''),
      ]);
      await supabase.from('blog_images').delete().eq('blog_id', blogId);
      const rows = [...referenced].map(image_path => {
        const known = imageSizes.find(i => i.image_path === image_path);
        return { blog_id: blogId, image_path, width: known?.width ?? null, height: known?.height ?? null };
      });
      if (rows.length) await supabase.from('blog_images').insert(rows);

      list('blogs');
    } catch (e) {
      setSubmitError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const busy = formLoading || submitting;

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => list('blogs')}>← Quay lại</Button>
        <h2 className="text-xl font-bold">{mode === 'create' ? 'Viết bài mới' : 'Sửa bài viết'}</h2>
      </div>

      {submitError && (
        <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitError}
        </div>
      )}

      {mode === 'edit' && (formLoading || loadingRelated) ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center"><Spinner /> Đang tải…</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">

              <BilingualField
                label="Tiêu đề *"
                error={errors.title?.message as string}
                vi={<Input {...register('title', { required: 'Bắt buộc' })} />}
                en={<Input {...register('title_en')} placeholder={EN_PLACEHOLDER} />}
              />

              <div className="grid grid-cols-2 gap-4">
                <Field
                  label="Slug *"
                  error={errors.slug?.message as string}
                  hint={
                    status === 'published'
                      ? 'Đã đăng — đổi slug là gãy mọi link đã chia sẻ và mất thứ hạng tìm kiếm.'
                      : 'Tự sinh từ tiêu đề. Chỉ a-z, 0-9 và dấu gạch ngang.'
                  }
                >
                  <Input
                    {...register('slug', {
                      required: 'Bắt buộc',
                      pattern: {
                        value: /^[a-z0-9]+(-[a-z0-9]+)*$/,
                        message: 'Chỉ a-z, 0-9, phân tách bằng dấu gạch ngang',
                      },
                      onChange: () => { slugTouched.current = true; },
                    })}
                  />
                </Field>
                <Field label="URL công khai">
                  <p className="pt-2 text-sm text-muted-foreground break-all">/blog/{slug || '…'}</p>
                </Field>
                <Field label="Trạng thái">
                  <select {...register('status')} className={selectCls}>
                    <option value="draft">Nháp</option>
                    <option value="published">Đã đăng</option>
                  </select>
                </Field>
                <Field
                  label="Ngày đăng"
                  hint="Bắt buộc khi chuyển sang Đã đăng. Cũng là thứ tự sắp xếp ở trang blog."
                >
                  <Input type="date" {...register('published_at')} />
                </Field>
              </div>

              <BilingualField
                label="Tóm tắt"
                hint="Đây là đoạn mô tả Google hiển thị dưới kết quả tìm kiếm — nên viết tay."
                vi={<Textarea {...register('excerpt')} rows={2} />}
                en={<Textarea {...register('excerpt_en')} rows={2} placeholder={EN_PLACEHOLDER} />}
              />

              <hr className="border-border" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ảnh bìa</p>
              <ImageUpload
                prefix="blog/heroes"
                currentPath={heroPath}
                currentUrl={heroUrl}
                onUploaded={key => setValue('hero_path', key)}
                label="Ảnh hero"
              />
              <Field label="Hoặc URL ảnh ngoài">
                <Input type="url" {...register('hero_url')} placeholder="https://..." />
              </Field>
              <BilingualField
                label="Mô tả ảnh (alt)"
                hint="Đọc cho người dùng trình đọc màn hình, và là thứ Google đọc được từ ảnh."
                vi={<Input {...register('hero_alt')} />}
                en={<Input {...register('hero_alt_en')} placeholder={EN_PLACEHOLDER} />}
              />

              <hr className="border-border" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Chủ đề ({selectedTagIds.length})
                </p>
                {tags.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Chưa có chủ đề nào — tạo ở màn “Quản lý chủ đề”.
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const active = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => toggleTag(tag.id)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground font-semibold'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <hr className="border-border" />
              <Field label="Nội dung (VI) *">
                <MarkdownEditor
                  value={contentVi.value ?? ''}
                  onChange={contentVi.onChange}
                  onImageUploaded={rememberImage}
                  placeholder={'# Tiêu đề phần\n\nViết nội dung ở đây…'}
                />
              </Field>

              <Field label="Nội dung (EN)" hint="Để trống → trang tiếng Anh hiển thị bản tiếng Việt.">
                <MarkdownEditor
                  value={contentEn.value ?? ''}
                  onChange={contentEn.onChange}
                  onImageUploaded={rememberImage}
                  rows={12}
                  placeholder={EN_PLACEHOLDER}
                />
              </Field>

              <div className="flex gap-3 mt-2">
                <Button type="submit" disabled={busy}>{busy ? <><Spinner /> Đang lưu…</> : 'Lưu'}</Button>
                <Button type="button" variant="outline" onClick={() => list('blogs')}>Hủy</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
