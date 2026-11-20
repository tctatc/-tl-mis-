import ExcelJS from 'exceljs';
import { SPECIAL_GRADES, parseScore, type SpecialGrade, type TeachSectionDetail } from '@csis/shared';
import { readRows, type Cell } from '../imports/file-reader.js';
import type { EntryRow } from './grading.service.js';

const HEAD = { code: 'รหัสนักศึกษา', name: 'ชื่อ-สกุล', score: 'คะแนนรวม (เต็ม 100)', special: 'ผลพิเศษ (ถ้ามี)' };
/** กันข้อความในเซลล์ถูก Excel ตีความเป็นสูตร */
const safe = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

/** ไฟล์ Excel ที่มีรายชื่อนักเรียนของวิชานี้ไว้แล้ว ครูกรอกคะแนนแล้วอัปโหลดกลับ */
export async function rosterTemplate(d: TeachSectionDetail): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('คะแนน');
  ws.addRow([HEAD.code, HEAD.name, HEAD.score, HEAD.special]).font = { bold: true };
  for (const r of d.rows) ws.addRow([r.studentCode, safe(r.name), r.score ?? null, r.special ?? null]);
  ws.getColumn(1).numFmt = '@';
  ws.getColumn(1).width = 16;
  ws.getColumn(2).width = 34;
  ws.getColumn(3).width = 20;
  ws.getColumn(4).width = 18;
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  // ช่องผลพิเศษเลือกจากรายการ (ลดพิมพ์ผิด)
  for (let i = 2; i <= d.rows.length + 1; i++) {
    ws.getCell(`D${i}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${SPECIAL_GRADES.join(',')}"`] };
    ws.getCell(`C${i}`).dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [0, 100], showErrorMessage: true, error: 'คะแนน 0 ถึง 100' };
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export interface ParsedRoster { rows: EntryRow[]; issues: { rowNo: number; message: string }[]; matched: number; total: number }

const text = (c: Cell | undefined) => (c === null || c === undefined ? '' : String(c).trim());
const normSpecial = (v: string): SpecialGrade | null | undefined => {
  const s = v.replace(/[.\s]/g, '');
  if (!s) return null;
  return (SPECIAL_GRADES as readonly string[]).includes(s) ? (s as SpecialGrade) : undefined;
};

/** อ่านไฟล์คะแนนที่ครูอัปโหลด — ไม่บันทึกอะไร คืนค่าไปเติมในตาราง */
export async function parseRoster(buf: Buffer, fileName: string, roster: TeachSectionDetail['rows']): Promise<ParsedRoster> {
  const { all } = await readRows(buf, fileName);
  const headerIdx = all.slice(0, 10).findIndex((r) => r.some((c) => text(c).includes('รหัส')));
  if (headerIdx < 0) return { rows: [], issues: [{ rowNo: 1, message: 'ไม่พบหัวคอลัมน์ "รหัสนักศึกษา" — ใช้ไฟล์ที่ดาวน์โหลดจากหน้านี้' }], matched: 0, total: 0 };
  const head = all[headerIdx]!.map(text);
  const col = (pred: (h: string) => boolean) => head.findIndex(pred);
  const codeCol = col((h) => h.includes('รหัส'));
  const scoreCol = col((h) => h.includes('คะแนน') || h.includes('รวม'));
  const specialCol = col((h) => h.includes('ผลพิเศษ'));
  if (scoreCol < 0 && specialCol < 0) return { rows: [], issues: [{ rowNo: headerIdx + 1, message: 'ไม่พบคอลัมน์ "คะแนนรวม"' }], matched: 0, total: 0 };

  const byCode = new Map(roster.map((r) => [r.studentCode, r.studentId]));
  const issues: ParsedRoster['issues'] = [];
  const out = new Map<string, EntryRow>();
  const data = all.slice(headerIdx + 1);
  let total = 0;
  data.forEach((r, i) => {
    const rowNo = headerIdx + 2 + i;
    const code = text(r[codeCol]).replace(/\D/g, '');
    if (!code) return;
    total += 1;
    const studentId = byCode.get(code);
    if (!studentId) { issues.push({ rowNo, message: `รหัส ${code} ไม่ได้ลงทะเบียนวิชานี้ — ข้ามแถวนี้` }); return; }
    const rawScore = scoreCol >= 0 ? r[scoreCol] : null;
    // Excel อาจเก็บคะแนนเฉลี่ยเป็นทศนิยมยาว → ปัด 2 ตำแหน่งก่อนตรวจ
    const scoreText = typeof rawScore === 'number' ? String(Math.round(rawScore * 100) / 100) : text(rawScore);
    const score = parseScore(scoreText);
    const special = specialCol >= 0 ? normSpecial(text(r[specialCol])) : null;
    if (score === undefined) { issues.push({ rowNo, message: `คะแนน "${scoreText}" ไม่ถูกต้อง (0–100) — ข้ามแถวนี้` }); return; }
    if (special === undefined) { issues.push({ rowNo, message: `ผลพิเศษ "${text(r[specialCol])}" ไม่รู้จัก (ใช้ ${SPECIAL_GRADES.join(' ')}) — ข้ามแถวนี้` }); return; }
    if (out.has(studentId)) issues.push({ rowNo, message: `รหัส ${code} ซ้ำ — ใช้แถวล่าสุด` });
    out.set(studentId, { studentId, score, special });
  });
  return { rows: [...out.values()], issues, matched: out.size, total };
}
