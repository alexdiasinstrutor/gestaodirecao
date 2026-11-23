import type { Lesson, LessonCheckinRecord, LessonGpsPoint } from '../types';

export interface HardwareCheckResult {
  canRunLiveMap: boolean;
  reason?: string;
  specsSummary: string;
}

export interface RouteTelemetry {
  totalSeconds: number;
  movingSeconds: number;
  stoppedSeconds: number;
  distanceKm: number;
  currentSpeedKmh: number;
  averageSpeedKmh: number;
}

const DEFAULT_BASE_COORDS = {
  lat: -19.9678, // Betim / Grande BH (MG)
  lng: -44.1984
};

/**
 * Avalia a capacidade do hardware do dispositivo antes de inicializar o mapa ao vivo (Anti-Falha).
 */
export function evaluateHardwareForLiveMap(options?: {
  forceLowSpec?: boolean;
  navigatorOverride?: {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    connection?: { saveData?: boolean; effectiveType?: string };
  };
  hasCanvasOverride?: boolean;
}): HardwareCheckResult {
  const nav: any =
    options?.navigatorOverride ?? (typeof navigator !== 'undefined' ? navigator : {});
  const deviceMemory = typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : undefined;
  const cores =
    typeof nav?.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : undefined;
  const conn = nav?.connection || nav?.mozConnection || nav?.webkitConnection;
  const saveData = Boolean(conn?.saveData);
  const effectiveType = typeof conn?.effectiveType === 'string' ? conn.effectiveType : '';

  const parts: string[] = [];
  if (deviceMemory !== undefined) parts.push(`RAM aprox.: ${deviceMemory} GB`);
  if (cores !== undefined) parts.push(`CPU: ${cores} núcleo(s)`);
  if (effectiveType) parts.push(`Rede: ${effectiveType.toUpperCase()}`);
  const specsSummary = parts.length > 0 ? parts.join(' · ') : 'Dispositivo padrão';

  if (options?.forceLowSpec) {
    return {
      canRunLiveMap: false,
      reason:
        'Modo de hardware limitado ativado: o mapa ao vivo foi suspenso para preservar estabilidade e o trajeto será exibido ao término da aula.',
      specsSummary
    };
  }

  let hasCanvas = options?.hasCanvasOverride;
  if (hasCanvas === undefined) {
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        hasCanvas = Boolean(canvas && typeof canvas.getContext === 'function' && canvas.getContext('2d'));
      } catch {
        hasCanvas = false;
      }
    } else {
      hasCanvas = true;
    }
  }

  if (!hasCanvas) {
    return {
      canRunLiveMap: false,
      reason:
        'Renderização gráfica de mapa indisponível neste dispositivo. As coordenadas continuarão sendo gravadas normalmente e exibidas no mapa ao término.',
      specsSummary
    };
  }

  if (deviceMemory !== undefined && deviceMemory < 2) {
    return {
      canRunLiveMap: false,
      reason:
        `Memória RAM reduzida detectada (${deviceMemory} GB). O modo leve foi ativado para evitar travamento durante a aula prática.`,
      specsSummary
    };
  }

  if (cores !== undefined && cores < 2) {
    return {
      canRunLiveMap: false,
      reason:
        `Processamento limitado detectado (${cores} núcleo). O modo leve foi ativado e o mapa do trajeto será apresentado ao finalizar a aula.`,
      specsSummary
    };
  }

  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') {
    return {
      canRunLiveMap: false,
      reason:
        'Conexão de baixa velocidade ou modo de economia de dados detectado. As coordenadas serão gravadas e o percurso exibido no check-out.',
      specsSummary
    };
  }

  return {
    canRunLiveMap: true,
    specsSummary
  };
}

/**
 * Calcula a distância em quilômetros entre duas coordenadas geográficas (Fórmula de Haversine).
 */
export function calculateHaversineDistanceKm(
  p1: { lat: number; lng: number },
  p2: { lat: number; lng: number }
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Raio médio da Terra em km
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  return R * c;
}

/**
 * Consolida tempo total, tempo em deslocamento, tempo parado e distância total percorrida.
 */
export function computeRouteTelemetry(
  points: LessonGpsPoint[],
  elapsedClockSeconds = 0
): RouteTelemetry {
  if (!points || points.length === 0) {
    const safeTotal = Math.max(0, Math.round(elapsedClockSeconds));
    return {
      totalSeconds: safeTotal,
      movingSeconds: 0,
      stoppedSeconds: safeTotal,
      distanceKm: 0,
      currentSpeedKmh: 0,
      averageSpeedKmh: 0
    };
  }

  let distanceKm = 0;
  let movingSeconds = 0;
  let stoppedSeconds = 0;
  let lastSpeedKmh = points[points.length - 1]?.speedKmh ?? 0;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const segKm = calculateHaversineDistanceKm(prev, curr);
    const tPrev = new Date(prev.timestamp).getTime();
    const tCurr = new Date(curr.timestamp).getTime();
    const dtSec =
      Number.isFinite(tPrev) && Number.isFinite(tCurr) && tCurr > tPrev
        ? Math.round((tCurr - tPrev) / 1000)
        : 0;

    const inferredSpeedKmh = dtSec > 0 ? segKm / (dtSec / 3600) : 0;
    const reportedSpeed =
      curr.speedKmh !== undefined && Number.isFinite(curr.speedKmh) ? curr.speedKmh : 0;
    const effectiveSpeed =
      segKm >= 0.012
        ? Math.max(reportedSpeed, inferredSpeedKmh)
        : curr.speedKmh !== undefined && Number.isFinite(curr.speedKmh)
        ? curr.speedKmh
        : inferredSpeedKmh;

    // Considera em movimento se velocidade >= 2.5 km/h ou deslocamento real >= 8 metros
    const isMoving = effectiveSpeed >= 2.5 || segKm >= 0.008;
    if (isMoving) {
      distanceKm += segKm;
      movingSeconds += dtSec;
    } else {
      stoppedSeconds += dtSec;
    }
    lastSpeedKmh = Math.max(0, effectiveSpeed);
  }

  const telemetrySum = movingSeconds + stoppedSeconds;
  const totalSeconds = Math.max(Math.round(elapsedClockSeconds), telemetrySum);
  if (totalSeconds > telemetrySum) {
    stoppedSeconds += totalSeconds - telemetrySum;
  }

  const averageSpeedKmh = movingSeconds > 0 ? distanceKm / (movingSeconds / 3600) : 0;

  return {
    totalSeconds,
    movingSeconds,
    stoppedSeconds,
    distanceKm: Number(distanceKm.toFixed(3)),
    currentSpeedKmh: Math.round(lastSpeedKmh),
    averageSpeedKmh: Number(averageSpeedKmh.toFixed(1))
  };
}

export function formatDurationHMS(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

/**
 * Gera o link oficial de rota no Google Maps com origem, pontos intermediários e destino.
 */
export function buildGoogleMapsDirectionsUrl(points: LessonGpsPoint[]): string {
  if (!points || points.length === 0) {
    return 'https://www.google.com/maps';
  }
  if (points.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${points[0].lat},${points[0].lng}`;
  }

  const origin = `${points[0].lat},${points[0].lng}`;
  const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const middle = points.slice(1, -1);

  let waypointsParam = '';
  if (middle.length > 0) {
    const maxWaypoints = 8;
    const step = Math.max(1, Math.floor(middle.length / maxWaypoints));
    const sampled: string[] = [];
    for (let i = 0; i < middle.length && sampled.length < maxWaypoints; i += step) {
      sampled.push(`${middle[i].lat},${middle[i].lng}`);
    }
    if (sampled.length > 0) {
      waypointsParam = `&waypoints=${encodeURIComponent(sampled.join('|'))}`;
    }
  }

  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}${waypointsParam}&travelmode=driving`;
}

/**
 * URL de embed público do Google Maps compatível com iframe para exibição integrada.
 */
export function buildGoogleMapsEmbedUrl(points: LessonGpsPoint[]): string {
  if (!points || points.length === 0) {
    return `https://maps.google.com/maps?q=${DEFAULT_BASE_COORDS.lat},${DEFAULT_BASE_COORDS.lng}&z=15&hl=pt-BR&output=embed`;
  }
  const target = points[points.length - 1];
  return `https://maps.google.com/maps?q=${target.lat},${target.lng}&z=16&hl=pt-BR&output=embed`;
}

/**
 * Converte data (YYYY-MM-DD) e hora (HH:MM) da aula para timestamp local em milissegundos.
 */
export function parseLocalLessonTimestamp(dateStr: string, timeStr: string): number {
  if (!dateStr || !timeStr) return NaN;
  const dateParts = dateStr.split('-').map((v) => parseInt(v, 10));
  const timeParts = timeStr.split(':').map((v) => parseInt(v, 10));
  if (dateParts.length !== 3 || timeParts.length < 2) return NaN;
  const [year, month, day] = dateParts;
  const [hour, minute] = timeParts;
  if ([year, month, day, hour, minute].some((n) => !Number.isFinite(n))) return NaN;
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

/**
 * Filtra estritamente as aulas elegíveis para iniciar/continuar o Check-in:
 * - Nunca exibe aulas concluídas, canceladas ou que já possuam check-in finalizado;
 * - Nunca exibe aulas agendadas cujo horário de término já passou (apenas futuras/em andamento).
 */
export function filterEligibleCheckinLessons(
  lessons: Lesson[],
  checkins: LessonCheckinRecord[],
  nowMs: number = Date.now()
): Lesson[] {
  const completedCheckinLessonIds = new Set(
    (checkins || []).filter((c) => c.status === 'FINALIZADO').map((c) => c.aulaId)
  );

  return (lessons || []).filter((lesson) => {
    if (lesson.status === 'CONCLUIDA' || lesson.status === 'CANCELADA') return false;
    if (completedCheckinLessonIds.has(lesson.id)) return false;
    if (lesson.status === 'EM_ANDAMENTO') return true;
    if (lesson.status !== 'AGENDADA') return false;

    const endMs = parseLocalLessonTimestamp(lesson.data, lesson.horaFim || lesson.horaInicio || '23:59');
    return Number.isFinite(endMs) && endMs > nowMs;
  });
}

/**
 * Filtra leituras de GPS em tempo real para eliminar:
 * - Ruído grosseiro de torre celular / GPS fraco (> 45m de imprecisão após fix inicial);
 * - Saltos impossíveis ("teletransporte" > 135 km/h);
 * - Spam estacionário (< 5m e < 10s).
 */
export function shouldAcceptGpsPoint(
  existingPoints: LessonGpsPoint[],
  candidate: LessonGpsPoint
): boolean {
  if (!candidate || !Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) {
    return false;
  }
  if (!existingPoints || existingPoints.length === 0) {
    // Mesmo no primeiro ponto, rejeita localização de torre celular extremamente imprecisa (> 150m)
    if (candidate.accuracy !== undefined && Number.isFinite(candidate.accuracy) && candidate.accuracy > 150) {
      return false;
    }
    return true;
  }
  if (candidate.accuracy !== undefined && Number.isFinite(candidate.accuracy) && candidate.accuracy > 45) {
    return false;
  }

  const last = existingPoints[existingPoints.length - 1];
  const tLast = new Date(last.timestamp).getTime();
  const tCurr = new Date(candidate.timestamp).getTime();
  const dtSec = Number.isFinite(tLast) && Number.isFinite(tCurr) ? (tCurr - tLast) / 1000 : 10;

  if (dtSec < 1) {
    return false;
  }

  const distMeters = calculateHaversineDistanceKm(last, candidate) * 1000;

  // Filtro anti-teletransporte: rejeita saltos fisicamente impossíveis (> 135 km/h em deslocamento > 45m)
  if (dtSec > 0 && distMeters > 45) {
    const impliedSpeedKmh = (distMeters / 1000) / (dtSec / 3600);
    if (impliedSpeedKmh > 135) {
      return false;
    }
  }

  return distMeters >= 5 || dtSec >= 10;
}

/**
 * Remove picos anômalos (outliers) e ruído estacionário de uma lista de pontos GPS já capturados.
 */
export function sanitizeGpsTrack(points: LessonGpsPoint[]): LessonGpsPoint[] {
  if (!points || points.length <= 2) return points || [];

  // 1. Filtra leituras com precisão muito ruim (> 65m), preservando início/fim caso todos sejam ruins
  const accurate = points.filter((p, idx) => {
    if (idx === 0 || idx === points.length - 1) return true;
    if (p.accuracy === undefined || !Number.isFinite(p.accuracy)) return true;
    return p.accuracy <= 65;
  });
  const base = accurate.length >= 2 ? accurate : points;

  // 2. Remove spikes isolados (ponto que salta > 120m para longe de ambos os vizinhos enquanto os vizinhos estão próximos)
  const cleaned: LessonGpsPoint[] = [base[0]];
  for (let i = 1; i < base.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = base[i];
    const next = base[i + 1];

    const dPrev = calculateHaversineDistanceKm(prev, curr) * 1000;
    const tPrev = new Date(prev.timestamp).getTime();
    const tCurr = new Date(curr.timestamp).getTime();
    const dtSec = Number.isFinite(tPrev) && Number.isFinite(tCurr) && tCurr > tPrev ? (tCurr - tPrev) / 1000 : 0;

    // Se houve salto absurdo (> 140 km/h em < 15s) e o próximo ponto volta perto do anterior, descarta o spike
    if (next && dtSec > 0 && dtSec < 15 && dPrev > 80) {
      const dPrevNext = calculateHaversineDistanceKm(prev, next) * 1000;
      const impliedKmh = (dPrev / 1000) / (dtSec / 3600);
      if (impliedKmh > 140 && dPrevNext < dPrev * 0.65) {
        continue;
      }
    }

    // Estabiliza jitter estacionário (< 3.5m com velocidade baixa): mantém coordenada ancorada
    if (dPrev < 3.5 && (curr.speedKmh === undefined || curr.speedKmh < 2.5)) {
      cleaned.push({
        ...curr,
        lat: prev.lat,
        lng: prev.lng
      });
    } else {
      cleaned.push(curr);
    }
  }

  return cleaned;
}

/**
 * Gera um ponto GPS simulado para validação do Administrador Master sem precisar dirigir fisicamente.
 */
export function generateSimulatedGpsStep(
  existingPoints: LessonGpsPoint[],
  options?: {
    baseCoords?: { lat: number; lng: number };
    stopped?: boolean;
    stepSeconds?: number;
  }
): LessonGpsPoint {
  const stepSeconds = options?.stepSeconds ?? 5;
  const last =
    existingPoints.length > 0
      ? existingPoints[existingPoints.length - 1]
      : {
          lat: options?.baseCoords?.lat ?? DEFAULT_BASE_COORDS.lat,
          lng: options?.baseCoords?.lng ?? DEFAULT_BASE_COORDS.lng,
          timestamp: new Date().toISOString(),
          speedKmh: 0,
          accuracy: 8
        };

  const prevMs = new Date(last.timestamp).getTime();
  const nextTimestamp = new Date(
    existingPoints.length > 0 && Number.isFinite(prevMs) ? prevMs + stepSeconds * 1000 : Date.now()
  ).toISOString();

  if (options?.stopped) {
    return {
      lat: Number(last.lat.toFixed(6)),
      lng: Number(last.lng.toFixed(6)),
      timestamp: nextTimestamp,
      speedKmh: 0,
      accuracy: 6
    };
  }

  // Simula deslocamento urbano (~32 km/h em curva suave de quarteirão)
  const idx = existingPoints.length;
  const angle = (idx * 0.25) % (Math.PI * 2);
  const deltaLat = Math.cos(angle) * 0.00038 + 0.00018;
  const deltaLng = Math.sin(angle) * 0.00042 + 0.00022;
  const speedKmh = 28 + (idx % 5) * 4;

  return {
    lat: Number((last.lat + deltaLat).toFixed(6)),
    lng: Number((last.lng + deltaLng).toFixed(6)),
    timestamp: nextTimestamp,
    speedKmh,
    accuracy: 8
  };
}
