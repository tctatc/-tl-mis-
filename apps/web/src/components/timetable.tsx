import { DAY_NAMES, type ScheduleView } from '@csis/shared';
import { cx } from '@/components/ui';

type Session = ScheduleView['sessions'][number];

/** คาบเรียนของวิทยาลัย: คาบละ 1 ชม. เช้า 1–4 (08:30–12:30) บ่าย 5–11 (13:30–20:30) */
const MORNING = ['08:30', '09:30', '10:30', '11:30'] as const;
const AFTERNOON = ['13:30', '14:30', '15:30', '16:30', '17:30', '18:30', '19:30'] as const;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const plusHour = (t: string) => `${String(Number(t.slice(0, 2)) + 1).padStart(2, '0')}:${t.slice(3, 5)}`;

type Cell = { span: number; session?: Session };

/**
 * แบ่งคาบของครึ่งวัน (เช้า/บ่าย) เป็นช่อง: วิชาที่เรียนต่อกันหลายคาบรวมเป็นช่องเดียว
 * วิชาที่คร่อมพักกลางวันถูกตัดเป็นสองช่องตามคอลัมน์ "พักกลางวัน"
 * เวลาไม่ตรงคาบ (เช่น 09:00) ปัดลงคาบที่ครอบอยู่ ซ้อนกันให้ช่องแรกชนะ ไม่ให้ตารางเบี้ยว
 */
function cells(periods: readonly string[], sessions: Session[]): Cell[] {
  const out: Cell[] = [];
  const startOf = periods.map(minutes);
  const lastEnd = startOf[startOf.length - 1]! + 60;
  const slotOf = (m: number) => startOf.findLastIndex((s) => s <= m);
  let i = 0;
  for (const s of [...sessions].sort((a, b) => minutes(a.startTime) - minutes(b.startTime))) {
    if (minutes(s.startTime) >= lastEnd) continue;
    const begin = Math.max(0, i, slotOf(minutes(s.startTime)));
    const end = slotOf(minutes(s.endTime) - 1) + 1;
    if (end <= begin) continue;
    for (; i < begin; i++) out.push({ span: 1 });
    out.push({ span: end - begin, session: s });
    i = end;
  }
  for (; i < periods.length; i++) out.push({ span: 1 });
  return out;
}

/** ตัดคำนำหน้า เหลือชื่อต้นเหมือนตารางของวิทยาลัย เช่น "นางกชรัตน์ ใจดี" → "กชรัตน์" */
function shortName(name: string) {
  return name.replace(/^(ว่าที่\s*ร\.?\s*ต\.?\s*(หญิง)?|ดร\.|ครู|อาจารย์|อ\.|นางสาว|นาย|นาง)\s*/u, '').split(/\s+/)[0] ?? name;
}

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const border = 'border border-ink/70';

/** ตารางเรียนแบบที่วิทยาลัยแจก: แถว = วัน, คอลัมน์ = คาบ, มีกิจกรรมหน้าเสาธงและพักกลางวัน */
export function CollegeTimetable({ sessions, today }: { sessions: Session[]; today?: number }) {
  const byDay = (d: number) => sessions.filter((s) => s.dayOfWeek === d);
  const subjects = [...new Map(sessions.map((s) => [s.subject.code, s])).values()].sort((a, b) => a.subject.code.localeCompare(b.subject.code));
  const head = cx(border, 'px-0.5 py-2 text-center text-xs font-normal tabular-nums whitespace-nowrap');
  const band = cx(border, 'text-center align-middle text-ink-muted');

  const renderHalf = (periods: readonly string[], d: number) =>
    cells(periods, byDay(d)).map((c, k) => c.session ? (
      <td key={k} colSpan={c.span} className={cx(border, 'px-1 py-1.5 text-center align-middle leading-snug')}
        title={`${c.session.subject.name} · ${c.session.startTime}–${c.session.endTime} · ห้อง ${c.session.room} · ${c.session.teacher}`}>
        <span className="block tabular-nums">{c.session.subject.code}</span>
        <span className="block">{c.session.room}</span>
        <span className="block">{shortName(c.session.teacher)}</span>
      </td>
    ) : <td key={k} colSpan={c.span} className={border} />);

  return (
    <div className="grid gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] table-fixed border-collapse text-[13px] text-ink">
          <colgroup>
            <col className="w-24" />
            {Array.from({ length: 13 }, (_, i) => <col key={i} />)}
          </colgroup>
          <thead>
            <tr>
              <th scope="row" className={cx(border, 'py-3 text-lg font-semibold')}>เวลา</th>
              <th scope="col" className={head}>08:00 - 08:30</th>
              {MORNING.map((t) => <th key={t} scope="col" className={head}>{t} - {plusHour(t)}</th>)}
              <th scope="col" className={head}>12:30 - 13:30</th>
              {AFTERNOON.map((t) => <th key={t} scope="col" className={head}>{t} - {plusHour(t)}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" className={cx(border, 'py-2 text-lg font-semibold')}>วัน/คาบ</th>
              <td rowSpan={DAYS.length + 1} className={band}><span className="inline-block rotate-180 [writing-mode:vertical-rl]">กิจกรรมหน้าเสาธง</span></td>
              {MORNING.map((_, i) => <td key={i} className={cx(border, 'py-2 text-center tabular-nums')}>{i + 1}</td>)}
              <td rowSpan={DAYS.length + 1} className={band}><span className="inline-block rotate-180 [writing-mode:vertical-rl]">พักกลางวัน</span></td>
              {AFTERNOON.map((_, i) => <td key={i} className={cx(border, 'py-2 text-center tabular-nums')}>{i + 5}</td>)}
            </tr>
            {DAYS.map((d) => (
              <tr key={d} className="h-[5.5rem]">
                <th scope="row" className={cx(border, 'text-base font-semibold whitespace-nowrap', d === today && 'bg-brand-soft text-brand')}>
                  วัน{DAY_NAMES[d]}{d === today && <span className="block text-xs font-medium">วันนี้</span>}
                </th>
                {renderHalf(MORNING, d)}
                {renderHalf(AFTERNOON, d)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {subjects.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-muted">รายวิชาในตาราง</h3>
          <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 xl:grid-cols-3">
            {subjects.map((s) => (
              <li key={s.subject.code} className="flex gap-2">
                <span className="shrink-0 tabular-nums font-medium">{s.subject.code}</span>
                <span className="min-w-0 text-ink-muted">{s.subject.name} · {s.teacher}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
