'use client';

import { CATEGORIES, LEVEL_LABEL, VISIBLE_REQUEST_TYPES, fullName, type CategoryCode, type RequestSummary } from '@csis/shared';
import { FileText, Inbox } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { FormQrButton } from '@/components/Qr';
import { RequestList } from '@/components/RequestList';
import { Alert, Card, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/me';

export default function StudentHome() {
  const { me } = useMe();
  const [mine, setMine] = useState<RequestSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<RequestSummary[]>('/requests/mine').then(setMine).catch((e) => setError(errorMessage(e)));
  }, []);

  const s = me?.student;
  if (!s) return <Alert tone="info">หน้านี้สำหรับบัญชีนักศึกษา</Alert>;
  const open = mine?.filter((r) => r.status === 'pending' || r.status === 'returned') ?? [];
  const returned = open.filter((r) => r.status === 'returned').length;

  return (
    <div className="grid gap-8">
      <section className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">สวัสดี</p>
          <h1 className="text-2xl font-semibold sm:text-[28px]">{fullName(s)}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            <span className="tabular-nums">{s.studentCode}</span> · {LEVEL_LABEL[s.level]} {s.program} ปี {s.yearLevel} กลุ่ม {s.groupNo}
          </p>
        </div>
      </section>

      {returned > 0 && <Alert tone="warn">มีคำร้อง {returned} รายการถูกส่งกลับให้แก้ไข กดที่รายการด้านล่างเพื่อดูเหตุผล</Alert>}

      <section aria-labelledby="mine-title">
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-line/80 px-4 py-3 sm:px-5">
            <h2 id="mine-title" className="font-semibold">คำร้องของฉัน</h2>
            {mine && mine.length > 0 && <span className="text-sm text-ink-muted tabular-nums">{open.length} รายการกำลังดำเนินการ</span>}
          </div>
          {error ? <div className="p-4"><Alert>{error}</Alert></div>
            : !mine ? <Spinner />
            : mine.length === 0 ? (
              <div className="grid place-items-center gap-1 px-4 py-10 text-center text-ink-muted">
                <Inbox className="size-7" aria-hidden="true" />
                <p className="font-medium text-ink">ยังไม่มีคำร้อง</p>
                <p className="text-sm">เลือกเรื่องที่ต้องการด้านล่าง ระบบกรอกข้อมูลส่วนตัวให้แล้ว</p>
              </div>
            ) : <RequestList items={mine.slice(0, 8)} />}
        </Card>
      </section>

      <section aria-labelledby="new-title" className="grid gap-5">
        <div>
          <h2 id="new-title" className="text-xl font-semibold">ยื่นคำร้องใหม่</h2>
          <p className="text-[15px] text-ink-muted">กดเรื่องที่ต้องการ ชื่อ รหัส แผนก สาขา และชื่อผู้ปกครองถูกกรอกให้จากทะเบียนแล้ว · กดไอคอน QR เพื่อสแกนไปกรอกต่อบนมือถือ</p>
        </div>
        {(Object.keys(CATEGORIES) as CategoryCode[]).filter((cat) => VISIBLE_REQUEST_TYPES.some((t) => t.category === cat)).map((cat) => (
          <div key={cat} className="grid gap-2.5">
            <h3 className="flex items-baseline gap-2 font-semibold">
              <span className="grid size-6 place-items-center rounded-md bg-gold-soft text-[13px] text-gold-ink">{cat}</span>
              {CATEGORIES[cat].name}
              <span className="text-sm font-normal text-ink-muted">{CATEGORIES[cat].hint}</span>
            </h3>
            <ul className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {VISIBLE_REQUEST_TYPES.filter((t) => t.category === cat).map((t) => (
                <li key={t.code}>
                  {t.ready ? (
                    // ลิงก์กับปุ่ม QR เป็นพี่น้องกัน (ห้ามซ้อนปุ่มในลิงก์)
                    <div className="group relative flex h-full items-start gap-3 rounded-[var(--radius-card)] bg-surface p-3.5 pr-2 shadow-card ring-1 ring-line/70 transition-[box-shadow] duration-150 hover:ring-brand-border">
                      <FileText className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden="true" />
                      <Link href={`/student/new/${t.code}`} className="grid min-w-0 flex-1 after:absolute after:inset-0 after:rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-brand">
                        <span className="font-medium group-hover:text-brand">{t.name}</span>
                        <span className="text-sm text-ink-muted">{t.hint}</span>
                        <span className="mt-1 text-xs tabular-nums text-ink-muted">{t.code}</span>
                      </Link>
                      <span className="relative z-10 -my-1.5"><FormQrButton code={t.code} name={t.name} /></span>
                    </div>
                  ) : (
                    <div className="flex h-full items-start gap-3 rounded-[var(--radius-card)] border border-dashed border-line-strong p-3.5 text-ink-muted" aria-disabled="true">
                      <FileText className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                      <span className="grid">
                        <span className="font-medium">{t.name}</span>
                        <span className="text-sm">กำลังจัดทำแบบฟอร์มออนไลน์ · ยื่นกระดาษที่งานทะเบียนไปก่อน</span>
                      </span>
                      <span className="ml-auto text-xs tabular-nums">{t.code}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
