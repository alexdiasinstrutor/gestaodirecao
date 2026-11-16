import type { AuditLog, User } from '../types';

export interface DataCheckpoint {
  id: string; timestamp: string; key: string; userId: string; orgId: string; userName?: string;
  before: unknown; after: unknown; cloudSynced?: boolean;
}
export interface DataUpdateStatus { timestamp?: string; backup: 'idle' | 'saving' | 'saved' | 'error'; error?: string }
const STATUS_KEY = 'agd_data_update_status';
const TRACKED = new Set(['agd_discount_coupons', 'agd_coupon_redemptions', 'agd_credited_lessons', 'agd_organizations', 'agd_users', 'agd_students', 'agd_vehicles', 'agd_lessons', 'agd_slots', 'agd_accounts', 'agd_payments', 'agd_expenses', 'agd_investments', 'agd_packages', 'agd_student_notifications', 'agd_instructor_coverage', 'agd_student_leads', 'agd_saas_custom_plans_v1']);
let cloudWriter: ((log: AuditLog) => Promise<void>) | undefined;
let work: Promise<void> = Promise.resolve();
let localWork: Promise<void> = Promise.resolve();
export function setHistoryCloudWriter(writer: (log: AuditLog) => Promise<void>) { cloudWriter = writer; }
function connection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('agd-data-history', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('checkpoints', { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function storeCheckpoint(point: DataCheckpoint) {
  const database = await connection();
  try { await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('checkpoints', 'readwrite');
    tx.objectStore('checkpoints').put(point);
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  }); } finally { database.close(); }
}
function statusKey(userId?: string) {
  const current = JSON.parse(localStorage.getItem('agd_current_user') || 'null');
  return STATUS_KEY + ':' + (userId || current?.id || 'anonymous');
}
export function getDataUpdateStatus(userId?: string): DataUpdateStatus {
  try { return JSON.parse(localStorage.getItem(statusKey(userId)) || 'null') || { backup: 'idle' }; }
  catch { return { backup: 'error', error: 'Não foi possível ler o histórico.' }; }
}
function status(value: DataUpdateStatus, userId?: string) {
  localStorage.setItem(statusKey(userId), JSON.stringify(value));
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('agd:history-updated'));
}
// This is called only for business writes, never for remote hydration or session renewal.
export function recordDataChange(key: string, previous: string | null, next: string) {
  if (!TRACKED.has(key) || previous === next) return;
  const user = JSON.parse(localStorage.getItem('agd_current_user') || 'null') as User | null;
  if (!user) return;
  const timestamp = new Date().toISOString();
  const before = JSON.parse(previous || 'null');
  const after = JSON.parse(next);
  // Version only changed records, preventing unrelated registrations from being exported.
  const diff = (left: any, right: any) => {
    if (!Array.isArray(left) || !Array.isArray(right)) return left;
    const identity = (row: any) => row && typeof row === 'object' && 'id' in row ? 'id:' + row.id : 'value:' + JSON.stringify(row);
    const versions = new Map(right.map((row: any) => [identity(row), JSON.stringify(row)]));
    return left.filter((row: any) => versions.get(identity(row)) !== JSON.stringify(row));
  };
  const point: DataCheckpoint = { id: crypto.randomUUID(), timestamp, key, userId: user.id, orgId: user.organizacaoId, userName: user.nome,
    before: diff(before, after), after: diff(after, before), cloudSynced: false };
  status({ timestamp, backup: 'saving' }, user.id);
  const localSave = localWork.catch(() => {}).then(() => storeCheckpoint(point));
  localWork = localSave;
  work = work.catch(() => {}).then(async () => {
    try {
      await localSave;
      // Keep the original revision locally even if the network fails. No false cloud confirmation.
      if (cloudWriter) await cloudWriter({ id: point.id, organizacaoId: point.orgId, usuarioId: point.userId, usuarioNome: point.userName || point.userId,
        acao: 'PONTO_RECUPERACAO', entidade: 'DataCheckpoint', entidadeId: point.key,
        detalhes: JSON.stringify(point), timestamp });
      point.cloudSynced = true; await storeCheckpoint(point);
      if (getDataUpdateStatus(user.id).timestamp === timestamp) status({ timestamp, backup: 'saved' }, user.id);
    } catch (error) {
      status({ timestamp: getDataUpdateStatus(user.id).timestamp, backup: 'error', error: String(error) }, user.id);
    }
  });
}
export async function getDataCheckpoints(user: User): Promise<DataCheckpoint[]> {
  await localWork;
  const database = await connection();
  try { return await new Promise((resolve, reject) => {
    const req = database.transaction('checkpoints').objectStore('checkpoints').getAll();
    req.onsuccess = () => resolve((req.result as DataCheckpoint[])
      .filter(p => user.papel === 'SUPER_ADMIN' || (p.orgId === user.organizacaoId && p.userId === user.id))
      .sort((a,b) => b.timestamp.localeCompare(a.timestamp)));
    req.onerror = () => reject(req.error);
  }); } finally { database.close(); }
}
export function waitForDataHistory() { return work; }

export async function retryDataBackups(user: User): Promise<void> {
  const points = await getDataCheckpoints(user);
  for (const point of points.filter(p => !p.cloudSynced)) {
    if (!cloudWriter) throw new Error('Banco indisponível.');
    await cloudWriter({ id: point.id, organizacaoId: point.orgId, usuarioId: point.userId, usuarioNome: user.nome,
      acao: 'PONTO_RECUPERACAO', entidade: 'DataCheckpoint', entidadeId: point.key,
      detalhes: JSON.stringify(point), timestamp: point.timestamp });
    point.cloudSynced = true; await storeCheckpoint(point);
  }
  if (points.length > 0) status({ timestamp: getDataUpdateStatus(user.id).timestamp, backup: 'saved' }, user.id);
}

export async function hydrateDataHistory(logs: AuditLog[], user: User): Promise<void> {
  let newest = getDataUpdateStatus().timestamp || '';
  for (const log of logs) {
    try {
      const point = JSON.parse(log.detalhes || '{}') as DataCheckpoint;
      if (!point.id || !point.timestamp || !TRACKED.has(point.key)) continue;
      if (user.papel !== 'SUPER_ADMIN' && (point.orgId !== user.organizacaoId || point.userId !== user.id)) continue;
      await storeCheckpoint({ ...point, cloudSynced: true });
      if (point.timestamp > newest) newest = point.timestamp;
    } catch { /* An invalid history record cannot interrupt data hydration. */ }
  }
  if (newest && newest > (getDataUpdateStatus().timestamp || '')) status({ timestamp: newest, backup: 'saved' }, user.id);
}
