'use client';

import { ROLES, formatThaiDateTime, passwordProblem, randomPassword, type Role } from '@csis/shared';
import { Eye, EyeOff, KeyRound, Lock, Plus, RefreshCw, Search, UserCog } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { PageHeader } from '@/components/academic';
import { Dialog } from '@/components/Dialog';
import { Alert, Button, Card, Field, Input, Spinner, cx } from '@/components/ui';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useMe } from '@/lib/me';
import { useApi } from '@/lib/useApi';
import { ROLE_LABEL } from '../labels';

interface UserRow {
  id: string; username: string; displayName: string; status: 'ACTIVE' | 'SUSPENDED'; roles: Role[]; positions: string[]; headOf: string[];
  mustChangePassword: boolean; lockedUntil: string | null; lastLoginAt: string | null;
}
interface List { items: UserRow[]; total: number; pageSize: number }
const STAFF_ROLES = ROLES.filter((r) => r !== 'STUDENT');

/** บัญชี/รหัสที่เพิ่งตั้ง — ค้างไว้จนกดรับทราบ เพราะระบบเก็บแค่ค่าเข้ารหัส ดูย้อนหลังไม่ได้ */
interface Issued { displayName: string; username: string; password: string }
function IssuedBanner({ issued, onDismiss }: { issued: Issued; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = `ชื่อผู้ใช้: ${issued.username}\nรหัสผ่าน: ${issued.password}`;
  return (
    <div role="status" className="grid gap-3 rounded-[var(--radius-card)] bg-ok-soft p-4 ring-1 ring-ok/25 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="font-semibold text-ok">ตั้งรหัสผ่านของ {issued.displayName} แล้ว</p>
        <p className="mt-1 text-[15px]">ชื่อผู้ใช้ <strong className="tabular-nums">{issued.username}</strong> · รหัสผ่าน <strong className="font-semibold tracking-wide tabular-nums select-all">{issued.password}</strong></p>
        <p className="mt-1 text-sm text-ink-muted">ส่งให้เจ้าของบัญชีโดยตรง ปิดข้อความนี้แล้วดูย้อนหลังไม่ได้ · เจ้าของบัญชีเปลี่ยนรหัสเองได้ที่เมนู “เปลี่ยนรหัสผ่าน”</p>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}>{copied ? 'คัดลอกแล้ว' : 'คัดลอก'}</Button>
        <Button variant="ghost" onClick={onDismiss}>จดแล้ว</Button>
      </div>
    </div>
  );
}

/** ช่องรหัสผ่าน: เติมรหัสสุ่มไว้ให้ แก้เองได้ กดแสดง/สุ่มใหม่ได้ */
function PasswordField({ value, onChange, error, label = 'รหัสผ่าน' }: { value: string; onChange: (v: string) => void; error?: string; label?: string }) {
  const [show, setShow] = useState(true);
  const problem = value ? passwordProblem(value) : null;
  return (
    <Field label={label} hint={problem ?? 'อย่างน้อย 8 ตัว มีตัวอักษรภาษาอังกฤษและตัวเลข · แก้เป็นรหัสที่ต้องการได้'} error={error}>
      {({ id, describedBy, invalid }) => (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input id={id} aria-describedby={describedBy} aria-invalid={invalid || !!problem} type={show ? 'text' : 'password'} value={value} maxLength={64}
              autoComplete="new-password" spellCheck={false} onChange={(e) => onChange(e.target.value.replace(/\s/g, ''))} className="pr-12 font-medium tracking-wide tabular-nums" />
            <button type="button" onClick={() => setShow((v) => !v)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-muted hover:text-ink" aria-label={show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
              {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
            </button>
          </div>
          <Button type="button" variant="secondary" onClick={() => onChange(randomPassword())} icon={<RefreshCw className="size-4" aria-hidden="true" />}>สุ่มใหม่</Button>
        </div>
      )}
    </Field>
  );
}

function ForceChange({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      ให้เจ้าของบัญชีเปลี่ยนรหัสผ่านตอนเข้าสู่ระบบครั้งแรก
    </label>
  );
}

export default function UsersPage() {
  const { me } = useMe();
  const isSuper = !!me?.roles.includes('SUPER_ADMIN');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  // บัญชีที่ระงับซ่อนไว้ก่อน ไม่ให้รก — ติ๊กดูได้เมื่ออยากเปิดใช้กลับ
  const [showSuspended, setShowSuspended] = useState(false);
  const [page, setPage] = useState(0);
  // ปกติแสดงเฉพาะครู/เจ้าหน้าที่ — ค้นด้วยรหัสนักศึกษา/ชื่อได้ เพื่อปลดล็อกบัญชีนักเรียนที่กรอกรหัสผิด
  const params = new URLSearchParams({ page: String(page), ...(query ? {} : { staff: '1' }), status: showSuspended ? 'SUSPENDED' : 'ACTIVE', ...(query ? { q: query } : {}), ...(role ? { role } : {}) });
  const { data, error, reload } = useApi<List>(`/admin/users?${params}`);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [issued, setIssued] = useState<Issued | null>(null);
  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;
  const grantable = STAFF_ROLES.filter((r) => isSuper || (r !== 'SUPER_ADMIN' && r !== 'ADMIN'));

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <PageHeader title="ผู้ใช้งาน" subtitle="ครูและเจ้าหน้าที่ · ค้นรหัสนักศึกษาเพื่อปลดล็อก/ตั้งรหัสผ่านบัญชีนักเรียน" actions={<Button onClick={() => setCreating(true)} icon={<Plus className="size-4" aria-hidden="true" />}>เพิ่มผู้ใช้</Button>} />
      {issued && <IssuedBanner issued={issued} onDismiss={() => setIssued(null)} />}
      <Card>
        <form className="flex flex-wrap gap-2 border-b border-line/80 p-3" role="search" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(0); }}>
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อผู้ใช้ ชื่อ หรือรหัสนักศึกษา" aria-label="ค้นหาผู้ใช้" className="min-h-11 pl-9" />
          </div>
          <select value={role} onChange={(e) => { setRole(e.target.value as Role | ''); setPage(0); }} aria-label="กรองบทบาท" className="min-h-11 rounded-[var(--radius-control)] bg-surface px-3 ring-1 ring-line-strong">
            <option value="">ทุกบทบาท</option>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <Button type="submit" variant="secondary">ค้นหา</Button>
          <label className="flex min-h-11 items-center gap-2 px-1 text-sm text-ink-muted">
            <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={showSuspended} onChange={(e) => { setShowSuspended(e.target.checked); setPage(0); }} />
            ดูบัญชีที่ระงับ
          </label>
        </form>
        {data && data.items.length === 0 && (
          <p className="px-4 py-8 text-center text-ink-muted">{showSuspended ? 'ไม่มีบัญชีที่ระงับ' : 'ไม่พบผู้ใช้'}</p>
        )}
        {error ? <div className="p-4"><Alert>{error}</Alert></div> : !data ? <Spinner /> : (
          <ul className="divide-y divide-line/70">
            {data.items.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => setEditing(u)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-sunken/60">
                  <span className={cx('grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold', u.status === 'ACTIVE' ? 'bg-brand-soft text-brand' : 'bg-sunken text-ink-muted')}>{u.displayName.replace(/^(นาย|นางสาว|นาง)/, '').slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2">
                      <span className={cx('font-medium', u.status === 'SUSPENDED' && 'text-ink-muted line-through')}>{u.displayName}</span>
                      <span className="text-sm tabular-nums text-ink-muted">{u.username}</span>
                      {u.status === 'SUSPENDED' && <span className="rounded bg-danger-soft px-1.5 text-xs text-danger">ระงับ</span>}
                      {u.lockedUntil && new Date(u.lockedUntil) > new Date() && <span className="inline-flex items-center gap-0.5 rounded bg-warn-soft px-1.5 text-xs text-warn"><Lock className="size-3" aria-hidden="true" />ล็อกชั่วคราว</span>}
                    </span>
                    <span className="block truncate text-sm text-ink-muted">
                      {u.roles.map((r) => ROLE_LABEL[r]).join(', ')}{u.headOf.length ? ` · หัวหน้าสาขา${u.headOf.join(', ')}` : ''}{u.positions.length ? ` · ผู้ลงนาม ${u.positions.length} ตำแหน่ง` : ''}
                    </span>
                  </span>
                  <span className="hidden text-right text-sm text-ink-muted sm:block">{u.lastLoginAt ? <>เข้าล่าสุด<br />{formatThaiDateTime(u.lastLoginAt)}</> : 'ยังไม่เคยเข้า'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line/80 px-4 py-2.5 text-sm">
            <span className="tabular-nums text-ink-muted">หน้า {page + 1}/{pages} · {data?.total} บัญชี</span>
            <div className="flex gap-2"><Button variant="secondary" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>ก่อนหน้า</Button><Button variant="secondary" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>ถัดไป</Button></div>
          </div>
        )}
      </Card>

      <Dialog open={creating} onClose={() => setCreating(false)} title="เพิ่มผู้ใช้ (ครู/เจ้าหน้าที่/ผู้ดูแลระบบ)">
        {creating && <CreateForm roles={grantable} onDone={(i) => { setIssued(i); setCreating(false); void reload(); }} />}
      </Dialog>
      <Dialog open={!!editing} onClose={() => setEditing(null)} title={editing ? `${editing.displayName} (${editing.username})` : ''}>
        {editing && (
          <EditUser user={editing} roles={grantable} self={editing.id === me?.id} canEditPrivileged={isSuper}
            onIssued={(i) => { setIssued(i); setEditing(null); void reload(); }} onSaved={() => { setEditing(null); void reload(); }} />
        )}
      </Dialog>
    </div>
  );
}

function RoleChecks({ roles, value, onChange, disabled }: { roles: readonly Role[]; value: Role[]; onChange: (r: Role[]) => void; disabled?: (r: Role) => boolean }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 text-[15px] font-medium">บทบาท</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {roles.map((r) => (
          <label key={r} className={cx('flex min-h-11 items-center gap-2.5 rounded-[var(--radius-control)] px-3 ring-1', value.includes(r) ? 'bg-brand-soft ring-brand-border' : 'ring-line-strong', disabled?.(r) && 'opacity-50')}>
            <input type="checkbox" className="size-4 accent-[var(--color-brand)]" checked={value.includes(r)} disabled={disabled?.(r)} onChange={() => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])} />
            {ROLE_LABEL[r]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function CreateForm({ roles, onDone }: { roles: readonly Role[]; onDone: (issued: Issued) => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [picked, setPicked] = useState<Role[]>(['TEACHER']);
  const [password, setPassword] = useState(() => randomPassword());
  const [forceChange, setForceChange] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const problem = passwordProblem(password);
      if (problem) { setErrors({ password: problem }); return; }
      await api.post('/admin/users', { username, displayName, roles: picked, password, mustChangePassword: forceChange });
      onDone({ displayName, username, password });
    } catch (err) {
      setErrors(err instanceof ApiError && Object.keys(err.fields).length ? err.fields : { _: errorMessage(err) });
    } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <Field label="ชื่อ-นามสกุล (ใช้พิมพ์ในแบบฟอร์ม)" error={errors.displayName}>{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="นายสมชาย ใจดี" />}</Field>
      <Field label="ชื่อผู้ใช้ (ภาษาอังกฤษ)" hint="a-z 0-9 . _ - เช่น somchai.j" error={errors.username}>{({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoCapitalize="none" spellCheck={false} />}</Field>
      <PasswordField value={password} onChange={setPassword} error={errors.password} />
      <ForceChange checked={forceChange} onChange={setForceChange} />
      <RoleChecks roles={roles} value={picked} onChange={setPicked} />
      {errors.roles && <p className="text-sm text-danger">{errors.roles}</p>}
      {errors._ && <Alert>{errors._}</Alert>}
      <Button type="submit" loading={busy} icon={<Plus className="size-4" aria-hidden="true" />}>สร้างบัญชี</Button>
    </form>
  );
}

function EditUser({ user, roles, self, canEditPrivileged, onIssued, onSaved }: {
  user: UserRow; roles: readonly Role[]; self: boolean; canEditPrivileged: boolean;
  onIssued: (i: Issued) => void; onSaved: () => void;
}) {
  const [resetting, setResetting] = useState(false);
  const [newPassword, setNewPassword] = useState(() => randomPassword());
  const [toBirth, setToBirth] = useState(true);
  const [forceChange, setForceChange] = useState(false);
  const isStudent = user.roles.includes('STUDENT');
  const privileged = user.roles.some((r) => r === 'SUPER_ADMIN' || r === 'ADMIN');
  const locked = privileged && !canEditPrivileged;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [picked, setPicked] = useState<Role[]>(user.roles);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError('');
    try { await fn(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(null); }
  };
  const save = () => run('save', async () => { await api.patch('/admin/users/' + user.id, { displayName, ...(isStudent ? {} : { roles: picked }) }); onSaved(); });
  const toggle = () => run('status', async () => {
    if (user.status === 'ACTIVE' && !window.confirm(`ระงับบัญชี ${user.displayName}? เจ้าของบัญชีจะออกจากระบบทันที`)) return;
    await api.patch('/admin/users/' + user.id, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' });
    onSaved();
  });
  const useBirth = isStudent && toBirth;
  const reset = () => run('reset', async () => {
    if (!useBirth) { const p = passwordProblem(newPassword); if (p) throw new Error(p); }
    const r = await api.post<{ isBirthDate: boolean; password: string | null }>(`/admin/users/${user.id}/reset-password`, { password: useBirth ? '' : newPassword, mustChangePassword: forceChange });
    onIssued({ displayName: user.displayName, username: user.username, password: r.isBirthDate ? `${r.password} (วันเกิด)` : newPassword });
  });
  const unlock = () => run('unlock', async () => { await api.post(`/admin/users/${user.id}/unlock`); onSaved(); });
  return (
    <div className="grid gap-4">
      {locked && <Alert tone="info">บัญชีผู้ดูแลระบบ แก้ไขได้เฉพาะ SUPER_ADMIN</Alert>}
      <Field label="ชื่อ-นามสกุล">{({ id }) => <Input id={id} value={displayName} disabled={locked} onChange={(e) => setDisplayName(e.target.value)} />}</Field>
      {isStudent ? <p className="text-sm text-ink-muted">บัญชีนักเรียน — แก้ข้อมูลทะเบียนที่เมนู “นักเรียน”</p> : (
        <RoleChecks roles={roles} value={picked} onChange={setPicked} disabled={(r) => locked || (self && r === 'SUPER_ADMIN')} />
      )}
      {error && <Alert>{error}</Alert>}
      <Button onClick={() => void save()} loading={busy === 'save'} disabled={locked} icon={<UserCog className="size-4" aria-hidden="true" />}>บันทึก</Button>
      {resetting && (
        <div className="grid gap-3 rounded-[var(--radius-control)] bg-sunken/70 p-3">
          <p className="font-medium">ตั้งรหัสผ่านใหม่</p>
          {isStudent && (
            <div className="flex flex-wrap gap-2">
              {([[true, 'กลับเป็นวันเกิด'], [false, 'กำหนดรหัสเอง']] as const).map(([v, label]) => (
                <label key={label} className={cx('flex min-h-10 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] px-3 ring-1', toBirth === v ? 'bg-brand-soft ring-brand-border' : 'bg-surface ring-line-strong')}>
                  <input type="radio" name="reset-kind" className="accent-[var(--color-brand)]" checked={toBirth === v} onChange={() => setToBirth(v)} />{label}
                </label>
              ))}
            </div>
          )}
          {!useBirth && <PasswordField label="รหัสผ่านใหม่" value={newPassword} onChange={setNewPassword} />}
          <ForceChange checked={forceChange} onChange={setForceChange} />
          <p className="text-sm text-ink-muted">รหัสเดิมใช้ไม่ได้ทันที และทุกเครื่องที่เข้าสู่ระบบด้วยบัญชีนี้จะถูกออกจากระบบ</p>
          <Button onClick={() => void reset()} loading={busy === 'reset'} icon={<KeyRound className="size-4" aria-hidden="true" />}>ยืนยันตั้งรหัสผ่านใหม่</Button>
        </div>
      )}
      <div className="grid gap-2 border-t border-line/80 pt-4 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => setResetting((v) => !v)} aria-expanded={resetting} disabled={locked} icon={<KeyRound className="size-4" aria-hidden="true" />}>{resetting ? 'ยกเลิกการตั้งรหัส' : 'ตั้งรหัสผ่านใหม่'}</Button>
        {user.lockedUntil && new Date(user.lockedUntil) > new Date()
          ? <Button variant="secondary" onClick={() => void unlock()} loading={busy === 'unlock'} icon={<Lock className="size-4" aria-hidden="true" />}>ปลดล็อก</Button>
          : <Button variant={user.status === 'ACTIVE' ? 'danger' : 'secondary'} onClick={() => void toggle()} loading={busy === 'status'} disabled={locked || self}>{user.status === 'ACTIVE' ? 'ระงับบัญชี' : 'เปิดใช้บัญชี'}</Button>}
      </div>
    </div>
  );
}
