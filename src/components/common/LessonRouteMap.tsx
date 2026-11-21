import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MapPin,
  Navigation,
  ExternalLink,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Flag,
  PlayCircle,
  LocateFixed
} from 'lucide-react';
import type { LessonGpsPoint } from '../../types';
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsEmbedUrl
} from '../../lib/lessonCheckinService';

interface LessonRouteMapProps {
  points: LessonGpsPoint[];
  previewPoint?: LessonGpsPoint | null;
  heightClass?: string;
  title?: string;
  isLive?: boolean;
}

const FALLBACK_CENTER = { lat: -19.9678, lng: -44.1984 };

const TILE_PROVIDERS: Array<(z: number, x: number, y: number) => string> = [
  (z, x, y) => `https://a.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`,
  (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`,
  (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
];

function latToTileY(lat: number, zoom: number): number {
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const latRad = (clampedLat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
}

function lonToTileX(lon: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return ((lon + 180) / 360) * n;
}

function computeFitZoom(points: LessonGpsPoint[], viewportW: number, viewportH: number): number {
  if (!points || points.length <= 1) return 16;

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

  const usableW = Math.max(80, viewportW * 0.72);
  const usableH = Math.max(80, viewportH * 0.68);

  for (let z = 17; z >= 10; z--) {
    const pxW = Math.abs(lonToTileX(maxLng, z) - lonToTileX(minLng, z)) * 256;
    const pxH = Math.abs(latToTileY(minLat, z) - latToTileY(maxLat, z)) * 256;
    if (pxW <= usableW && pxH <= usableH) {
      return z;
    }
  }
  return 10;
}

export const LessonRouteMap: React.FC<LessonRouteMapProps> = ({
  points,
  previewPoint = null,
  heightClass = 'h-64 sm:h-80',
  title = 'Mapa do Percurso da Aula',
  isLive = false
}) => {
  const [mapMode, setMapMode] = useState<'ROUTE_CANVAS' | 'GOOGLE_EMBED'>('ROUTE_CANVAS');
  const [zoomOffset, setZoomOffset] = useState<number>(0);
  const [panOffsetPx, setPanOffsetPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: 640, height: 320 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewport({
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
      }
    };

    updateSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(updateSize);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [mapMode]);

  const safePoints = points || [];
  const effectivePoints = useMemo(() => {
    if (safePoints.length > 0) return safePoints;
    if (previewPoint) return [previewPoint];
    return [];
  }, [safePoints, previewPoint]);

  const baseZoom = useMemo(
    () => computeFitZoom(effectivePoints, viewport.width, viewport.height),
    [effectivePoints, viewport.width, viewport.height]
  );
  const zoom = Math.max(9, Math.min(18, baseZoom + zoomOffset));

  const center = useMemo(() => {
    if (effectivePoints.length === 0) return FALLBACK_CENTER;
    if (effectivePoints.length === 1) {
      return { lat: effectivePoints[0].lat, lng: effectivePoints[0].lng };
    }
    let minLat = effectivePoints[0].lat;
    let maxLat = effectivePoints[0].lat;
    let minLng = effectivePoints[0].lng;
    let maxLng = effectivePoints[0].lng;
    for (const p of effectivePoints) {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    }
    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    };
  }, [effectivePoints]);

  const mapWidth = viewport.width;
  const mapHeight = viewport.height;

  const centerTileX = useMemo(() => lonToTileX(center.lng, zoom), [center.lng, zoom]);
  const centerTileY = useMemo(() => latToTileY(center.lat, zoom), [center.lat, zoom]);

  const tiles = useMemo(() => {
    const panTilesX = panOffsetPx.x / 256;
    const panTilesY = panOffsetPx.y / 256;
    const halfX = Math.ceil(mapWidth / 256 / 2) + 1;
    const halfY = Math.ceil(mapHeight / 256 / 2) + 1;

    const minTileX = Math.floor(centerTileX - panTilesX - halfX);
    const maxTileX = Math.floor(centerTileX - panTilesX + halfX);
    const minTileY = Math.floor(centerTileY - panTilesY - halfY);
    const maxTileY = Math.floor(centerTileY - panTilesY + halfY);
    const maxIndex = Math.pow(2, zoom);

    const out: Array<{ key: string; z: number; x: number; y: number; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        out.push({
          key: `${zoom}_${tx}_${ty}`,
          z: zoom,
          x: wrappedX,
          y: ty,
          left: mapWidth / 2 + (tx - centerTileX) * 256 + panOffsetPx.x,
          top: mapHeight / 2 + (ty - centerTileY) * 256 + panOffsetPx.y
        });
      }
    }
    return out;
  }, [centerTileX, centerTileY, zoom, mapWidth, mapHeight, panOffsetPx]);

  const projectedPoints = useMemo(() => {
    return safePoints.map((p) => {
      const px = mapWidth / 2 + (lonToTileX(p.lng, zoom) - centerTileX) * 256 + panOffsetPx.x;
      const py = mapHeight / 2 + (latToTileY(p.lat, zoom) - centerTileY) * 256 + panOffsetPx.y;
      return { ...p, x: px, y: py };
    });
  }, [safePoints, zoom, centerTileX, centerTileY, mapWidth, mapHeight, panOffsetPx]);

  const projectedPreviewPoint = useMemo(() => {
    if (!previewPoint || safePoints.length > 0) return null;
    const x = mapWidth / 2 + (lonToTileX(previewPoint.lng, zoom) - centerTileX) * 256 + panOffsetPx.x;
    const y = mapHeight / 2 + (latToTileY(previewPoint.lat, zoom) - centerTileY) * 256 + panOffsetPx.y;
    return { ...previewPoint, x, y };
  }, [previewPoint, safePoints.length, zoom, centerTileX, centerTileY, mapWidth, mapHeight, panOffsetPx]);

  const polylineStr = useMemo(
    () => projectedPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    [projectedPoints]
  );

  const googleDirectionsUrl = useMemo(() => buildGoogleMapsDirectionsUrl(effectivePoints), [effectivePoints]);
  const googleEmbedUrl = useMemo(() => buildGoogleMapsEmbedUrl(effectivePoints), [effectivePoints]);

  const startPoint = projectedPoints[0];
  const endPoint = projectedPoints[projectedPoints.length - 1];
  const latestPoint = safePoints[safePoints.length - 1] || previewPoint || null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return;
    setIsDragging(true);
    dragRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: panOffsetPx.x,
      startY: panOffsetPx.y
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setPanOffsetPx({
      x: Math.max(-420, Math.min(420, dragRef.current.startX + dx)),
      y: Math.max(-320, Math.min(320, dragRef.current.startY + dy))
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragRef.current = null;
  };

  const handleRecenter = () => {
    setZoomOffset(0);
    setPanOffsetPx({ x: 0, y: 0 });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Toolbar responsiva */}
      <div className="px-3.5 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold truncate">{title}</span>
          {isLive && (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
              <span>GPS Ao Vivo</span>
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
          {effectivePoints.length > 0 && (
            <a
              href={googleDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1 transition-colors"
              title="Abrir rota completa diretamente no aplicativo ou aba do Google Maps"
            >
              <span>Abrir Rota Google Maps</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>

      {/* Área do Mapa */}
      {mapMode === 'GOOGLE_EMBED' ? (
        <div className="flex flex-col">
          <div className={`relative w-full ${heightClass} bg-slate-100`}>
            {effectivePoints.length > 0 ? (
              <iframe
                key={googleEmbedUrl}
                title="Google Maps — Percurso da Aula"
                src={googleEmbedUrl}
                className="w-full h-full border-0"
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-slate-500 text-xs">
                <MapPin className="w-7 h-7 text-slate-400 mb-2" />
                <p className="font-semibold">
                  Aguardando coordenadas GPS para centralizar no Google Maps.
                </p>
              </div>
            )}
          </div>
          {safePoints.length > 1 && (
            <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700">
              <span>
                Visualizando localização no Google Maps ({safePoints.length} pontos capturados).
              </span>
              <a
                href={googleDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <span>Ver Rota Completa Ponto-a-Ponto no Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative w-full ${heightClass} overflow-hidden select-none touch-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{
            background: 'radial-gradient(circle at center, #eff6ff 0%, #dbeafe 60%, #cbd5e1 100%)'
          }}
        >
          {/* Grade de fallback anti-falha caso offline ou tiles bloqueados */}
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

          {/* Tiles do mapa com fallback automático multi-provedor HTTPS */}
          <div className="absolute inset-0 pointer-events-none">
            {tiles.map((t) => (
              <img
                key={t.key}
                src={TILE_PROVIDERS[0](t.z, t.x, t.y)}
                alt=""
                draggable={false}
                referrerPolicy="no-referrer"
                data-provider-idx="0"
                onError={(e) => {
                  const img = e.currentTarget as HTMLImageElement;
                  const idx = Number(img.dataset.providerIdx || '0') + 1;
                  if (idx < TILE_PROVIDERS.length) {
                    img.dataset.providerIdx = String(idx);
                    img.src = TILE_PROVIDERS[idx](t.z, t.x, t.y);
                  } else {
                    img.style.opacity = '0';
                  }
                }}
                className="absolute w-[256px] h-[256px] max-w-none opacity-95"
                style={{ left: `${t.left}px`, top: `${t.top}px` }}
              />
            ))}
          </div>

          {/* Rota traçada por cima dos tiles */}
          <svg width={mapWidth} height={mapHeight} className="absolute inset-0 pointer-events-none z-10">
            {projectedPoints.length > 1 && (
              <>
                <polyline
                  points={polylineStr}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
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
                  r={4.5}
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
              {safePoints.length === 1 && isLive && (
                <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full bg-emerald-400/50 animate-ping" />
              )}
              <div className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap">
                <PlayCircle className="w-3 h-3" />
                <span>{safePoints.length === 1 && isLive ? 'Início / Atual' : 'Início'}</span>
              </div>
            </div>
          )}

          {/* Pino Atual / Término (Check-out) */}
          {endPoint && projectedPoints.length > 1 && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none"
              style={{ left: `${endPoint.x}px`, top: `${endPoint.y}px` }}
            >
              {isLive && (
                <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full bg-blue-400/50 animate-ping" />
              )}
              <div
                className={`px-2 py-0.5 rounded-full text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap ${
                  isLive ? 'bg-blue-600' : 'bg-rose-600'
                }`}
              >
                <Flag className="w-3 h-3" />
                <span>{isLive ? 'Posição Atual' : 'Fim'}</span>
              </div>
            </div>
          )}

          {/* Pino de prévia de localização GPS antes do check-in */}
          {projectedPreviewPoint && (
            <div
              className="absolute -translate-x-1/2 -translate-y-full z-20 pointer-events-none"
              style={{ left: `${projectedPreviewPoint.x}px`, top: `${projectedPreviewPoint.y}px` }}
            >
              <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-8 h-8 rounded-full bg-sky-400/50 animate-ping" />
              <div className="px-2 py-0.5 rounded-full bg-sky-600 text-white text-[10px] font-extrabold shadow-md flex items-center gap-1 whitespace-nowrap">
                <LocateFixed className="w-3 h-3" />
                <span>GPS Pronto</span>
              </div>
            </div>
          )}

          {/* HUD de Telemetria no topo esquerdo */}
          {latestPoint && (
            <div className="absolute top-2.5 left-2.5 z-30 pointer-events-none bg-slate-900/85 backdrop-blur-xs text-white px-2.5 py-1 rounded-xl text-[10px] font-mono shadow-sm flex items-center gap-2">
              <span>
                {latestPoint.lat.toFixed(5)}, {latestPoint.lng.toFixed(5)}
              </span>
              {latestPoint.accuracy !== undefined && (
                <span className="text-emerald-300">±{Math.round(latestPoint.accuracy)}m</span>
              )}
            </div>
          )}

          {/* Controles de Zoom e Centralização */}
          <div className="absolute top-2.5 right-2.5 z-30 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.min(4, z + 1))}
              aria-label="Aproximar mapa"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-xs cursor-pointer"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoomOffset((z) => Math.max(-4, z - 1))}
              aria-label="Afastar mapa"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-slate-800 border border-slate-300 shadow-xs cursor-pointer"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleRecenter}
              aria-label="Centralizar rota"
              className="p-1.5 rounded-lg bg-white/95 hover:bg-white text-blue-600 border border-slate-300 shadow-xs cursor-pointer"
              title="Centralizar rota na tela"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Mensagem discreta apenas quando ainda não há nem pontos nem prévia GPS */}
          {effectivePoints.length === 0 && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/15 backdrop-blur-[1px] p-4 pointer-events-none">
              <div className="bg-white/95 px-4 py-3 rounded-xl border border-slate-200 shadow-md text-center max-w-xs">
                <p className="text-xs font-bold text-slate-900">Aguardando localização GPS</p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Inicie o check-in da aula e autorize a localização GPS do dispositivo para traçar a rota ao vivo.
                </p>
              </div>
            </div>
          )}

          {/* Legenda inferior */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="flex flex-wrap items-center gap-2 bg-white/95 backdrop-blur-xs px-2.5 py-1.5 rounded-xl border border-slate-200 shadow-xs text-[10px] font-bold text-slate-700">
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
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${isLive ? 'bg-blue-600' : 'bg-rose-600'}`} />{' '}
                {isLive ? 'Atual' : 'Término'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
