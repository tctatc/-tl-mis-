'use client';

import { LEVEL_LABEL, formatThaiDate, fullName, parseIsoDate, type ProfileView } from '@csis/shared';
import { PencilLine } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { PageHeader } from '@/components/academic';
import { Alert, Card, Spinner } from '@/components/ui';
import { useMe } from '@/lib/me';
import { useApi } from '@/lib/useApi';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      <dl className="mt-3 grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-[15px]">{children}</dl>
    </Card>
  );
}
const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <><dt className="text-ink-muted">{label}</dt><dd className="min-w-0 break-words">{value || <span className="text-ink-muted">–</span>}</dd></>
);

export default function ProfilePage() {
  const { me } = useMe();
  const { data, error, loading } = useApi<ProfileView>('/student/profile');
  if (error) return <Alert>{error}</Alert>;
  if (loading || !data || !me?.student) return <Spinner />;
  const s = me.student;

  return (
    <div className="grid gap-6">
      <PageHeader title="ข้อมูลประวัติ" subtitle="ข้อมูลตามทะเบียนของวิทยาลัย"
        actions={<Link href={`/student/new/D01?topic=${encodeURIComponent('ขอแก้ไขข้อมูลส่วนตัว')}`} className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-control)] bg-surface px-4 text-[15px] font-medium ring-1 ring-line-strong hover:bg-sunken">
          <PencilLine className="size-4" aria-hidden="true" /> ขอแก้ไขข้อมูล
        </Link>} />
      <Alert tone="info">แก้ไขข้อมูลเองไม่ได้ ถ้าข้อมูลไม่ถูกต้อง ให้กด “ขอแก้ไขข้อมูล” (ยื่นแบบคำร้องทั่วไป) งานทะเบียนจะตรวจเอกสารก่อนแก้ให้</Alert>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="ข้อมูลการศึกษา">
          <Row label="รหัสนักศึกษา" value={<span className="tabular-nums">{s.studentCode}</span>} />
          <Row label="สถานภาพ" value={data.status} />
          <Row label="ระดับ" value={`${LEVEL_LABEL[s.level]} ชั้นปีที่ ${s.yearLevel} กลุ่ม ${s.groupNo}`} />
          <Row label="แผนก" value={s.department} />
          <Row label="สาขาวิชา" value={s.program} />
          <Row label="หลักสูตร" value={data.curriculum} />
          <Row label="เข้าศึกษา" value={data.entry && `ภาคเรียน ${data.entry}`} />
          <Row label="ครูที่ปรึกษา" value={data.advisor} />
        </Section>
        <Section title="ข้อมูลส่วนตัว">
          <Row label="ชื่อ-สกุล" value={fullName(s)} />
          <Row label="ชื่อเล่น" value={data.nickname} />
          <Row label="วันเกิด" value={formatThaiDate(parseIsoDate(s.birthDate))} />
          <Row label="เลขประจำตัวประชาชน" value={<span className="tabular-nums">{data.nationalIdMasked}</span>} />
          <Row label="สัญชาติ / ศาสนา" value={[data.nationality, data.religion].filter(Boolean).join(' / ')} />
          <Row label="กรุ๊ปเลือด" value={data.bloodType} />
          <Row label="โทรศัพท์" value={<span className="tabular-nums">{s.phone}</span>} />
          <Row label="อีเมล" value={data.email} />
        </Section>
        <Section title="ที่อยู่">
          {data.addresses.length === 0 ? <Row label="ที่อยู่" value="" /> : data.addresses.map((a) => (
            <Row key={a.kind} label={a.kind === 'home' ? 'ตามทะเบียนบ้าน' : 'ปัจจุบัน'} value={a.text} />
          ))}
        </Section>
        <Section title="ประวัติการศึกษาเดิม">
          <Row label="สถานศึกษา" value={data.previous.school} />
          <Row label="วุฒิ" value={data.previous.level} />
          <Row label="เกรดเฉลี่ย" value={<span className="tabular-nums">{data.previous.gpa}</span>} />
        </Section>
      </div>

      <Card className="p-4 sm:p-5">
        <h2 className="font-semibold">ผู้ปกครอง</h2>
        {data.guardians.length === 0 ? <p className="mt-2 text-ink-muted">ยังไม่มีข้อมูล</p> : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.guardians.map((g) => (
              <li key={`${g.relation}-${g.name}`} className="rounded-[var(--radius-control)] bg-sunken/60 p-3">
                <p className="text-sm text-ink-muted">{g.relation}{g.isPrimary && <span className="ml-2 rounded bg-gold-soft px-1.5 py-0.5 text-xs text-gold-ink">ผู้ติดต่อหลัก</span>}</p>
                <p className="font-medium">{g.name}</p>
                <p className="text-sm text-ink-muted">{g.occupation}{g.phone && <> · <span className="tabular-nums">{g.phone}</span></>}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
