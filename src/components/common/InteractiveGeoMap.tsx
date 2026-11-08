import React, { useState, useMemo, useRef } from 'react';
import {
  MapPin,
  Navigation,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  Car,
  UserCheck,
  GraduationCap,
  Sparkles,
  Phone
} from 'lucide-react';

export interface GeoMapPin {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string;
  badgeText?: string;
  distanceKm?: number;
  type: 'USER_ORIGIN' | 'INSTRUCTOR' | 'STUDENT_LEAD' | 'STUDENT_ACTIVE';
  highlight?: boolean;
  meta?: any;
}

interface InteractiveGeoMapProps {
  centerLat: number;
  centerLon: number;
  radiusKm: number; // 5 a 40 km
  pins: GeoMapPin[];
  selectedPinId?: string;
  onSelectPin?: (pin: GeoMapPin) => void;
  heightClass?: string;
  showLegend?: boolean;
  mode?: 'PUBLIC_STUDENT' | 'INTERNAL_INSTRUCTOR';
}

// Conversão Web Mercator (EPSG:3857) exata para alinhar tiles OpenStreetMap e pinos vetoriais
function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  const n = Math.pow(2, zoom);
  return ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
}

function lonToTileX(lon: number, zoom: number): number {
  const n = Math.pow(2, zoom);
  return ((lon + 180) / 360) * n;
}

function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom);
}

function getIdealZoomForRadius(radiusKm: number): number {
  if (radiusKm <= 7) return 12;
  if (radiusKm <= 15) return 11;
  if (radiusKm <= 28) return 10;
  return 9;
}

export const InteractiveGeoMap: React.FC<InteractiveGeoMapProps> = ({
  centerLat,
  centerLon,
  radiusKm,
  pins,
  selectedPinId,
  onSelectPin,
  heightClass = 'h-[380px] sm:h-[440px]',
  showLegend = true,
  mode = 'PUBLIC_STUDENT'
}) => {
  const [zoomOffset, setZoomOffset] = useState<number>(0);
  const [panOffsetPx, setPanOffsetPx] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startPanX: number; startPanY: number } | null>(null);

  const baseZoom = getIdealZoomForRadius(radiusKm);
  const zoom = Math.max(8, Math.min(15, baseZoom + zoomOffset));

  const mapWidth = 800;
  const mapHeight = 480;

  const centerTileX = useMemo(() => lonToTileX(centerLon, zoom), [centerLon, zoom]);
  const centerTileY = useMemo(() => latToTileY(centerLat, zoom), [centerLat, zoom]);

  // Calcula os tiles 256x256 necessários para cobrir o viewport
  const tiles = useMemo(() => {
    const minTileX = Math.floor(centerTileX - 3);
    const maxTileX = Math.floor(centerTileX + 3);
    const minTileY = Math.floor(centerTileY - 2);
    const maxTileY = Math.floor(centerTileY + 2);
    const maxIndex = Math.pow(2, zoom);

    const list: Array<{ key: string; url: string; left: number; top: number }> = [];
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      for (let ty = minTileY; ty <= maxTileY; ty++) {
        if (ty < 0 || ty >= maxIndex) continue;
        const wrappedX = ((tx % maxIndex) + maxIndex) % maxIndex;
        const left = mapWidth / 2 + (tx - centerTileX) * 256 + panOffsetPx.x;
        const top = mapHeight / 2 + (ty - centerTileY) * 256 + panOffsetPx.y;
        list.push({
          key: `${zoom}_${tx}_${ty}`,
          url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${ty}.png`,
          left,
          top
        });
      }
    }
    return list;
  }, [centerTileX, centerTileY, zoom, panOffsetPx]);

  // Raio em pixels no nível de zoom atual
  const radiusPixels = useMemo(() => {
    const mpp = metersPerPixel(centerLat, zoom);
    if (!mpp || mpp <= 0) return 120;
    return Math.max(24, Math.min(360, (radiusKm * 1000) / mpp));
  }, [centerLat, zoom, radiusKm]);

  // Posição de cada pino em pixels dentro do container
  const projectedPins = useMemo(() => {
    return pins.map((pin) => {
      const pTileX = lonToTileX(pin.longitude, zoom);
      const pTileY = latToTileY(pin.latitude, zoom);
      const x = mapWidth / 2 + (pTileX - centerTileX) * 256 + panOffsetPx.x;
      const y = mapHeight / 2 + (pTileY - centerTileY) * 256 + panOffsetPx.y;
      return {
        ...pin,
        x,
        y
      };
    });
  }, [pins, zoom, centerTileX, centerTileY, panOffsetPx]);

  const selectedPin = useMemo(
    () => projectedPins.find((p) => p.id === selectedPinId),
    [projectedPins, selectedPinId]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startPanX: panOffsetPx.x,
      startPanY: panOffsetPx.y
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffsetPx({
      x: Math.max(-350, Math.min(350, dragStartRef.current.startPanX + dx)),
      y: Math.max(-250, Math.min(250, dragStartRef.current.startPanY + dy))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const handleResetView = () => {
    setZoomOffset(0);
    setPanOffsetPx({ x: 0, y: 0 });
  };

  const centerPxX = mapWidth / 2 + panOffsetPx.x;
  const centerPxY = mapHeight / 2 + panOffsetPx.y;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-300 bg-slate-900 shadow-inner select-none">
      {/* Container Interativo do Mapa */}
      <div
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className={`relative w-full ${heightClass} overflow-hidden ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        style={{
          background:
            'radial-gradient(circle at center, #eff6ff 0%, #dbeafe 55%, #cbd5e1 100%)'
        }}
      >
        {/* Viewport Centralizado Proporcional */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: `${mapWidth}px`, height: `${mapHeight}px` }}
        >
          {/* Grade Cartográfica de Fundo (Fallback Instantâneo & Alta Performance) */}
          <svg
            width={mapWidth}
            height={mapHeight}
            className="absolute inset-0 pointer-events-none opacity-45"
          >
            <defs>
              <pattern id="geoGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path
                  d="M 40 0 L 0 0 0 40"
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="0.7"
                  strokeDasharray="2,2"
                />
              </pattern>
            </defs>
            <rect width={mapWidth} height={mapHeight} fill="url(#geoGrid)" />
          </svg>

          {/* Camada de Tiles OpenStreetMap */}
          <div className="absolute inset-0 pointer-events-none">
            {tiles.map((t) => (
              <img
                key={t.key}
                src={t.url}
                alt=""
                draggable={false}
                loading="eager"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = '0';
                }}
                className="absolute w-[256px] h-[256px] max-w-none transition-opacity duration-200 opacity-90"
                style={{ left: `${t.left}px`, top: `${t.top}px` }}
              />
            ))}
          </div>

          {/* Círculo de Raio de Alcance (5 km a 40 km) */}
          <svg
            width={mapWidth}
            height={mapHeight}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Círculo externo do raio selecionado */}
            <circle
              cx={centerPxX}
              cy={centerPxY}
              r={radiusPixels}
              fill="rgba(37, 99, 235, 0.13)"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeDasharray="6,4"
            />
            {/* Sub-anel de 50% do raio */}
            <circle
              cx={centerPxX}
              cy={centerPxY}
              r={radiusPixels * 0.5}
              fill="none"
              stroke="rgba(37, 99, 235, 0.35)"
              strokeWidth="1.2"
              strokeDasharray="3,3"
            />
            {/* Etiqueta do Raio */}
            <g transform={`translate(${centerPxX}, ${Math.max(24, centerPxY - radiusPixels - 8)})`}>
              <rect
                x="-58"
                y="-14"
                width="116"
                height="20"
                rx="10"
                fill="#1e3a8a"
                 opacity="0.92"
              />
              <text
                x="0"
                y="-1"
                textAnchor="middle"
                fill="#ffffff"
                fontSize="10"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Raio: {radiusKm} km
              </text>
            </g>
          </svg>

          {/* Ponto Central da Localização de Referência */}
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
            style={{ left: `${centerPxX}px`, top: `${centerPxY}px` }}
          >
            <div className="relative flex items-center justify-center">
              <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-500 opacity-40" />
              <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow-md" />
            </div>
          </div>

          {/* Pinos Interativos no Mapa */}
          {projectedPins.map((pin) => {
            if (pin.type === 'USER_ORIGIN') return null;
            const isSelected = pin.id === selectedPinId;

            const pinColorClasses =
              pin.type === 'INSTRUCTOR'
                ? isSelected
                  ? 'bg-emerald-600 text-white border-white ring-4 ring-emerald-400/60 scale-115 z-30'
                  : 'bg-emerald-600 text-white border-white hover:scale-110 z-20'
                : pin.type === 'STUDENT_LEAD'
                ? isSelected
                  ? 'bg-amber-600 text-white border-white ring-4 ring-amber-400/60 scale-115 z-30'
                  : 'bg-amber-500 text-slate-950 border-white hover:scale-110 z-25'
                : isSelected
                ? 'bg-indigo-600 text-white border-white ring-4 ring-indigo-400/60 scale-115 z-30'
                : 'bg-indigo-600 text-white border-white hover:scale-110 z-20';

            return (
              <button
                key={pin.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPin?.(pin);
                }}
                style={{ left: `${pin.x}px`, top: `${pin.y}px` }}
                className={`absolute -translate-x-1/2 -translate-y-full transition-all duration-150 cursor-pointer group focus:outline-none ${
                  isSelected ? 'z-30' : 'z-20'
                }`}
                title={`${pin.title}${pin.distanceKm !== undefined ? ` (${pin.distanceKm} km)` : ''}`}
              >
                <div className="flex flex-col items-center">
                  {/* Etiqueta suspensa no Pino */}
                  <div
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-md border mb-0.5 flex items-center gap-1 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-700'
                        : 'bg-white/95 text-slate-900 border-slate-300 group-hover:bg-slate-900 group-hover:text-white'
                    }`}
                  >
                    <span className="truncate max-w-[115px]">{pin.title}</span>
                    {pin.distanceKm !== undefined && (
                      <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-600 group-hover:text-blue-300">
                        {pin.distanceKm}km
                      </span>
                    )}
                  </div>

                  {/* Ícone do Pino */}
                  <div
                    className={`w-8 h-8 rounded-full border-2 shadow-lg flex items-center justify-center transition-transform ${pinColorClasses}`}
                  >
                    {pin.type === 'INSTRUCTOR' ? (
                      <Car className="w-4 h-4" />
                    ) : pin.type === 'STUDENT_LEAD' ? (
                      <Sparkles className="w-4 h-4" />
                    ) : (
                      <GraduationCap className="w-4 h-4" />
                    )}
                  </div>
                  <div className="w-2 h-2 rotate-45 -mt-1 bg-slate-900" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Barra Superior Flutuante: Status do Mapa e Coordenadas */}
        <div className="absolute top-3 left-3 right-14 z-30 flex flex-wrap items-center gap-1.5 pointer-events-none">
          <span className="px-2.5 py-1 rounded-xl bg-slate-900/90 backdrop-blur-xs text-white text-[11px] font-bold flex items-center gap-1.5 shadow-md border border-slate-700">
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              Raio Ativo: <strong className="text-cyan-300">{radiusKm} km</strong>
            </span>
            <span className="text-slate-400">·</span>
            <span>{pins.filter((p) => p.type !== 'USER_ORIGIN').length} ponto(s) no mapa</span>
          </span>
        </div>

        {/* Controles de Zoom e Centralização (Direita) */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.min(4, z + 1))}
            className="w-8 h-8 rounded-xl bg-white/95 hover:bg-white text-slate-800 shadow-md border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Aproximar mapa (Zoom +)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setZoomOffset((z) => Math.max(-3, z - 1))}
            className="w-8 h-8 rounded-xl bg-white/95 hover:bg-white text-slate-800 shadow-md border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Afastar mapa (Zoom -)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="w-8 h-8 rounded-xl bg-white/95 hover:bg-white text-blue-600 shadow-md border border-slate-200 flex items-center justify-center cursor-pointer transition-colors"
            title="Centralizar mapa no raio selecionado"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Card de Detalhe do Pino Selecionado no Rodapé do Mapa */}
        {selectedPin && (
          <div className="absolute bottom-3 left-3 right-3 z-30 bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-bold text-slate-900 text-xs">{selectedPin.title}</span>
                {selectedPin.badgeText && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                    {selectedPin.badgeText}
                  </span>
                )}
                {selectedPin.distanceKm !== undefined && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[10px]">
                    a {selectedPin.distanceKm} km de distância
                  </span>
                )}
              </div>
              {selectedPin.subtitle && (
                <p className="text-[11px] text-slate-600 truncate">{selectedPin.subtitle}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legenda Inferior */}
      {showLegend && (
        <div className="bg-slate-900 text-slate-200 px-3 py-2 text-[11px] flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block ring-2 ring-white/50" />
              <span>Sua Localização / Centro ({radiusKm} km)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Instrutor Credenciado</span>
            </span>
            {mode === 'INTERNAL_INSTRUCTOR' && (
              <>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                  <span>Aluno Procurando Instrutor</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                  <span>Aluno Matriculado</span>
                </span>
              </>
            )}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Arraste para mover · Clique nos pontos para detalhes
          </span>
        </div>
      )}
    </div>
  );
};
