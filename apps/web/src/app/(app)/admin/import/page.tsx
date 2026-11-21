'use client';

import { formatThaiDateTime, type AcademicKind } from '@csis/shared';
import { BookOpen, CalendarDays, Download, FileSpreadsheet, GraduationCap, History, UploadCloud, UserRound, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { EmptyState, PageHeader } from '@/components/academic';
import { AcademicImport } from '@/components/AcademicImport';
import { Dialog } from '@/components/Dialog';
import { StudentImport } from '@/components/StudentImport';
import { Alert, Button, Spinner, cx } from '@/components/ui';
import { useApi } from '@/lib/useApi';
import { useTerms } from '../academic/shared';

type Kind = 'student' | AcademicKind;
interface Job { id: string; kind: Kind; fileName: string; status: 'uploaded' | 'previewed' | 'committing' | 'committed' | 'failed'; createdAt: string; committedAt: string | null; total: number; created: number; updated: number; errors: number; by: string; error: string | null }
interface History { kinds: Kind[]; items: Job[] }

/** ลำดับที่แนะนำ: นักเรียน → ครู → รายวิชา/แผน → ตาราง (ลงทะเบียนให้เอง) → ผลการเรียนย้อนหลัง */
const TYPES: { kind: Kind; title: string; icon: ReactNode; what: string; note: string; template: string }[] = [
  { kind: 'student', title: 'นักเรียน นักศึกษา', icon: <Users className="size-6" aria-hidden="true" />, what: 'ทะเบียนประวัติ ระดับ แผนก สาขา กลุ่ม ครูที่ปรึกษา',
    note: 'ใช้ไฟล์ที่ส่งออกจาก ศธ.02 ได้ · เพิ่มแผนก/สาขาที่ยังไม่มีให้เอง · รหัสผ่านเริ่มต้น = วันเกิด (พ.ศ.)', template: '/api/admin/imports/students/template' },
  { kind: 'staff', title: 'ครูและบุคลากร', icon: <UserRound className="size-6" aria-hidden="true" />, what: 'รหัสบุคลากร ชื่อ ตำแหน่ง ประเภทบุคลากร แผนก สาขา สถานะ',
    note: 'บัญชีใหม่ระงับไว้ก่อน ผู้ดูแลเปิดใช้และตั้งรหัสผ่านให้ทีละคน', template: '/api/admin/academic/imports/staff/template' },
  { kind: 'plan', title: 'รายวิชาและแผนการเรียน', icon: <BookOpen className="size-6" aria-hidden="true" />, what: 'รหัสวิชา ชื่อวิชา ท-ป-น หมวดวิชา ชั้นปี/ภาคเรียนของแต่ละสาขา',
    note: 'สร้างรายวิชาและหลักสูตรของสาขาให้อัตโนมัติ', template: '/api/admin/academic/imports/plan/template' },
  { kind: 'schedule', title: 'ตารางเรียนและการลงทะเบียน', icon: <CalendarDays className="size-6" aria-hidden="true" />, what: 'ห้อง วัน เวลา รหัสวิชา ห้องเรียน ครูผู้สอน',
    note: 'ลงทะเบียนวิชาให้นักเรียนทุกคนในห้องเอง ไม่ต้องนำเข้าการลงทะเบียนแยก', template: '/api/admin/academic/imports/schedule/template' },
  { kind: 'grade', title: 'ผลการเรียนย้อนหลัง', icon: <GraduationCap className="size-6" aria-hidden="true" />, what: 'รหัสนักศึกษา รหัสวิชา เกรด',
    note: 'เฉพาะภาคเรียนที่ผ่านมา (ภาคปัจจุบันครูกรอกเองในเมนูกรอกเกรด) · นักเรียนยังไม่เห็นจนกว่าจะประกาศผล', template: '/api/admin/academic/imports/grade/template' },
];
const KIND_NAME: Record<Kind, string> = { student: 'นักเรียน', staff: 'ครูและบุคลากร', plan: 'แผนการเรียน', schedule: 'ตารางเรียน', grade: 'ผลการเรียน' };
const STATUS: Record<Job['status'], { label: string; cls: string }> = {
  committed: { label: 'นำเข้าสำเร็จ', cls: 'bg-ok-soft text-ok' },
  failed: { label: 'ไม่สำเร็จ', cls: 'bg-danger-soft text-danger' },
  committing: { label: 'กำลังบันทึก', cls: 'bg-info-soft text-info' },
  previewed: { label: 'ตรวจแล้ว ยังไม่ยืนยัน', cls: 'bg-sunken text-ink-muted' },
  uploaded: { label: 'อัปโหลดแล้ว ยังไม่ตรวจ', cls: 'bg-sunken text-ink-muted' },
};

export default function ImportCenter() {
  const history = useApi<History>('/admin/imports/history');
  const terms = useTerms();
  const [open, setOpen] = useState<Kind | null>(null);
  const allowed = history.data?.kinds;
  const types = TYPES.filter((t) => !allowed || allowed.includes(t.kind));
  const past = terms.find((t) => !t.isCurrent)?.id;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <PageHeader title="ศูนย์นำเข้าข้อมูล" subtitle="นำเข้าจากไฟล์ Excel (.xlsx) หรือ CSV · ทุกไฟล์ต้องผ่านการตรวจก่อน และไม่มีอะไรถูกบันทึกจนกว่าจะกดยืนยัน" />

      <ol className="grid gap-2 rounded-[var(--radius-card)] bg-surface p-4 text-[15px] shadow-card ring-1 ring-line/70 sm:grid-cols-5 sm:p-5" aria-label="ขั้นตอนการนำเข้า">
        {['ดาวน์โหลดแบบฟอร์ม หรือใช้ไฟล์จาก ศธ.02', 'เลือกไฟล์ ระบบจับคู่คอลัมน์ให้', 'ตรวจข้อมูล ดูแถวที่ผิด/ซ้ำ', 'แก้ในไฟล์ (โหลดรายงานข้อผิดพลาดได้)', 'กดยืนยัน แล้วดูผลการนำเข้า'].map((s, i) => (
          <li key={s} className="flex items-start gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-ink-inverse">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>

      {history.error ? <Alert>{history.error}</Alert> : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="ประเภทข้อมูล">
          {types.map((t, i) => (
            <article key={t.kind} className="flex min-w-0 flex-col rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70 sm:p-5">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">{t.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm text-ink-muted">ลำดับแนะนำ {i + 1}</p>
                  <h2 className="text-[18px] font-semibold">{t.title}</h2>
                </div>
              </div>
              <p className="mt-3 text-[15px]"><span className="text-ink-muted">ข้อมูล: </span>{t.what}</p>
              <p className="mt-1 text-sm text-ink-muted">{t.note}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                <Button onClick={() => setOpen(t.kind)} icon={<UploadCloud className="size-4" aria-hidden="true" />}>นำเข้า</Button>
                <a href={`${t.template}.xlsx`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-brand ring-1 ring-brand-border hover:bg-brand-soft"><Download className="size-4" aria-hidden="true" />แบบฟอร์ม Excel</a>
                <a href={`${t.template}.csv`} className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[15px] font-medium text-ink-muted ring-1 ring-line-strong hover:bg-sunken">CSV</a>
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-card ring-1 ring-line/70" aria-labelledby="import-history">
        <h2 id="import-history" className="flex items-center gap-2 border-b border-line/80 px-4 py-3 text-[17px] font-semibold sm:px-5"><History className="size-5 text-ink-muted" aria-hidden="true" />ประวัติการนำเข้า</h2>
        {!history.data ? <Spinner /> : history.data.items.length === 0 ? (
          <EmptyState icon={<FileSpreadsheet className="size-7" aria-hidden="true" />} title="ยังไม่เคยนำเข้าข้อมูล">เลือกประเภทข้อมูลด้านบนเพื่อเริ่ม</EmptyState>
        ) : (
          <>
            <table className="hidden w-full text-[15px] md:table">
              <thead className="bg-sunken/60 text-left text-sm text-ink-muted">
                <tr>{['วันเวลา', 'ประเภท', 'ไฟล์', 'ผู้นำเข้า', 'ทั้งหมด', 'เพิ่ม', 'อัปเดต', 'ผิดพลาด', 'สถานะ'].map((h) => <th key={h} scope="col" className="px-3 py-2.5 font-medium first:pl-5">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-line/70">
                {history.data.items.map((j) => (
                  <tr key={j.id}>
                    <td className="py-2.5 pr-3 pl-5 text-sm whitespace-nowrap text-ink-muted">{formatThaiDateTime(j.committedAt ?? j.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{KIND_NAME[j.kind] ?? j.kind}</td>
                    <td className="max-w-[16rem] truncate px-3 py-2.5" title={j.fileName}>{j.fileName}</td>
                    <td className="px-3 py-2.5">{j.by}</td>
                    <td className="px-3 py-2.5 tabular-nums">{j.total.toLocaleString('th-TH')}</td>
                    <td className="px-3 py-2.5 tabular-nums">{j.status === 'committed' || j.status === 'previewed' ? j.created.toLocaleString('th-TH') : '–'}</td>
                    <td className="px-3 py-2.5 tabular-nums">{j.status === 'committed' || j.status === 'previewed' ? j.updated.toLocaleString('th-TH') : '–'}</td>
                    <td className={cx('px-3 py-2.5 tabular-nums', j.errors ? 'text-danger' : '')}>{j.status === 'committed' || j.status === 'previewed' ? j.errors.toLocaleString('th-TH') : '–'}</td>
                    <td className="px-3 py-2.5"><span className={cx('rounded-full px-2.5 py-0.5 text-sm whitespace-nowrap', STATUS[j.status].cls)} title={j.error ?? undefined}>{STATUS[j.status].label}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line/70 md:hidden">
              {history.data.items.map((j) => (
                <li key={j.id} className="grid gap-1 px-4 py-3">
                  <span className="flex items-center justify-between gap-2"><span className="font-medium">{KIND_NAME[j.kind] ?? j.kind}</span><span className={cx('rounded-full px-2.5 py-0.5 text-sm', STATUS[j.status].cls)}>{STATUS[j.status].label}</span></span>
                  <span className="truncate text-[15px]">{j.fileName}</span>
                  <span className="text-sm text-ink-muted">{formatThaiDateTime(j.committedAt ?? j.createdAt)} · {j.by} · {j.total} แถว{j.status === 'committed' ? ` · เพิ่ม ${j.created} อัปเดต ${j.updated} ผิด ${j.errors}` : ''}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Dialog open={open === 'student'} onClose={() => setOpen(null)} title="นำเข้านักเรียน นักศึกษา" xl>
        {open === 'student' && <StudentImport onCommitted={() => void history.reload()} onClose={() => setOpen(null)} />}
      </Dialog>
      {(['staff', 'plan', 'schedule', 'grade'] as const).map((k) => (
        <Dialog key={k} open={open === k} onClose={() => { setOpen(null); void history.reload(); }} title={`นำเข้า${TYPES.find((t) => t.kind === k)!.title}`} xl>
          {open === k && <AcademicImport kind={k} terms={terms} {...(k === 'grade' && past ? { defaultTermId: past } : {})} onCommitted={() => void history.reload()} onClose={() => setOpen(null)} />}
        </Dialog>
      ))}
    </div>
  );
}
