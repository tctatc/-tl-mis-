import Image from 'next/image';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-3">
      <Image src="/college-logo.png" alt="" width={compact ? 36 : 52} height={compact ? 36 : 52} priority />
      <span className="grid leading-tight">
        <span className={compact ? 'text-[15px] font-semibold' : 'text-lg font-semibold'}>ระบบทะเบียนออนไลน์</span>
        <span className={compact ? "hidden text-[13px] text-ink-muted sm:block" : "text-[13px] text-ink-muted"}>วิทยาลัยเทคนิคท่าหลวงซิเมนต์ไทยอนุสรณ์</span>
      </span>
    </span>
  );
}
