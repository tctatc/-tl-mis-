'use client';

import { formatThaiDateTime } from '@csis/shared';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { PageHeader } from '@/components/academic';
import { Alert, Button, Card, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { actionLabel } from '../labels';

interface AuditRow { id: string; action: string; entity: string; entityId: string; actor: string; ip: string; at: string; before: unknown; after: unknown }
interface LoginRow { id: string; username: string; success: boolean; reason: string; ip: string; at: string }
interface Paged<T> { items: T[]; total: number; pageSize: number }
const REASON: Record<string, string> = { bad_password: 'รหัสผ่านผิด', unknown_user: 'ไม่พบชื่อผู้ใช้', locked: 'บัญชีถูกล็อก', suspended: 'บัญชีถูกระงับ' };
const ENTITIES = [['', 'ทั้งหมด'], ['request', 'คำร้อง'], ['user', 'ผู้ใช้'], ['student', 'นักเรียน'], ['position', 'ผู้ลงนาม'], ['program', 'สาขา']] as const;

export default function AuditPage() {
  const [tab, setTab] = useState<'audit' | 'logins'>('audit');
  const [entity, setEntity] = useState('');
  const [failedOnly, setFailedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const audit = useApi<Paged<AuditRow>>(tab === 'audit' ? `/admin/audit?page=${page}${entity ? `&entity=${entity}` : ''}` : null);
  const logins = useApi<Paged<LoginRow>>(tab === 'logins' ? `/admin/logins?page=${page}${failedOnly ? '&failedOnly=1' : ''}` : null);
  const cur = tab === 'audit' ? audit : logins;
  const pages = cur.data ? Math.ceil(cur.data.total / cur.data.pageSize) : 0;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="ประวัติการใช้งาน" subtitle="บันทึกทุกการเปลี่ยนแปลงสำคัญ และการเข้าสู่ระบบ (แก้ไข/ลบไม่ได้)" />
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="flex gap-1">
          {([['audit', 'การเปลี่ยนแปลงข้อมูล'], ['logins', 'การเข้าสู่ระบบ']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setPage(0); }} className={cx('min-h-11 rounded-md px-4 text-[15px]', tab === k ? 'bg-brand-soft font-medium text-brand' : 'text-ink-muted hover:bg-sunken')}>{l}</button>
          ))}
        </div>
        {tab === 'audit' ? (
          <select value={entity} onChange={(e) => { setEntity(e.target.value); setPage(0); }} aria-label="กรองประเภท" className="ml-auto min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong">
            {ENTITIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        ) : (
          <label className="ml-auto flex min-h-11 items-center gap-2 text-[15px]"><input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={failedOnly} onChange={(e) => { setFailedOnly(e.target.checked); setPage(0); }} />เฉพาะที่ล้มเหลว</label>
        )}
      </div>
      <Card>
        {cur.error ? <div className="p-4"><Alert>{cur.error}</Alert></div> : !cur.data ? <Spinner /> : tab === 'audit' ? (
          <ul className="divide-y divide-line/70">{(audit.data?.items ?? []).map((r) => <AuditItem key={r.id} r={r} />)}</ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[15px]">
              <thead className="text-left text-sm text-ink-muted"><tr><th scope="col" className="px-4 py-2 font-medium">เวลา</th><th scope="col" className="px-2 py-2 font-medium">ชื่อผู้ใช้</th><th scope="col" className="px-2 py-2 font-medium">ผล</th><th scope="col" className="px-4 py-2 font-medium">IP</th></tr></thead>
              <tbody className="divide-y divide-line/70">
                {(logins.data?.items ?? []).map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">{formatThaiDateTime(l.at)}</td>
                    <td className="px-2 py-2 tabular-nums">{l.username}</td>
                    <td className="px-2 py-2">{l.success ? <span className="text-ok">สำเร็จ</span> : <span className="text-danger">ล้มเหลว · {REASON[l.reason] ?? l.reason}</span>}</td>
                    <td className="px-4 py-2 tabular-nums text-ink-muted">{l.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line/80 px-4 py-2.5 text-sm">
            <span className="tabular-nums text-ink-muted">หน้า {page + 1}/{pages} · {cur.data?.total} รายการ</span>
            <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button><Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button></div>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditItem({ r }: { r: AuditRow }) {
  const [open, setOpen] = useState(false);
  const hasDiff = r.before !== null || r.after !== null;
  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[15px]"><span className="font-medium">{r.actor}</span> · {actionLabel(r.action)}</p>
          <p className="text-sm text-ink-muted tabular-nums">{formatThaiDateTime(r.at)} · {r.entity} {r.entityId.slice(0, 8)} · IP {r.ip || '–'}</p>
        </div>
        {hasDiff && (
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm text-brand hover:bg-brand-soft">
            รายละเอียด <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} aria-hidden="true" />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          {([['ก่อน', r.before], ['หลัง', r.after]] as const).map(([label, v]) => (
            <div key={label} className="min-w-0"><p className="mb-1 font-medium text-ink-muted">{label}</p><pre className="overflow-x-auto rounded-md bg-sunken p-2 text-xs leading-relaxed">{v === null ? '–' : JSON.stringify(v, null, 2)}</pre></div>
          ))}
        </div>
      )}
    </li>
  );
}
