'use client';

import type { RequestStatus, RequestSummary } from '@csis/shared';
import { POSITIONS, STATUS_LABEL } from '@csis/shared';
import { Inbox, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { RequestList } from '@/components/RequestList';
import { Alert, Button, Card, Input, Spinner, cx } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/me';

type Box = 'todo' | 'done' | 'all';
interface ListResult { items: RequestSummary[]; total: number; pageSize: number; counts: { todo: number } }

export default function StaffInbox() {
  const { me } = useMe();
  const seesAll = !!me?.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'REGISTRAR');
  const [box, setBox] = useState<Box>('todo');
  const [status, setStatus] = useState<RequestStatus | ''>('');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ListResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ box, page: String(page) });
    if (status && box !== 'todo') params.set('status', status);
    if (query) params.set('q', query);
    setResult(null);
    setError('');
    api.get<ListResult>(`/staff/requests?${params}`).then(setResult).catch((e) => setError(errorMessage(e)));
  }, [box, status, query, page]);

  const tabs: { key: Box; label: string }[] = [
    { key: 'todo', label: 'รอฉันพิจารณา' },
    { key: 'done', label: 'ที่ฉันพิจารณาแล้ว' },
    ...(seesAll ? [{ key: 'all' as Box, label: 'ทั้งหมด' }] : []),
  ];
  const pages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="grid gap-6">
      <div className="rise">
        <h1 className="text-2xl font-semibold">พิจารณาคำร้อง</h1>
        <p className="text-[15px] text-ink-muted">{me?.displayName}{me?.positions.length ? ` · ${me.positions.map((k) => POSITIONS[k]).join(', ')}` : ''}</p>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-line/80 px-3 py-2.5 sm:px-4">
          <div role="tablist" className="flex gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.key} role="tab" aria-selected={box === t.key} onClick={() => { setBox(t.key); setPage(0); }}
                className={cx('inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-[15px] whitespace-nowrap', box === t.key ? 'bg-brand-soft font-medium text-brand' : 'text-ink-muted hover:bg-sunken')}>
                {t.label}
                {t.key === 'todo' && result && result.counts.todo > 0 && <span className="rounded-full bg-brand px-1.5 text-xs tabular-nums text-ink-inverse">{result.counts.todo}</span>}
              </button>
            ))}
          </div>
          <form className="ml-auto flex w-full gap-2 sm:w-auto" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(0); }} role="search">
            {box !== 'todo' && (
              <select value={status} onChange={(e) => { setStatus(e.target.value as RequestStatus | ''); setPage(0); }} aria-label="กรองสถานะ"
                className="min-h-10 rounded-[var(--radius-control)] bg-surface px-2 text-[15px] ring-1 ring-line-strong">
                <option value="">ทุกสถานะ</option>
                {(Object.keys(STATUS_LABEL) as RequestStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            )}
            <div className="relative flex-1 sm:w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เลขที่คำร้อง รหัส หรือชื่อ" aria-label="ค้นหาคำร้อง" className="min-h-10 pl-9" />
            </div>
          </form>
        </div>
        {error ? <div className="p-4"><Alert>{error}</Alert></div>
          : !result ? <Spinner />
          : result.items.length === 0 ? (
            <div className="grid place-items-center gap-1 px-4 py-12 text-center text-ink-muted">
              <Inbox className="size-7" aria-hidden="true" />
              <p className="font-medium text-ink">{box === 'todo' ? 'ไม่มีคำร้องรอพิจารณา' : 'ไม่พบคำร้อง'}</p>
              {box === 'todo' && <p className="text-sm">คำร้องใหม่ที่ถึงขั้นของคุณจะขึ้นที่นี่</p>}
            </div>
          ) : <RequestList items={result.items} showStudent />}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line/80 px-4 py-2.5 text-sm">
            <span className="tabular-nums text-ink-muted">หน้า {page + 1}/{pages} · {result?.total} รายการ</span>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
              <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
