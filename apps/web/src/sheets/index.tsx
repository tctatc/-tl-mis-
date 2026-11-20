'use client';

import type { GeneralFormData, TemplateKey } from '@csis/shared';
import type { ReactNode } from 'react';
import type { SheetProps } from './blocks';
import { CourseChangeSheet } from './forms/CourseChangeSheet';
import { CourseDescSheet } from './forms/CourseDescSheet';
import { ConductSheet } from './forms/ConductSheet';
import { DeferFeeSheet } from './forms/DeferFeeSheet';
import { GraduateSheet } from './forms/GraduateSheet';
import { LeaveSheet } from './forms/LeaveSheet';
import { ResignSheet } from './forms/ResignSheet';
import { ReturnSheet } from './forms/ReturnSheet';
import { Transcript2Sheet } from './forms/Transcript2Sheet';
import { TransferListSheet, TransferSheet } from './forms/TransferSheet';
import { GeneralSheet } from './GeneralSheet';

/** แผ่นกระดาษของแต่ละแบบฟอร์ม (บางแบบมีหลายแผ่น เช่น ทอ.02 + ทอ.02-2) */
export function sheetsFor(template: TemplateKey, props: SheetProps): ReactNode[] {
  switch (template) {
    case 'general': return [<GeneralSheet key="g" {...props} data={props.data as unknown as GeneralFormData} />];
    case 'resign': return [<ResignSheet key="p" {...props} />];
    case 'leave': return [<LeaveSheet key="p" {...props} />];
    case 'return': return [<ReturnSheet key="p" {...props} />];
    case 'graduate': return [<GraduateSheet key="p" {...props} />];
    case 'transcript2': return [<Transcript2Sheet key="p" {...props} />];
    case 'conduct': return [<ConductSheet key="p" {...props} />];
    case 'course_change': return [<CourseChangeSheet key="p" {...props} />];
    case 'course_desc': return [<CourseDescSheet key="p" {...props} />];
    case 'defer_fee': return [<DeferFeeSheet key="p" {...props} />];
    case 'transfer': return [<TransferSheet key="p1" {...props} />, <TransferListSheet key="p2" {...props} />];
  }
}
