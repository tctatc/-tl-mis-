import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { IMPORT_LIMITS, guessMapping } from '@csis/shared';

export type Cell = string | number | null;
export interface ParsedSheet { headers: string[]; rows: Cell[][]; headerRowNo: number; sheetName: string; encoding?: string }

/** ตรวจชนิดไฟล์จากเนื้อไฟล์จริง (ไม่เชื่อนามสกุลอย่างเดียว) */
function detect(buf: Buffer, name: string): 'xlsx' | 'csv' {
  const lower = name.toLowerCase();
  const isZip = buf.length > 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04;
  const isOle = buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
  if (isOle || lower.endsWith('.xls')) throw new BadRequestException('ไฟล์ Excel รุ่นเก่า (.xls) — เปิดใน Excel แล้ว “บันทึกเป็น” .xlsx หรือ .csv ก่อน');
  if (isZip) {
    if (!lower.endsWith('.xlsx')) throw new BadRequestException('รองรับเฉพาะ .xlsx และ .csv');
    return 'xlsx';
  }
  if (!/\.(csv|txt)$/.test(lower)) throw new BadRequestException('รองรับเฉพาะ .xlsx และ .csv');
  if (buf.subarray(0, 4096).includes(0)) throw new BadRequestException('ไฟล์ไม่ใช่ข้อความ CSV');
  return 'csv';
}

/** CSV จาก Excel บน Windows มักเป็น Windows-874 (ภาษาไทยแบบเก่า) — ลอง UTF-8 ก่อน ไม่ผ่านค่อยใช้ 874 */
function decodeText(buf: Buffer): { text: string; encoding: string } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''), encoding: 'UTF-8' };
  } catch {
    return { text: new TextDecoder('windows-874').decode(buf), encoding: 'Windows-874 (TIS-620)' };
  }
}

function cellValue(v: ExcelJS.CellValue): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    if ('result' in v) return cellValue(v.result as ExcelJS.CellValue); // สูตร
    if ('richText' in v) return v.richText.map((r) => r.text).join('');
    if ('text' in v) return String(v.text); // hyperlink
    if ('error' in v) return null;
  }
  return String(v);
}

/** หาแถวหัวตาราง: แถวแรก (ใน 10 แถวบน) ที่จับคู่หัวคอลัมน์ได้ตั้งแต่ 2 ช่อง — บางไฟล์มีชื่อรายงานอยู่บรรทัดบน */
function splitHeader(all: Cell[][]): { headers: string[]; rows: Cell[][]; headerRowNo: number } {
  const nonEmpty = (r: Cell[]) => r.some((c) => c !== null && String(c).trim() !== '');
  let idx = all.findIndex(nonEmpty);
  for (let i = 0; i < Math.min(10, all.length); i++) {
    if (Object.keys(guessMapping(all[i]!.map((c) => String(c ?? '')))).length >= 2) { idx = i; break; }
  }
  if (idx < 0) throw new BadRequestException('ไฟล์ว่าง ไม่มีข้อมูล');
  const headers = all[idx]!.map((c, i) => String(c ?? '').trim() || `คอลัมน์ ${i + 1}`);
  const rows = all.slice(idx + 1).filter(nonEmpty).map((r) => headers.map((_, i) => r[i] ?? null));
  return { headers, rows, headerRowNo: idx + 1 };
}

/** อ่านทุกแถวของแผ่นงานแรกที่มีข้อมูล (หรือ CSV) เป็นค่า — ไม่รันสูตร ใช้ค่าที่ Excel คำนวณเก็บไว้ */
export async function readRows(buf: Buffer, fileName: string): Promise<{ all: Cell[][]; sheetName: string; encoding?: string }> {
  if (buf.length > IMPORT_LIMITS.maxBytes) throw new BadRequestException('ไฟล์ใหญ่เกิน 5 MB');
  const type = detect(buf, fileName);
  let all: Cell[][];
  let sheetName = '';
  let encoding: string | undefined;
  if (type === 'xlsx') {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      throw new BadRequestException('เปิดไฟล์ Excel ไม่ได้ ไฟล์อาจเสียหรือมีรหัสผ่าน');
    }
    const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
    if (!ws) throw new BadRequestException('ไฟล์ Excel ไม่มีข้อมูล');
    sheetName = ws.name;
    all = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const values = row.values as ExcelJS.CellValue[]; // index 0 ว่างเสมอ
      all.push(values.slice(1).map(cellValue));
    });
  } else {
    const decoded = decodeText(buf);
    encoding = decoded.encoding;
    const parsed = Papa.parse<string[]>(decoded.text, { skipEmptyLines: 'greedy', delimitersToGuess: [',', ';', '\t', '|'] });
    all = parsed.data.map((r) => r.map((c) => (c === '' ? null : c)));
  }
  return { all, sheetName, ...(encoding ? { encoding } : {}) };
}

export async function readSheet(buf: Buffer, fileName: string): Promise<ParsedSheet> {
  const { all, sheetName, encoding } = await readRows(buf, fileName);
  const { headers, rows, headerRowNo } = splitHeader(all);
  if (rows.length === 0) throw new BadRequestException('มีแต่หัวตาราง ไม่มีข้อมูล');
  if (rows.length > IMPORT_LIMITS.maxRows) throw new BadRequestException(`ข้อมูลเกิน ${IMPORT_LIMITS.maxRows.toLocaleString()} แถว — แบ่งไฟล์ตามแผนก/รุ่นแล้วนำเข้าทีละไฟล์`);
  return { headers, rows, headerRowNo, sheetName, ...(encoding ? { encoding } : {}) };
}

/** ไฟล์ตัวอย่างให้ดาวน์โหลด */
export const TEMPLATE_HEADERS = ['รหัสนักศึกษา', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'วันเกิด', 'ระดับ', 'แผนกวิชา', 'สาขาวิชา', 'กลุ่ม', 'เบอร์โทรศัพท์', 'เลขประจำตัวประชาชน', 'ชื่อ-สกุล บิดา', 'ชื่อ-สกุล มารดา', 'ครูที่ปรึกษา'];
export const TEMPLATE_SAMPLE = [
  ['6820101001', 'นาย', 'สมชาย', 'ใจดี', '01/11/2551', 'ปวช.', 'ช่างยนต์', 'ช่างยนต์', '1', '0812345678', '', 'นายสมศักดิ์ ใจดี', 'นางสมศรี ใจดี', ''],
  ['6930101002', 'นางสาว', 'สมหญิง', 'รักเรียน', '15/03/2550', 'ปวส.', 'ไฟฟ้า', 'ไฟฟ้า', '2', '0898765432', '', '', '', ''],
];

export async function templateXlsx(headers: string[] = TEMPLATE_HEADERS, sample: string[][] = TEMPLATE_SAMPLE, sheet = 'นักเรียน'): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(headers).font = { bold: true };
  for (const r of sample) ws.addRow(r);
  ws.columns.forEach((c) => { c.width = 16; c.numFmt = '@'; }); // เป็นข้อความทั้งหมด กัน Excel ตัด 0 หน้า/แปลงวันที่
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export function templateCsv(headers: string[] = TEMPLATE_HEADERS, sample: string[][] = TEMPLATE_SAMPLE): Buffer {
  const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = [headers, ...sample].map((r) => r.map(esc).join(',')).join('\r\n');
  return Buffer.from(`﻿${body}\r\n`, 'utf8'); // มี BOM: Excel เปิดภาษาไทยถูก
}

/** แบบฟอร์มตัวอย่างของข้อมูลการเรียน */
export const ACADEMIC_TEMPLATES = {
  plan: {
    name: 'แผนการเรียน',
    headers: ['สาขาวิชา', 'ระดับ', 'ชั้นปี', 'ภาคเรียน', 'รหัสวิชา', 'ชื่อวิชา', 'ท-ป-น', 'หมวดวิชา'],
    sample: [
      ['เทคโนโลยีสารสนเทศ', 'ปวช.', '1', '1', '20204-2001', 'คอมพิวเตอร์และการบำรุงรักษา', '1-3-2', 'หมวดสมรรถนะวิชาชีพ'],
      ['เทคโนโลยีสารสนเทศ', 'ปวช.', '1', '1', '20000-1101', 'ภาษาไทยพื้นฐาน', '1-0-1', 'หมวดสมรรถนะแกนกลาง'],
    ],
  },
  schedule: {
    name: 'ตารางเรียน',
    headers: ['สาขาวิชา', 'ระดับ', 'ชั้นปี', 'ห้อง', 'วัน', 'เวลา', 'รหัสวิชา', 'ชื่อวิชา', 'ห้องเรียน', 'ครูผู้สอน'],
    sample: [
      ['เทคโนโลยีสารสนเทศ', 'ปวช.', '2', '1', 'จันทร์', '08.00-10.00', '20204-2102', 'การพัฒนาโปรแกรมบนอุปกรณ์เคลื่อนที่', 'IT-201', 'นายวิชัย ช่างคิด'],
      ['เทคโนโลยีสารสนเทศ', 'ปวช.', '2', '1', 'อังคาร', '13.00-16.00', '20204-2103', 'การจัดการเครือข่าย', 'IT-202', 'นางสุดา ตั้งใจสอน'],
    ],
  },
  grade: {
    name: 'ผลการเรียน',
    headers: ['รหัสนักศึกษา', 'ชื่อ-สกุล', 'รหัสวิชา', 'ชื่อวิชา', 'หน่วยกิต', 'เกรด'],
    sample: [
      ['67201010001', 'นายทดลอง ระบบดี', '20204-2102', 'การพัฒนาโปรแกรมบนอุปกรณ์เคลื่อนที่', '3', '3.5'],
      ['67201010001', 'นายทดลอง ระบบดี', '20204-2103', 'การจัดการเครือข่าย', '3', '4'],
    ],
  },
  staff: {
    name: 'ครูและบุคลากร',
    headers: ['รหัสบุคลากร', 'คำนำหน้า', 'ชื่อ', 'นามสกุล', 'ตำแหน่ง', 'ประเภทบุคลากร', 'แผนกวิชา', 'สาขาวิชา', 'สถานะ', 'เบอร์โทรศัพท์', 'อีเมล'],
    sample: [
      ['T001', 'นาย', 'วิชัย', 'ช่างคิด', 'ครู คศ.2', 'ข้าราชการครู', 'ประเภทวิชาอุตสาหกรรมดิจิทัลและเทคโนโลยีสารสนเทศ', 'เทคโนโลยีสารสนเทศ', 'ปฏิบัติงาน', '0812345678', ''],
      ['T002', 'นางสาว', 'สุดา', 'ตั้งใจ', 'เจ้าหน้าที่งานทะเบียน', 'ลูกจ้างชั่วคราว', '', '', 'ปฏิบัติงาน', '', ''],
    ],
  },
} as const;
