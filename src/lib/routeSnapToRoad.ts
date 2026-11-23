import type { LessonGpsPoint } from '../types';
import { calculateHaversineDistanceKm, sanitizeGpsTrack } from './lessonCheckinService';

export interface SnapToRoadResult {
  points: LessonGpsPoint[];
  snapped: boolean;
  provider: 'OSRM_MATCH' | 'OSRM_ROUTE' | 'RAW_CLEANED';
  rawCount: number;
  snappedCount: number;
  avgAccuracyMeters: number | null;
}

const CACHE_KEY = 'agd_snapped_route_cache_v1';
const MAX_CACHE_ENTRIES = 20;
const OSRM_BASE = 'https://router.project-osrm.org';
const memoryCache = new Map<string, SnapToRoadResult>();

function computeAvgAccuracy(points: LessonGpsPoint[]): number | null {
  const vals = points
    .map((p) => p.accuracy)
    .filter((a): a is number => typeof a === 'number' && Number.isFinite(a) && a > 0);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((sum, v) => sum + v, 0) / vals.length);
}

function buildRouteFingerprint(points: LessonGpsPoint[]): string {
  if (points.length === 0) return 'empty';
  const first = points[0];
  const mid = points[Math.floor(points.length / 2)];
  const last = points[points.length - 1];
  return [
    points.length,
    first.lat.toFixed(5),
    first.lng.toFixed(5),
    mid.lat.toFixed(5),
    mid.lng.toFixed(5),
    last.lat.toFixed(5),
    last.lng.toFixed(5)
  ].join('|');
}

function readPersistentCache(fingerprint: string): SnapToRoadResult | null {
  const mem = memoryCache.get(fingerprint);
  if (mem) return mem;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, SnapToRoadResult>;
    if (parsed && parsed[fingerprint]) {
      memoryCache.set(fingerprint, parsed[fingerprint]);
      return parsed[fingerprint];
    }
  } catch {
    // ignore cache errors
  }
  return null;
}

function writePersistentCache(fingerprint: string, result: SnapToRoadResult): void {
  memoryCache.set(fingerprint, result);
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    const parsed: Record<string, SnapToRoadResult> = raw ? JSON.parse(raw) : {};
    parsed[fingerprint] = result;
    const keys = Object.keys(parsed);
    if (keys.length > MAX_CACHE_ENTRIES) {
      const toRemove = keys.slice(0, keys.length - MAX_CACHE_ENTRIES);
      for (const k of toRemove) delete parsed[k];
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore quota errors
  }
}

/**
 * Reduz pontos redundantes preservando curvas e pontos-chave (mínimo de distância em metros).
 */
export function sampleWaypointsForRouting(
  points: LessonGpsPoint[],
  minStepMeters = 14,
  maxPoints = 75
): LessonGpsPoint[] {
  if (points.length <= 2) return points;
  const sampled: LessonGpsPoint[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = sampled[sampled.length - 1];
    const curr = points[i];
    const distM = calculateHaversineDistanceKm(prev, curr) * 1000;
    if (distM >= minStepMeters) {
      sampled.push(curr);
    }
  }
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }

  if (sampled.length <= maxPoints) return sampled;

  // Subamostragem uniforme preservando início e fim
  const result: LessonGpsPoint[] = [sampled[0]];
  const step = (sampled.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    result.push(sampled[Math.round(i * step)]);
  }
  result.push(sampled[sampled.length - 1]);
  return result;
}

function hasLargeGaps(points: LessonGpsPoint[], gapThresholdMeters = 110): boolean {
  for (let i = 1; i < points.length; i++) {
    if (calculateHaversineDistanceKm(points[i - 1], points[i]) * 1000 > gapThresholdMeters) {
      return true;
    }
  }
  return false;
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000, signal?: AbortSignal): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onParentAbort = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timer);
      throw new Error('aborted');
    }
    signal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onParentAbort);
  }
}

async function callOsrmMatchChunk(
  chunk: LessonGpsPoint[],
  signal?: AbortSignal
): Promise<Array<[number, number]> | null> {
  if (chunk.length < 2) return null;
  const coords = chunk.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const radiuses = chunk
    .map((p) => {
      const acc = typeof p.accuracy === 'number' && Number.isFinite(p.accuracy) ? p.accuracy : 25;
      return String(Math.max(15, Math.min(45, Math.round(acc))));
    })
    .join(';');

  const url = `${OSRM_BASE}/match/v1/driving/${coords}?overview=full&geometries=geojson&gaps=ignore&tidy=true&radiuses=${radiuses}`;
  const data = await fetchJsonWithTimeout(url, 8000, signal);
  if (data?.code !== 'Ok' || !Array.isArray(data.matchings) || data.matchings.length === 0) {
    return null;
  }
  const merged: Array<[number, number]> = [];
  for (const m of data.matchings) {
    const geom = m?.geometry?.coordinates;
    if (Array.isArray(geom)) {
      for (const c of geom) {
        if (Array.isArray(c) && c.length >= 2) {
          merged.push([c[0], c[1]]);
        }
      }
    }
  }
  return merged.length >= 2 ? merged : null;
}

async function callOsrmRouteChunk(
  chunk: LessonGpsPoint[],
  signal?: AbortSignal
): Promise<Array<[number, number]> | null> {
  if (chunk.length < 2) return null;
  const coords = chunk.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const url = `${OSRM_BASE}/route/v1/driving/${coords}?overview=full&geometries=geojson&continue_straight=false`;
  const data = await fetchJsonWithTimeout(url, 8000, signal);
  if (data?.code !== 'Ok' || !Array.isArray(data.routes) || !data.routes[0]?.geometry?.coordinates) {
    return null;
  }
  const geom = data.routes[0].geometry.coordinates as Array<[number, number]>;
  return geom.length >= 2 ? geom : null;
}

function geoJsonToGpsPoints(coords: Array<[number, number]>, sourcePoints: LessonGpsPoint[]): LessonGpsPoint[] {
  const startTime = sourcePoints[0]?.timestamp || new Date().toISOString();
  const endTime = sourcePoints[sourcePoints.length - 1]?.timestamp || startTime;
  const tStart = new Date(startTime).getTime();
  const tEnd = new Date(endTime).getTime();
  const totalMs = Number.isFinite(tStart) && Number.isFinite(tEnd) && tEnd > tStart ? tEnd - tStart : 0;

  return coords.map(([lng, lat], idx) => {
    const ratio = coords.length > 1 ? idx / (coords.length - 1) : 0;
    const ts =
      totalMs > 0
        ? new Date(tStart + Math.round(totalMs * ratio)).toISOString()
        : startTime;
    return {
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      timestamp: ts,
      accuracy: 5
    };
  });
}

/**
 * Ajusta um percurso GPS às vias reais (OpenStreetMap via OSRM) para eliminar linhas cortando quarteirões/casas.
 * - Usa OSRM Route quando há lacunas longas (> 110m, ex.: bloqueio de tela);
 * - Usa OSRM Match (HMM Map Matching) para trajetos contínuos, com fallback automático para OSRM Route;
 * - Mantém cache local e fallback seguro para GPS filtrado caso offline.
 */
export async function snapRouteToRoads(
  rawPoints: LessonGpsPoint[],
  options?: { signal?: AbortSignal; skipCache?: boolean }
): Promise<SnapToRoadResult> {
  const avgAccuracyMeters = computeAvgAccuracy(rawPoints || []);
  const cleaned = sanitizeGpsTrack(rawPoints || []);

  if (cleaned.length < 2) {
    return {
      points: cleaned,
      snapped: false,
      provider: 'RAW_CLEANED',
      rawCount: rawPoints?.length || 0,
      snappedCount: cleaned.length,
      avgAccuracyMeters
    };
  }

  // Se o veículo quase não saiu do lugar (< 25m de deslocamento total), não precisa rotear
  let totalDispM = 0;
  for (let i = 1; i < cleaned.length; i++) {
    totalDispM += calculateHaversineDistanceKm(cleaned[i - 1], cleaned[i]) * 1000;
  }
  if (totalDispM < 25) {
    return {
      points: cleaned,
      snapped: false,
      provider: 'RAW_CLEANED',
      rawCount: rawPoints.length,
      snappedCount: cleaned.length,
      avgAccuracyMeters
    };
  }

  const fingerprint = buildRouteFingerprint(cleaned);
  if (!options?.skipCache) {
    const cached = readPersistentCache(fingerprint);
    if (cached) return cached;
  }

  const waypoints = sampleWaypointsForRouting(cleaned, 14, 70);
  if (waypoints.length < 2) {
    return {
      points: cleaned,
      snapped: false,
      provider: 'RAW_CLEANED',
      rawCount: rawPoints.length,
      snappedCount: cleaned.length,
      avgAccuracyMeters
    };
  }

  const sparse = hasLargeGaps(waypoints, 110);
  const chunkSize = 35;
  const allCoords: Array<[number, number]> = [];
  let usedProvider: 'OSRM_MATCH' | 'OSRM_ROUTE' = sparse ? 'OSRM_ROUTE' : 'OSRM_MATCH';

  try {
    for (let i = 0; i < waypoints.length; i += chunkSize - 1) {
      const chunk = waypoints.slice(i, i + chunkSize);
      if (chunk.length < 2) break;

      let chunkCoords: Array<[number, number]> | null = null;
      if (sparse) {
        chunkCoords = await callOsrmRouteChunk(chunk, options?.signal);
        usedProvider = 'OSRM_ROUTE';
      } else {
        chunkCoords = await callOsrmMatchChunk(chunk, options?.signal);
        if (!chunkCoords) {
          chunkCoords = await callOsrmRouteChunk(chunk, options?.signal);
          usedProvider = 'OSRM_ROUTE';
        }
      }

      if (!chunkCoords) {
        throw new Error('OSRM não retornou geometria válida');
      }

      if (allCoords.length > 0) {
        // Evita duplicar o ponto de junção entre chunks
        allCoords.push(...chunkCoords.slice(1));
      } else {
        allCoords.push(...chunkCoords);
      }
    }

    if (allCoords.length >= 2) {
      const snappedPoints = geoJsonToGpsPoints(allCoords, cleaned);
      const result: SnapToRoadResult = {
        points: snappedPoints,
        snapped: true,
        provider: usedProvider,
        rawCount: rawPoints.length,
        snappedCount: snappedPoints.length,
        avgAccuracyMeters
      };
      writePersistentCache(fingerprint, result);
      return result;
    }
  } catch {
    // Offline ou OSRM temporariamente indisponível: retorna percurso limpo sem travar UI
  }

  return {
    points: cleaned,
    snapped: false,
    provider: 'RAW_CLEANED',
    rawCount: rawPoints.length,
    snappedCount: cleaned.length,
    avgAccuracyMeters
  };
}
