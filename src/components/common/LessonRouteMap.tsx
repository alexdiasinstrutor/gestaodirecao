import React, { useMemo, useState } from 'react';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flag,
  PlayCircle
} from 'lucide-react';
import type { LessonGpsPoint } from '../../types';
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl
} from '../../lib/lessonCheckinService';

interface LessonRouteMapProps {
  points: LessonGpsPoint[];
  heightClass?: string;
  title?: string;
  isLive?: boolean;
}

const FALLBACK_CENTER = { lat: -19.9678, lng: -44.1984 };

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
}

function lonToTileX(lon: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return ((lon + 180) / 360) * n;
}

function computeAutoZoom(points: LessonGpsPoint[]): number {
  if (points.length <= 1) return 15;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  const span = Math.max(maxLat - minLat, maxLng - minLng);
  if (span < 0.004) return 16;
  if (span < 0.012) return 15;
  if (span < 0.035) return 14;
  if (span < 0.08) return 13;
  return 12;
}

export const LessonRouteMap: React.FC<LessonRouteMapProps> = ({
  points,
  heightClass = 'h-64 sm:h-80',
  title = 'Mapa do Percurso da Aula',
  isLive = false
}) => {
  const [mapMode, setMapMode] = useState<'ROUTE_CANVAS' | 'GOOGLE_EMBED'>('ROUTE_CANVAS');
  const [zoomOffset, setZoomOffset] = useState<number>(0);

  const safePoints = points || [];
  const baseZoom = useMemo(() => computeAutoZoom(safePoints), [safePoints]);
  const zoom = Math.max(10, Math.min(18, baseZoom + zoomOffset));

  const center = useMemo(() => {
    if (safePoints.length === 0) return FALLBACK_CENTER;
    const sum = safePoints.reduce(
      (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
      { lat: 0, lng: 0 }
    );
    return {
      lat: sum.lat / safePoints.length,
      lng: sum.lng / safePoints.length
    };
  }, [safePoints]);

  const mapWidth = 760;
  const mapHeight = 360;

  const centerTileX = useMemo(() => lonToTileX(center.lng, zoom), [center.lng, zoom]);
  const centerTileY = useMemo(() => latToTileY(center.lat, zoom), [center.lat, zoom]);

  const tiles = useMemo(() => {
    const minTileX = Math.floor(centerTileX - 2);
    const maxTileX = Math.floor(centerTileX + 2);
    const minTileY = Math.floor(centerTileY - 2);
    const maxTileY = Math.floor(centerTileY + 2);
    const maxIndex = Math.pow(2, zoom);

    const out: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        out.push({
          key: `${zoom}_${tx}_${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left: mapWidth / 2 + (tx - centerTileX) * 256,
          top: mapHeight / 2 + (ty - centerTileY) * 256
        });
      }
    }
    return out;
  }, [centerTileX, centerTileY, zoom]);

  const projectedPoints = useMemo(() => {
    return safePoints.map((p) => {
      const px = mapWidth / 2 + (lonToTileX(p.lng, zoom) - centerTileX) * 256;
      const py = mapHeight / 2 + (latToTileY(p.lat, zoom) - centerTileY) * 256;
      return { ...p, x: px, y: py };
    });
  }, [safePoints, zoom, centerTileX, centerTileY]);

  const polylineStr = useMemo(
    () => projectedPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    [projectedPoints]
  );

  const googleDirectionsUrl = useMemo(() => buildGoogleMapsDirectionsUrl(safePoints), [safePoints]);
  const googleEmbedUrl = useMemo(() => buildGoogleMapsEmbedUrl(safePoints), [safePoints]);

  const startPoint = projectedPoints[0];
  const endPoint = projectedPoints[projectedPoints.length - 1];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Toolbar responsiva */}
      <div className="px-3.5 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold truncate">{title}</span>
          {isLive && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0">
              GPS Ao Vivo
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMapMode('ROUTE_CANVAS')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
              mapMode === 'ROUTE_CANVAS'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Trajeto Interativo
          </button>
          <button
            type="button"
            onClick={() => setMapMode('GOOGLE_EMBED')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-colors flex items-center gap-1 ${
              mapMode === 'GOOGLE_EMBED'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Layers className="w-3 h-3" />
            <span>Google Maps</span>
          </button>
          {safePoints.length > 0 && (
            <a
              href={googleDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
              title="Abrir rota completa diretamente no Google Maps"
            >
              <span>Abrir Rota Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Área do Mapa */}
      {mapMode === 'GOOGLE_EMBED' ? (
        <div className={`relative w-full ${heightClass} bg-slate-100`}>
          {safePoints.length > 0 ? (
            <iframe
              title="Google Maps — Percurso da Aula"
              src={googleEmbedUrl}
              className="w-full h-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
              <MapPin className="w-7 h-7 text-slate-400 mb-2" />
              <p className="font-semibold">Aguardando primeiras coordenadas GPS para abrir no Google Maps.</p>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`relative w-full ${heightClass} overflow-hidden select-none`}
          style={{
            background: 'radial-gradient(circle at center, #eff6ff 0%, #dbeafe 60%, #cbd5e1 100%)'
          }}
        >
          {/* Viewport centralizado */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
          >
            {/* Grade de fallback anti-falha caso offline */}
            <svg width={mapWidth} height={mapHeight} className="absolute inset-0 pointer-events-none opacity-45">
              <defs>
                <pattern id="lessonRouteGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path
                    d="M 40 0 L 0 0 0 40"
                    fill="none"
                    stroke="#94a3b8"
                    strokeWidth="0.7"
                    strokeDasharray="2,2"
                  />
                </pattern>
              </defs>
              <rect width={mapWidth} height={mapHeight} fill="url(#lessonRouteGrid)" />
            </svg>

            {/* Tiles do mapa */}
            <div className="absolute inset-0 pointer-events-none">
              {tiles.map((t) => (
                <img
                  key={t.key}
                  src={t.url}
                  alt=""
                  draggable={false}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.opacity = '0';
                  }}
                  className="absolute w-[256px] h-[256px] max-w-none opacity-90"
                  style={{ left: `${t.left}px`, top: `${t.top}px` }}
                />
              ))}
            </div>

            {/* Rota traçada por cima dos tiles */}
            <svg width={mapWidth} height={mapHeight} className="absolute inset-0 pointer-events-none">
              {projectedPoints.length > 1 && (
                <>
                  <polyline
                    points={polylineStr}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                  <polyline
                    points={polylineStr}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </>
              )}

              {/* Pontos de parada detectados */}
              {projectedPoints.map((pt, i) =>
                (pt.speedKmh ?? 10) < 2 && i > 0 && i < projectedPoints.length - 1 ? (
                  <circle
                    key={`stop_${i}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={4}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                ) : null
              )}
            </svg>

            {/* Pino de Início (Check-in) */}
            {startPoint && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none"
                style={{ left: `${startPoint.x}px`, top: `${startPoint.y}px` }}
              >
                <div className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap">
                  <PlayCircle className="w-3 h-3" />
                  <span>Início</span>
                </div>
              </div>
            )}

            {/* Pino Atual / Término (Check-out) */}
            {endPoint && projectedPoints.length > 1 && (
              <div
                className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none"
                style={{ left: `${endPoint.x}px`, top: `${endPoint.y}px` }}
              >
                <div className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap">
                  <Flag className="w-3 h-3" />
                  <span>{isLive ? 'Atual' : 'Fim'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Controles de Zoom */}
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.min(3, z + 1))}
              aria-label="Aproximar mapa"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-xs cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.max(-3, z - 1))}
              aria-label="Afastar mapa"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-xs cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomOffset(0)}
              aria-label="Centralizar rota"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-xs cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagem quando não há pontos ainda */}
          {safePoints.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/20 backdrop-blur-[1px] p-4">
              <div className="bg-white/95 px-4 py-3 rounded-xl border border-slate-200 shadow-md text-center max-w-xs">
                <p className="text-xs font-bold text-slate-900">Nenhuma coordenada registrada ainda</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Inicie o check-in da aula e autorize a localização GPS do dispositivo para traçar a rota em tempo real.
                </p>
              </div>
            </div>
          )}

          {/* Legenda inferior */}
          <div className="absolute bottom-2.5 left-2.5 z-30 flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs text-[10px] font-bold text-slate-700">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Início
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-1 bg-blue-600 inline-block rounded" /> Trajeto ({safePoints.length} pts)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Parada
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" /> Término
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
