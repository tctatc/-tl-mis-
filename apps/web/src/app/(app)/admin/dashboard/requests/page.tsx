'use client';

import { CATEGORIES, THAI_MONTHS_SHORT, VISIBLE_REQUEST_TYPES, REQUEST_TYPES, formatThaiDateTime } from '@csis/shared';
import { Ban, CheckCircle2, Clock, FileText, Hourglass, Search, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { BarList, ColumnChart, Panel, StatLink } from '@/components/charts';
import { Alert, Button, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';

type Stage = 'waiting' | 'in_progress' | 'returned' | 'approved' | 'rejected' | 'cancelled';
interface Data {
  total: number; stages: Record<Stage, number>; avgDays: number | null;
  byType: { code: string; name: string; category: string; total: number; open: number; approved: number; rejected: number }[];
  monthly: { month: string; count: number }[];
}
interface Row { id: string; requestNo: string; typeName: string; stage: Stage; studentCode: string; studentName: string; submittedAt: string; updatedAt: string }
interface List { total: number; pageSize: number; items: Row[] }

const STAGE: Record<Stage, { label: string; cls: string }> = {
  waiting: { label: 'รอดำเนินการ', cls: 'bg-gold-soft text-gold-ink ring-gold/40' },
  in_progress: { label: 'กำลังดำเนินการ', cls: 'bg-info-soft text-info ring-info/30' },
  returned: { label: 'ส่งกลับให้แก้ไข', cls: 'bg-warn-soft text-warn ring-warn/30' },
  approved: { label: 'อนุมัติแล้ว', cls: 'bg-ok-soft text-ok ring-ok/30' },
  rejected: { label: 'ไม่อนุมัติ', cls: 'bg-danger-soft text-danger ring-danger/25' },
  cancelled: { label: 'ยกเลิก', cls: 'bg-sunken text-ink-muted ring-line-strong' },
};
const monthLabel = (m: string) => { const [y, mo] = m.split('-').map(Number); return `${THAI_MONTHS_SHORT[mo! - 1]} ${String((y! + 543) % 100).padStart(2, '0')}`; };
const selectCls = 'min-h-12 rounded-[var(--radius-control)] bg-surface px-3 text-[16px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand';

function StageBadge({ stage }: { stage: Stage }) {
  return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-sm font-medium whitespace-nowrap ring-1', STAGE[stage].cls)}>{STAGE[stage].label}</span>;
}

export default function RequestDashboard() {
  const { data, error } = useApi<Data>('/admin/dashboard/requests');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [stage, setStage] = useState<Stage | ''>('');
  const [page, setPage] = useState(0);
  useEffect(() => { const t = setTimeout(() => { setQuery(q.trim()); setPage(0); }, 350); return () => clearTimeout(t); }, [q]);
  const params = new URLSearchParams({ page: String(page), ...(query ? { q: query } : {}), ...(type ? { type } : {}), ...(stage ? { stage } : {}) });
  const list = useApi<List>(`/admin/dashboard/requests/list?${params}`);
  const pages = list.data ? Math.ceil(list.data.total / list.data.pageSize) : 0;
  // กดการ์ด/กราฟ = กรองตารางด้านล่าง แล้วเลื่อนลงไปให้เห็น
  const filterBy = (f: { stage?: Stage | ''; type?: string }) => {
    if (f.stage !== undefined) setStage(f.stage);
    if (f.type !== undefined) setType(f.type);
    setPage(0);
    document.getElementById('request-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  const s = data.stages;
  const done = s.approved + s.rejected;
  const card = (st: Stage, icon: React.ReactNode, tone: 'default' | 'ok' | 'warn' | 'danger' | 'info', hint?: string) => (
    <StatLink onClick={() => filterBy({ stage: st })} tone={s[st] ? tone : 'default'} icon={icon} label={STAGE[st].label} value={s[st].toLocaleString('th-TH')} hint={hint ?? 'เรื่อง'} />
  );
  // ประเภทที่เปิดให้ยื่น + ประเภทที่เคยมีคนยื่น (เผื่อเป็นประเภทที่ซ่อนไปแล้ว)
  const typeOptions = REQUEST_TYPES.filter((t) => VISIBLE_REQUEST_TYPES.includes(t) || data.byType.some((b) => b.code === t.code));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="สถิติคำร้องออนไลน์" subtitle="กดการ์ดหรือแถบกราฟเพื่อกรองตารางด้านล่าง" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="จำนวนคำร้องแยกตามสถานะ">
        <StatLink onClick={() => filterBy({ stage: '', type: '' })} tone="brand" icon={<FileText className="size-4" aria-hidden="true" />} label="คำร้องทั้งหมด" value={data.total.toLocaleString('th-TH')} hint={data.avgDays !== null ? `เฉลี่ยใช้เวลา ${data.avgDays} วันต่อเรื่อง` : 'เรื่อง'} />
        {card('waiting', <Hourglass className="size-4" aria-hidden="true" />, 'warn', 'ยังไม่มีใครลงความเห็น')}
        {card('in_progress', <Clock className="size-4" aria-hidden="true" />, 'info', 'ผ่านบางขั้นแล้ว')}
        {card('returned', <Undo2 className="size-4" aria-hidden="true" />, 'warn', 'รอนักเรียนแก้ไข')}
        {card('approved', <CheckCircle2 className="size-4" aria-hidden="true" />, 'ok')}
        {card('rejected', <XCircle className="size-4" aria-hidden="true" />, 'danger')}
        {card('cancelled', <Ban className="size-4" aria-hidden="true" />, 'default', 'นักเรียนยกเลิกเอง')}
        <StatLink icon={<CheckCircle2 className="size-4" aria-hidden="true" />} label="เสร็จสิ้นแล้ว" value={done.toLocaleString('th-TH')} hint="อนุมัติ + ไม่อนุมัติ" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="แยกตามประเภทคำร้อง">
          <BarList unit="เรื่อง" empty="ยังไม่มีคำร้อง" items={data.byType.map((t) => ({
            key: t.code, label: t.name, sub: CATEGORIES[t.category as keyof typeof CATEGORIES]?.name, value: t.total,
            tone: t.open ? 'brand' : 'muted', onClick: () => filterBy({ type: t.code, stage: '' }),
          }))} />
          {data.byType.length > 0 && <p className="mt-2 px-2 text-sm text-ink-muted">แท่งสีจางคือประเภทที่ไม่มีเรื่องค้าง</p>}
        </Panel>
        <Panel title="แนวโน้มการยื่นคำร้อง 12 เดือน">
          <ColumnChart label="จำนวนคำร้องรายเดือน" items={data.monthly.map((m) => ({ key: m.month, label: THAI_MONTHS_SHORT[Number(m.month.slice(5)) - 1]!, value: m.count }))} />
          <p className="mt-2 text-center text-sm text-ink-muted">{monthLabel(data.monthly[0]!.month)} – {monthLabel(data.monthly.at(-1)!.month)}</p>
        </Panel>
      </div>

      <section id="request-table" className="scroll-mt-24 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card ring-1 ring-line/70" aria-label="ตารางคำร้อง">
        <div className="grid gap-3 border-b border-line/80 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:p-5">
          <label className="relative block">
            <span className="sr-only">ค้นหา</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ รหัสนักศึกษา หรือเลขที่คำร้อง"
              className="min-h-12 w-full rounded-[var(--radius-control)] bg-surface pr-3 pl-10 text-[16px] ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand" />
          </label>
          <select aria-label="ประเภทคำร้อง" className={selectCls} value={type} onChange={(e) => { setType(e.target.value); setPage(0); }}>
            <option value="">ทุกประเภท</option>
            {typeOptions.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}
          </select>
          <select aria-label="สถานะ" className={selectCls} value={stage} onChange={(e) => { setStage(e.target.value as Stage | ''); setPage(0); }}>
            <option value="">ทุกสถานะ</option>
            {(Object.keys(STAGE) as Stage[]).map((k) => <option key={k} value={k}>{STAGE[k].label}</option>)}
          </select>
        </div>
        {list.error ? <div className="p-4"><Alert>{list.error}</Alert></div> : !list.data ? <Spinner /> : list.data.items.length === 0 ? (
          <EmptyState icon={<Search className="size-7" aria-hidden="true" />} title={query || type || stage ? 'ไม่พบคำร้องที่ตรงกับที่ค้นหา' : 'ยังไม่มีคำร้อง'}>
            {(query || type || stage) && <button type="button" className="mt-2 text-brand underline" onClick={() => { setQ(''); setType(''); setStage(''); }}>ล้างตัวกรอง</button>}
          </EmptyState>
        ) : (
          <>
            {/* จอกว้าง: ตาราง · มือถือ: การ์ดทีละเรื่อง */}
            <table className="hidden w-full text-[15px] md:table">
              <thead className="bg-sunken/60 text-left text-sm text-ink-muted">
                <tr><th scope="col" className="px-4 py-2.5 font-medium">เลขที่</th><th scope="col" className="px-3 py-2.5 font-medium">นักเรียน</th><th scope="col" className="px-3 py-2.5 font-medium">ประเภท</th><th scope="col" className="px-3 py-2.5 font-medium">สถานะ</th><th scope="col" className="px-4 py-2.5 font-medium">ยื่นเมื่อ</th></tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {list.data.items.map((r) => (
                  <tr key={r.id} className="hover:bg-sunken/50">
                    <td className="px-4 py-3 whitespace-nowrap"><Link href={`/requests/${r.id}`} className="font-medium text-brand underline-offset-2 hover:underline">{r.requestNo}</Link></td>
                    <td className="px-3 py-3"><span className="block">{r.studentName}</span><span className="text-sm tabular-nums text-ink-muted">{r.studentCode}</span></td>
                    <td className="px-3 py-3">{r.typeName}</td>
                    <td className="px-3 py-3"><StageBadge stage={r.stage} /></td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-ink-muted">{formatThaiDateTime(r.submittedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line/70 md:hidden">
              {list.data.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="grid gap-1 px-4 py-3 hover:bg-sunken/50">
                    <span className="flex items-center justify-between gap-2"><span className="font-medium text-brand">{r.requestNo}</span><StageBadge stage={r.stage} /></span>
                    <span>{r.typeName}</span>
                    <span className="text-sm text-ink-muted">{r.studentName} · {r.studentCode} · {formatThaiDateTime(r.submittedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/80 px-4 py-3 text-sm text-ink-muted">
              <span>ทั้งหมด {list.data.total.toLocaleString('th-TH')} เรื่อง</span>
              {pages > 1 && (
                <span className="flex items-center gap-2">
                  <Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button>
                  <span className="tabular-nums">หน้า {page + 1} / {pages}</span>
                  <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button>
                </span>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
