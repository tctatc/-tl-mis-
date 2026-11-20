import { getRequestType, formatThaiDateTime, type RequestSummary } from '@csis/shared';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from './ui';

export function RequestList({ items, showStudent = false }: { items: RequestSummary[]; showStudent?: boolean }) {
  return (
    <ul className="divide-y divide-line/80">
      {items.map((r) => (
        <li key={r.id}>
          <Link href={`/requests/${r.id}`} className="group flex items-center gap-3 px-4 py-3.5 hover:bg-sunken/60 sm:px-5">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-medium">{getRequestType(r.typeCode)?.name ?? r.typeCode}</span>
                <StatusBadge status={r.status} />
              </div>
              <p className="mt-0.5 truncate text-sm text-ink-muted">
                <span className="tabular-nums">{r.requestNo}</span>
                {showStudent && <> · {r.studentName} <span className="tabular-nums">({r.studentCode})</span></>}
                {' · '}ยื่น {formatThaiDateTime(r.submittedAt)}
              </p>
              {r.waitingFor && <p className="mt-0.5 text-sm text-ink-muted">รอ: {r.waitingFor}</p>}
            </div>
            <ChevronRight className="size-5 shrink-0 text-ink-muted transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
