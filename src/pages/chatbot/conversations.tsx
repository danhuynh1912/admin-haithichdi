import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Tab "Hội thoại" — đọc bảng chatbot_messages (admin có quyền select qua RLS),
 * nhóm theo session_id thành danh sách cuộc chat; bấm vào xem cả cuộc dạng
 * bong bóng. Gom nhóm phía client trên FETCH_LIMIT tin gần nhất — đủ dùng
 * nhiều tháng đầu; khi log phình to thì chuyển sang RPC gom nhóm sau.
 */

interface MessageRow {
  id: number;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
}

interface SessionSummary {
  sessionId: string;
  lastAt: string;
  count: number;
  preview: string;
  tokens: number;
}

const FETCH_LIMIT = 1000;

function formatTime(value: string): string {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ConversationsTab() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('chatbot_messages')
      .select('session_id, role, content, input_tokens, output_tokens, created_at')
      .order('created_at', { ascending: false })
      .limit(FETCH_LIMIT);

    // data đang mới→cũ: lần gặp đầu của mỗi session cho lastAt; các lần gán
    // preview sau cùng (tức tin cũ nhất) chính là câu hỏi mở đầu cuộc chat.
    const bySession = new Map<string, SessionSummary>();
    for (const m of (data ?? []) as Omit<MessageRow, 'id'>[]) {
      const tokens = (m.input_tokens ?? 0) + (m.output_tokens ?? 0);
      const existing = bySession.get(m.session_id);
      if (!existing) {
        bySession.set(m.session_id, {
          sessionId: m.session_id,
          lastAt: m.created_at,
          count: 1,
          preview: m.role === 'user' ? m.content : '',
          tokens,
        });
      } else {
        existing.count += 1;
        existing.tokens += tokens;
        if (m.role === 'user') existing.preview = m.content;
      }
    }
    setSessions([...bySession.values()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      setThreadLoading(true);
      const { data } = await supabase
        .from('chatbot_messages')
        .select('*')
        .eq('session_id', selected)
        .order('created_at', { ascending: true })
        .limit(500);
      if (!cancelled) {
        setThread((data ?? []) as MessageRow[]);
        setThreadLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Spinner /> Đang tải…
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Chưa có cuộc hội thoại nào.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4 items-start">
      {/* Danh sách cuộc chat */}
      <div className="w-80 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {sessions.length} cuộc chat (trong {FETCH_LIMIT} tin gần nhất)
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Làm mới"
            onClick={loadSessions}
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <Card>
          <CardContent className="p-0 max-h-[70vh] overflow-y-auto">
            {sessions.map(s => (
              <button
                key={s.sessionId}
                type="button"
                onClick={() => setSelected(s.sessionId)}
                className={cn(
                  'block w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-accent transition-colors',
                  selected === s.sessionId && 'bg-accent',
                )}
              >
                <div className="text-sm font-medium line-clamp-2">
                  {s.preview || '(khách chưa nhắn gì)'}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {formatTime(s.lastAt)} · {s.count} tin ·{' '}
                  {s.tokens.toLocaleString('vi-VN')} token
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Nội dung cuộc chat được chọn */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Chọn một cuộc chat bên trái để xem nội dung.
            </CardContent>
          </Card>
        ) : threadLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
            <Spinner /> Đang tải…
          </div>
        ) : (
          <Card>
            <CardContent className="p-4 max-h-[70vh] overflow-y-auto flex flex-col gap-3">
              {thread.map(m => (
                <div
                  key={m.id}
                  className={cn(
                    'flex w-full',
                    m.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed break-words',
                      m.role === 'user'
                        ? 'rounded-br-sm bg-primary text-primary-foreground whitespace-pre-wrap'
                        : 'rounded-bl-sm bg-muted',
                    )}
                  >
                    {m.role === 'user' ? (
                      m.content
                    ) : (
                      <div className="[&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-4">
                        <Markdown remarkPlugins={[remarkGfm]}>{m.content}</Markdown>
                      </div>
                    )}
                    <div
                      className={cn(
                        'mt-1 text-[11px]',
                        m.role === 'user'
                          ? 'text-primary-foreground/60'
                          : 'text-muted-foreground',
                      )}
                    >
                      {formatTime(m.created_at)}
                      {m.role === 'assistant' &&
                        ` · ${(m.input_tokens + m.output_tokens).toLocaleString('vi-VN')} token`}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
