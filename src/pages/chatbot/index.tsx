import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { SimpleSelect } from '@/components/SimpleSelect';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useSavedFlash } from '@/components/SaveBar';
import { Check } from 'lucide-react';

/**
 * Cấu hình chatbot — bảng chatbot_settings chỉ có đúng 1 dòng (id = 1), nên
 * đây là form sửa-tại-chỗ chứ không phải list/edit như các resource khác;
 * đọc/ghi thẳng qua supabase client thay vì dataProvider của refine.
 */

interface ChatbotSettings {
  enabled: boolean;
  model: string;
  system_prompt: string;
  welcome_message: string;
  suggested_questions: string[];
  max_tokens: number;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
}

interface UsageToday {
  userMessages: number;
  inputTokens: number;
  outputTokens: number;
}

const MODEL_OPTIONS = [
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — nhanh, rẻ (khuyên dùng)' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5 — thông minh hơn, đắt hơn ~3×' },
];

// Giá công bố (USD / 1 triệu token) để ước tính chi phí trong ngày.
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      {children}
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}

export function ChatbotSettingsPage() {
  const { saved, flash } = useSavedFlash();
  const [settings, setSettings] = useState<ChatbotSettings | null>(null);
  const [usage, setUsage] = useState<UsageToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from('chatbot_settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (cancelled) return;

      if (error || !data) {
        // 42P01 = bảng chưa tồn tại — migration 0017 chưa chạy
        setLoadError(
          error?.code === '42P01'
            ? 'Bảng chatbot_settings chưa tồn tại — cần chạy migration 0017_chatbot.sql trước (Supabase Dashboard → SQL Editor).'
            : `Không đọc được cấu hình chatbot: ${error?.message ?? 'không rõ lỗi'}`,
        );
      } else {
        setSettings({
          ...data,
          suggested_questions: Array.isArray(data.suggested_questions)
            ? data.suggested_questions
            : [],
        });
      }
      setLoading(false);
    })();

    // Thống kê hôm nay — hỏng cũng không sao, phần cấu hình vẫn dùng được.
    (async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('chatbot_messages')
        .select('role, input_tokens, output_tokens')
        .gte('created_at', startOfDay.toISOString());
      if (cancelled || !data) return;
      setUsage({
        userMessages: data.filter(m => m.role === 'user').length,
        inputTokens: data.reduce((sum, m) => sum + (m.input_tokens ?? 0), 0),
        outputTokens: data.reduce((sum, m) => sum + (m.output_tokens ?? 0), 0),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings || busy) return;

    setBusy(true);
    setSaveError('');
    const { error } = await supabase
      .from('chatbot_settings')
      .update({
        enabled: settings.enabled,
        model: settings.model,
        system_prompt: settings.system_prompt,
        welcome_message: settings.welcome_message,
        suggested_questions: settings.suggested_questions.filter(q => q.trim() !== ''),
        max_tokens: settings.max_tokens,
        rate_limit_per_minute: settings.rate_limit_per_minute,
        rate_limit_per_day: settings.rate_limit_per_day,
      })
      .eq('id', 1);
    setBusy(false);

    if (error) {
      setSaveError(`Lưu thất bại: ${error.message}`);
    } else {
      flash();
    }
  }

  function patch(partial: Partial<ChatbotSettings>) {
    setSettings(prev => (prev ? { ...prev, ...partial } : prev));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Spinner /> Đang tải…
      </div>
    );
  }

  if (loadError || !settings) {
    return (
      <div className="p-6 max-w-3xl">
        <h1 className="text-2xl font-bold mb-4">Chatbot</h1>
        <Card>
          <CardContent className="p-6 text-sm text-destructive">{loadError}</CardContent>
        </Card>
      </div>
    );
  }

  const price = PRICE_PER_MTOK[settings.model];
  const estCostToday = usage && price
    ? (usage.inputTokens / 1e6) * price.input + (usage.outputTokens / 1e6) * price.output
    : null;

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Chatbot</h1>
        <label className="flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={e => patch({ enabled: e.target.checked })}
            className="size-4 accent-primary"
          />
          {settings.enabled ? 'Đang bật' : 'Đang tắt'}
        </label>
      </div>

      {usage && (
        <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>Hôm nay: <b className="text-foreground">{usage.userMessages}</b> tin nhắn</span>
          <span><b className="text-foreground">{(usage.inputTokens + usage.outputTokens).toLocaleString('vi-VN')}</b> token</span>
          {estCostToday !== null && (
            <span>ước tính <b className="text-foreground">${estCostToday.toFixed(4)}</b></span>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 flex flex-col gap-6">
            <Field
              label="System prompt"
              hint="Tính cách và quy tắc của chatbot. Dữ liệu tour đang bán được tự động nối vào sau prompt này — không cần liệt kê tour ở đây."
            >
              <Textarea
                value={settings.system_prompt}
                onChange={e => patch({ system_prompt: e.target.value })}
                rows={16}
                className="font-mono text-xs leading-relaxed"
                required
              />
            </Field>

            <Field label="Lời chào" hint="Hiện trong khung chat khi khách mở lần đầu.">
              <Textarea
                value={settings.welcome_message}
                onChange={e => patch({ welcome_message: e.target.value })}
                rows={2}
              />
            </Field>

            <Field label="Câu hỏi gợi ý" hint="Hiện thành nút bấm dưới lời chào — khách bấm là gửi luôn.">
              <div className="flex flex-col gap-2">
                {settings.suggested_questions.map((q, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={q}
                      onChange={e => {
                        const next = [...settings.suggested_questions];
                        next[i] = e.target.value;
                        patch({ suggested_questions: next });
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Xoá câu hỏi"
                      onClick={() =>
                        patch({
                          suggested_questions: settings.suggested_questions.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
                {settings.suggested_questions.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    className="self-start"
                    onClick={() => patch({ suggested_questions: [...settings.suggested_questions, ''] })}
                  >
                    <Plus className="size-4" /> Thêm câu hỏi
                  </Button>
                )}
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Model" hint="Đổi model áp dụng ngay cho tin nhắn kế tiếp.">
                <SimpleSelect
                  value={settings.model}
                  onValueChange={model => patch({ model })}
                  options={MODEL_OPTIONS}
                  ariaLabel="Model"
                />
              </Field>
              <Field label="Độ dài trả lời tối đa (token)" hint="1024 ≈ 700 chữ. Càng thấp càng rẻ.">
                <Input
                  type="number"
                  min={128}
                  max={8192}
                  value={settings.max_tokens}
                  onChange={e => patch({ max_tokens: Number(e.target.value) })}
                />
              </Field>
              <Field label="Giới hạn mỗi phút / IP">
                <Input
                  type="number"
                  min={1}
                  value={settings.rate_limit_per_minute}
                  onChange={e => patch({ rate_limit_per_minute: Number(e.target.value) })}
                />
              </Field>
              <Field label="Giới hạn mỗi ngày / IP">
                <Input
                  type="number"
                  min={1}
                  value={settings.rate_limit_per_day}
                  onChange={e => patch({ rate_limit_per_day: Number(e.target.value) })}
                />
              </Field>
            </div>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={busy}>
                {busy ? <><Spinner /> Đang lưu…</> : 'Lưu'}
              </Button>
              {saved && (
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
                  <Check className="size-4" />
                  Đã lưu
                </span>
              )}
              {saveError && <span className="text-sm text-destructive">{saveError}</span>}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
