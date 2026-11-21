'use client';

import { ArrowLeft, BookOpen, Lightbulb, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Brand } from '@/components/Brand';
import { cx } from '@/components/ui';
import { AUDIENCES, TOPICS, type Audience, type Topic } from './content';

const SIZE: Record<string, [number, number]> = { 'staff-dashboard': [1280, 560], 'users-create': [512, 646] };
const dims = (img: string, mobile?: boolean): [number, number] => SIZE[img] ?? (mobile ? [390, 780] : [1280, 760]);
/** ค้นแบบไม่สนช่องว่าง/ตัวพิมพ์ */
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
const haystack = (t: Topic) => norm([t.title, t.summary, t.keywords ?? '', ...t.steps.map((s) => s.text), ...(t.tips ?? [])].join(' '));

export default function HelpPage() {
  const [who, setWho] = useState<Audience>('student');
  const [q, setQ] = useState('');
  // เปิดจากลิงก์ /help?for=teacher หรือ #topic ได้
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('for');
    if (p && p in AUDIENCES) setWho(p as Audience);
  }, []);
  const query = norm(q);
  const topics = useMemo(
    () => (query ? TOPICS.filter((t) => haystack(t).includes(query)) : TOPICS.filter((t) => t.audience.includes(who))),
    [query, who],
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/" className="shrink-0 rounded-md" aria-label="กลับหน้าแรก"><Brand compact /></Link>
          <Link href="/" className="ml-auto inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-[15px] text-ink-muted hover:bg-sunken hover:text-ink"><ArrowLeft className="size-4" aria-hidden="true" />กลับเข้าระบบ</Link>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <div>
          <h1 className="flex items-center gap-2 text-[26px] font-semibold sm:text-[30px]"><BookOpen className="size-7 text-brand" aria-hidden="true" />คู่มือการใช้งาน</h1>
          <p className="mt-1 text-[17px] text-ink-muted">เลือกว่าคุณเป็นใคร หรือพิมพ์สิ่งที่อยากทำในช่องค้นหา</p>
        </div>

        <label className="relative block">
          <span className="sr-only">ค้นหาหัวข้อในคู่มือ</span>
          <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="เช่น ลืมรหัสผ่าน, ยื่นคำร้อง, นำเข้า Excel, กรอกเกรด"
            className="min-h-14 w-full rounded-[var(--radius-card)] bg-surface pr-12 pl-12 text-[17px] shadow-card ring-1 ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand" />
          {q && <button type="button" onClick={() => setQ('')} className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-sunken" aria-label="ล้างคำค้น"><X className="size-5" aria-hidden="true" /></button>}
        </label>

        {!query && (
          <div role="tablist" aria-label="คู่มือสำหรับ" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {(Object.keys(AUDIENCES) as Audience[]).map((a) => (
              <button key={a} role="tab" aria-selected={who === a} onClick={() => setWho(a)}
                className={cx('rounded-[var(--radius-card)] p-3 text-left ring-1 transition-colors sm:p-4', who === a ? 'bg-brand-deep text-ink-inverse ring-brand-deep' : 'bg-surface ring-line hover:bg-sunken')}>
                <span className="block text-[17px] font-semibold">{AUDIENCES[a].label}</span>
                <span className={cx('mt-0.5 block text-sm', who === a ? 'text-white/75' : 'text-ink-muted')}>{AUDIENCES[a].who}</span>
              </button>
            ))}
          </div>
        )}

        {topics.length === 0 ? (
          <div className="rounded-[var(--radius-card)] bg-surface p-8 text-center shadow-card ring-1 ring-line/70">
            <p className="text-[17px] font-medium">ไม่พบหัวข้อ “{q}”</p>
            <p className="mt-1 text-ink-muted">ลองใช้คำสั้นลง เช่น “รหัส” “คำร้อง” “เกรด” หรือติดต่องานทะเบียน</p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
            <nav aria-label="หัวข้อในหน้านี้" className="lg:sticky lg:top-24 lg:self-start">
              <p className="mb-2 text-sm font-medium text-ink-muted">{query ? `พบ ${topics.length} หัวข้อ` : `หัวข้อสำหรับ${AUDIENCES[who].label}`}</p>
              <ol className="grid gap-0.5 text-[15px]">
                {topics.map((t, i) => (
                  <li key={t.id}><a href={`#${t.id}`} className="flex gap-2 rounded-md px-2 py-1.5 hover:bg-sunken"><span className="tabular-nums text-ink-muted">{i + 1}.</span>{t.title}</a></li>
                ))}
              </ol>
            </nav>

            <div className="grid min-w-0 gap-5">
              {topics.map((t, i) => (
                <article key={t.id} id={t.id} className="scroll-mt-24 rounded-[var(--radius-card)] bg-surface p-4 shadow-card ring-1 ring-line/70 sm:p-6">
                  <h2 className="text-[21px] font-semibold"><span className="mr-2 text-brand tabular-nums">{i + 1}.</span>{t.title}</h2>
                  <p className="mt-1 text-[16px] text-ink-muted">{t.summary}</p>
                  {query && <p className="mt-1 text-sm text-ink-muted">สำหรับ: {t.audience.map((a) => AUDIENCES[a].label).join(' · ')}</p>}
                  <ol className="mt-4 grid gap-4">
                    {t.steps.map((s, k) => (
                      <li key={k} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                        <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-[15px] font-semibold text-brand" aria-hidden="true">{k + 1}</span>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[17px] leading-relaxed">{s.text}</p>
                          {s.img && (
                            // eslint-disable-next-line @next/next/no-img-element -- ภาพนิ่งใน /public ขนาดคงที่ ไม่ต้องผ่าน optimizer
                            <img src={`/help/${s.img}.jpg`} alt={s.alt ?? ''} width={dims(s.img, s.mobile)[0]} height={dims(s.img, s.mobile)[1]} loading="lazy" decoding="async"
                              className={cx('mt-3 h-auto rounded-[var(--radius-control)] shadow-card ring-1 ring-line', s.mobile ? 'w-full max-w-[260px]' : s.img === 'users-create' ? 'w-full max-w-sm' : 'w-full max-w-3xl')} />
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {t.tips && (
                    <div className="mt-4 grid gap-1.5 rounded-[var(--radius-control)] bg-gold-soft p-3 text-[15px] text-gold-ink sm:p-4">
                      {t.tips.map((tip) => <p key={tip} className="flex gap-2"><Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{tip}</p>)}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
