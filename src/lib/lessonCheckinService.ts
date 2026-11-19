import type { LessonGpsPoint } from '../types';

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
    const effectiveSpeed =
      curr.speedKmh !== undefined && Number.isFinite(curr.speedKmh)
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
 * URL de embed público do Google Maps para exibição integrada da rota / localização.
 */
export function buildGoogleMapsEmbedUrl(points: LessonGpsPoint[]): string {
  if (!points || points.length === 0) {
    return `https://maps.google.com/maps?q=${DEFAULT_BASE_COORDS.lat},${DEFAULT_BASE_COORDS.lng}&z=14&output=embed`;
  }
  if (points.length === 1) {
    const p = points[0];
    return `https://maps.google.com/maps?q=${p.lat},${p.lng}&z=16&output=embed`;
  }
  const start = points[0];
  const end = points[points.length - 1];
  return `https://maps.google.com/maps?saddr=${start.lat},${start.lng}&daddr=${end.lat},${end.lng}&output=embed`;
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
