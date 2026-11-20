/** เรียก API ผ่าน /api ของเว็บเดียวกัน (คุกกี้เซสชัน HttpOnly ไปเอง) */

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly fields: Record<string, string> = {}, readonly code?: string) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), 'x-csis': '1' },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่', 0);
  }
  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const payload = (json ?? {}) as { message?: unknown; fields?: Record<string, string>; code?: string };
    const message = typeof payload.message === 'string' ? payload.message : res.status >= 500 ? 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' : 'ทำรายการไม่สำเร็จ';
    if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login')) {
      window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    }
    if (payload.code === 'MUST_CHANGE_PASSWORD' && typeof window !== 'undefined') window.location.assign('/change-password');
    throw new ApiError(message, res.status, payload.fields ?? {}, payload.code);
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function uploadFile<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('file', file);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: 'POST', body, credentials: 'same-origin', headers: { 'x-csis': '1' } });
  } catch {
    throw new ApiError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 0);
  }
  const json = safeJson(await res.text()) as { message?: string; fields?: Record<string, string> } | null;
  if (!res.ok) throw new ApiError(typeof json?.message === 'string' ? json.message : res.status === 413 ? 'ไฟล์ใหญ่เกิน 5 MB' : 'อัปโหลดไม่สำเร็จ', res.status, json?.fields ?? {});
  return json as T;
}

export const api = {
  get: <T,>(path: string) => request<T>('GET', path),
  post: <T,>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T,>(path: string, body?: unknown) => request<T>('PUT', path, body ?? {}),
  patch: <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body ?? {}),
  del: <T,>(path: string) => request<T>('DELETE', path),
};

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
