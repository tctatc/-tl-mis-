'use client';

import { tpn, type RegistrationCardView } from '@csis/shared';
import { ClipboardList, Printer } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, PageHeader, TermSelect } from '@/components/academic';
import { PreviewFrame } from '@/components/PreviewFrame';
import { Alert, Button, Card, Spinner } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useApi } from '@/lib/useApi';
import { RegistrationSheet } from '@/sheets/RegistrationSheet';

const KIND: Record<string, string> = { repeat: 'เรียนซ้ำ', regrade: 'รีเกรด' };

export default function RegistrationPage() {
  const { me } = useMe();
  const [termId, setTermId] = useState<string>();
  const { data, error, loading } = useApi<RegistrationCardView>(`/student/registration${termId ? `?termId=${termId}` : ''}`);

  if (error) return <Alert>{error}</Alert>;
  if (!data || !me?.student) return <Spinner />;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="บัตรลงทะเบียน"
        subtitle={data.term ? <>ภาคเรียน {data.term.label}{data.term.isCurrent ? ' (ปัจจุบัน)' : ''} · {data.subjects.length} รายวิชา · <strong className="text-ink">{data.totalCredits} หน่วยกิต</strong></> : undefined}
        actions={<>
          <TermSelect terms={data.terms} value={data.term?.id} onChange={setTermId} />
          {data.term && <Button onClick={() => window.print()} icon={<Printer className="size-4" aria-hidden="true" />}>พิมพ์ / บันทึก PDF</Button>}
        </>}
      />
      {!data.term ? (
        <Card><EmptyState icon={<ClipboardList className="size-7" aria-hidden="true" />} title="ยังไม่มีการลงทะเบียน">เมื่อลงทะเบียนเรียนแล้ว บัตรลงทะเบียนจะขึ้นที่นี่</EmptyState></Card>
      ) : loading ? <Spinner /> : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line/70">
              {data.subjects.map((s) => (
                <li key={s.subject.code} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{s.subject.name}{KIND[s.kind] && <span className="ml-2 rounded bg-info-soft px-1.5 py-0.5 text-xs text-info">{KIND[s.kind]}</span>}</p>
                    <p className="text-sm text-ink-muted"><span className="tabular-nums">{s.subject.code}</span> · กลุ่ม {s.groupCode} · {s.teacher || 'ยังไม่ระบุผู้สอน'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{s.subject.credits}</p>
                    <p className="text-xs tabular-nums text-ink-muted">{tpn(s.subject)}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="flex justify-between border-t border-line/80 bg-sunken/50 px-4 py-3 font-semibold">
              <span>รวม</span><span className="tabular-nums">{data.totalCredits} หน่วยกิต</span>
            </div>
          </Card>
          <div><PreviewFrame print><RegistrationSheet card={data} student={me.student} /></PreviewFrame></div>
        </div>
      )}
    </div>
  );
}
