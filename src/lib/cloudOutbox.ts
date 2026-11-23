export interface PendingWrite { key: string; revision: string; table: string; operation: 'upsert' | 'delete'; row: Record<string, any> }
const KEY = 'agd_cloud_outbox_v1';
export function getPendingWrites(): PendingWrite[] {
  const raw = localStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}
export function queueCloudWrite(table: string, row: Record<string, any>, operation: 'upsert' | 'delete'): PendingWrite {
  const entry: PendingWrite = { key: table + ':' + row.id, revision: crypto.randomUUID(), table, row, operation };
  const current = getPendingWrites().filter(p => p.key !== entry.key);
  localStorage.setItem(KEY, JSON.stringify([...current, entry]));
  return entry;
}
export function acknowledgeCloudWrite(entry: PendingWrite) {
  localStorage.setItem(KEY, JSON.stringify(getPendingWrites().filter(p => p.key !== entry.key || p.revision !== entry.revision)));
}
export function clearPendingWrites(): number {
  const count = getPendingWrites().length;
  localStorage.removeItem(KEY);
  return count;
}
export function overlayPendingRows(table: string, rows: any[], filters?: Record<string, string>): any[] {
  const map = new Map(rows.map(row => [String(row.id), row]));
  for (const entry of getPendingWrites().filter(p => p.table === table)) {
    if (entry.operation === 'delete') map.delete(String(entry.row.id));
    else map.set(String(entry.row.id), entry.row);
  }
  return [...map.values()].filter(row => !filters || Object.entries(filters).every(([key, value]) => String(row[key]) === String(value)));
}
