import Image from 'next/image';
import { cx } from './ui';

/**
 * ตราระบบ TLMis — โลโก้วิทยาลัย + ชื่อระบบ
 * tone="inverse" ใช้บนพื้นแดงเข้ม (หน้าแรก)
 */
export function Brand({ compact = false, tone = 'default' }: { compact?: boolean; tone?: 'default' | 'inverse' }) {
  const inverse = tone === 'inverse';
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Image src="/college-logo.png" alt="" width={compact ? 36 : 48} height={compact ? 36 : 48} priority className="shrink-0" />
      <span className="grid min-w-0 leading-tight">
        <span className="flex items-baseline gap-2">
          <Wordmark className={compact ? 'text-[17px]' : 'text-[22px]'} inverse={inverse} />
          <span className={cx('truncate', compact ? 'hidden text-[13px] sm:inline lg:hidden xl:inline' : 'text-sm', inverse ? 'text-white/80' : 'text-ink-muted')}>ระบบบริการนักเรียน นักศึกษา</span>
        </span>
        <span className={cx('truncate', compact ? 'hidden text-[13px] xl:block' : 'text-[13px]', inverse ? 'text-white/70' : 'text-ink-muted')}>วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์</span>
      </span>
    </span>
  );
}

/** ชื่อ TLMis: TL สีแบรนด์ (บนพื้นเข้มเป็นทอง) Mis สีตัวอักษรปกติ — ไม่ใช้ไล่สี */
export function Wordmark({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span className={cx('font-bold tracking-[-0.02em]', className)} aria-label="TLMis">
      <span aria-hidden="true" className={inverse ? 'text-gold' : 'text-brand'}>TL</span>
      <span aria-hidden="true" className={inverse ? 'text-white' : 'text-ink'}>Mis</span>
    </span>
  );
}
