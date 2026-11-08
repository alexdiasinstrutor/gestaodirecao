import {
  CnhCategory,
  InstructorCoverageProfile,
  LocatorVehicleType,
  Organization,
  PackageOffer,
  Student,
  StudentLeadRequest,
  User,
  Vehicle,
  VehicleTransmissionType
} from '../types';

export interface GeoCoordinates {
  latitude: number;
  longitude: number;
  cidade: string;
  estado: string;
  bairro?: string;
}

export interface CityCoordinateEntry {
  cidade: string;
  estado: string;
  latitude: number;
  longitude: number;
  bairros?: Record<string, { latitude: number; longitude: number }>;
}

// Base de coordenadas reais das principais cidades e regiões metropolitanas brasileiras
export const BRAZIL_CITIES_COORDS: CityCoordinateEntry[] = [
  // Minas Gerais (MG)
  {
    cidade: 'Belo Horizonte',
    estado: 'MG',
    latitude: -19.9167,
    longitude: -43.9345,
    bairros: {
      centro: { latitude: -19.9191, longitude: -43.9386 },
      savassi: { latitude: -19.9361, longitude: -43.9347 },
      pampulha: { latitude: -19.8588, longitude: -43.9708 },
      barreiro: { latitude: -19.9747, longitude: -44.0149 },
      venda_nova: { latitude: -19.8169, longitude: -43.9547 },
      buritis: { latitude: -19.9711, longitude: -43.9661 },
      padre_eustaquio: { latitude: -19.9122, longitude: -43.9772 },
      santa_efigenia: { latitude: -19.9247, longitude: -43.9222 }
    }
  },
  { cidade: 'Contagem', estado: 'MG', latitude: -19.9317, longitude: -44.0536 },
  { cidade: 'Betim', estado: 'MG', latitude: -19.9678, longitude: -44.1983 },
  { cidade: 'Ribeirão das Neves', estado: 'MG', latitude: -19.7669, longitude: -44.0867 },
  { cidade: 'Santa Luzia', estado: 'MG', latitude: -19.7697, longitude: -43.8514 },
  { cidade: 'Ibirité', estado: 'MG', latitude: -20.0219, longitude: -44.0589 },
  { cidade: 'Sabará', estado: 'MG', latitude: -19.8844, longitude: -43.8067 },
  { cidade: 'Nova Lima', estado: 'MG', latitude: -19.9856, longitude: -43.8467 },
  { cidade: 'Vespasiano', estado: 'MG', latitude: -19.6919, longitude: -43.9233 },
  { cidade: 'Lagoa Santa', estado: 'MG', latitude: -19.6272, longitude: -43.8897 },
  { cidade: 'Sete Lagoas', estado: 'MG', latitude: -19.4658, longitude: -44.2467 },
  { cidade: 'Uberlândia', estado: 'MG', latitude: -18.9186, longitude: -48.2772 },
  { cidade: 'Juiz de Fora', estado: 'MG', latitude: -21.7642, longitude: -43.3503 },
  { cidade: 'Montes Claros', estado: 'MG', latitude: -16.735, longitude: -43.8617 },
  { cidade: 'Ipatinga', estado: 'MG', latitude: -19.4683, longitude: -42.5367 },
  { cidade: 'Divinópolis', estado: 'MG', latitude: -20.1389, longitude: -44.8839 },
  { cidade: 'Governador Valadares', estado: 'MG', latitude: -18.8511, longitude: -41.9494 },
  { cidade: 'Uberaba', estado: 'MG', latitude: -19.7483, longitude: -47.9319 },
  { cidade: 'Poços de Caldas', estado: 'MG', latitude: -21.7878, longitude: -46.5614 },
  { cidade: 'Pouso Alegre', estado: 'MG', latitude: -22.23, longitude: -45.9364 },

  // São Paulo (SP)
  {
    cidade: 'São Paulo',
    estado: 'SP',
    latitude: -23.5505,
    longitude: -46.6333,
    bairros: {
      centro: { latitude: -23.5505, longitude: -46.6333 },
      pinheiros: { latitude: -23.5673, longitude: -46.6939 },
      vila_mariana: { latitude: -23.5891, longitude: -46.6347 },
      mooca: { latitude: -23.5608, longitude: -46.5969 },
      tatuape: { latitude: -23.5403, longitude: -46.5766 },
      santana: { latitude: -23.5022, longitude: -46.625 },
      itaquera: { latitude: -23.5361, longitude: -46.4556 },
      santo_amaro: { latitude: -23.6542, longitude: -46.7097 },
      lapa: { latitude: -23.5233, longitude: -46.7022 },
      ipiranga: { latitude: -23.5858, longitude: -46.6097 }
    }
  },
  { cidade: 'Guarulhos', estado: 'SP', latitude: -23.4628, longitude: -46.5333 },
  { cidade: 'Osasco', estado: 'SP', latitude: -23.5325, longitude: -46.7917 },
  { cidade: 'Santo André', estado: 'SP', latitude: -23.6639, longitude: -46.5383 },
  { cidade: 'São Bernardo do Campo', estado: 'SP', latitude: -23.6939, longitude: -46.565 },
  { cidade: 'São Caetano do Sul', estado: 'SP', latitude: -23.6228, longitude: -46.5547 },
  { cidade: 'Diadema', estado: 'SP', latitude: -23.6861, longitude: -46.6228 },
  { cidade: 'Mauá', estado: 'SP', latitude: -23.6678, longitude: -46.4614 },
  { cidade: 'Barueri', estado: 'SP', latitude: -23.5111, longitude: -46.8764 },
  { cidade: 'Taboão da Serra', estado: 'SP', latitude: -23.6019, longitude: -46.7525 },
  { cidade: 'Campinas', estado: 'SP', latitude: -22.9056, longitude: -47.0608 },
  { cidade: 'Santos', estado: 'SP', latitude: -23.9608, longitude: -46.3336 },
  { cidade: 'São José dos Campos', estado: 'SP', latitude: -23.1794, longitude: -45.8869 },
  { cidade: 'Sorocaba', estado: 'SP', latitude: -23.5017, longitude: -47.4581 },
  { cidade: 'Ribeirão Preto', estado: 'SP', latitude: -21.1775, longitude: -47.8103 },
  { cidade: 'Jundiaí', estado: 'SP', latitude: -23.1864, longitude: -46.8842 },
  { cidade: 'Piracicaba', estado: 'SP', latitude: -22.7253, longitude: -47.6492 },
  { cidade: 'Bauru', estado: 'SP', latitude: -22.3147, longitude: -49.0606 },
  { cidade: 'São José do Rio Preto', estado: 'SP', latitude: -20.8197, longitude: -49.3794 },
  { cidade: 'Mogi das Cruzes', estado: 'SP', latitude: -23.5228, longitude: -46.1883 },

  // Rio de Janeiro (RJ)
  {
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    latitude: -22.9068,
    longitude: -43.1729,
    bairros: {
      centro: { latitude: -22.9035, longitude: -43.1823 },
      copacabana: { latitude: -22.9694, longitude: -43.1868 },
      barra_da_tijuca: { latitude: -23.0004, longitude: -43.3659 },
      tijuca: { latitude: -22.925, longitude: -43.2355 },
      meier: { latitude: -22.9022, longitude: -43.28 },
      campo_grande: { latitude: -22.9028, longitude: -43.5592 },
      jacarepagua: { latitude: -22.9469, longitude: -43.3567 },
      botafogo: { latitude: -22.9519, longitude: -43.1857 }
    }
  },
  { cidade: 'Niterói', estado: 'RJ', latitude: -22.8833, longitude: -43.1036 },
  { cidade: 'São Gonçalo', estado: 'RJ', latitude: -22.8269, longitude: -43.0539 },
  { cidade: 'Duque de Caxias', estado: 'RJ', latitude: -22.7856, longitude: -43.3117 },
  { cidade: 'Nova Iguaçu', estado: 'RJ', latitude: -22.7592, longitude: -43.4511 },
  { cidade: 'Belford Roxo', estado: 'RJ', latitude: -22.7642, longitude: -43.3997 },
  { cidade: 'São João de Meriti', estado: 'RJ', latitude: -22.8039, longitude: -43.3722 },
  { cidade: 'Petrópolis', estado: 'RJ', latitude: -22.505, longitude: -43.1786 },
  { cidade: 'Volta Redonda', estado: 'RJ', latitude: -22.5231, longitude: -44.1042 },
  { cidade: 'Campos dos Goytacazes', estado: 'RJ', latitude: -21.7522, longitude: -41.3303 },

  // Outras Capitais e Grandes Centros
  { cidade: 'Curitiba', estado: 'PR', latitude: -25.4284, longitude: -49.2733 },
  { cidade: 'São José dos Pinhais', estado: 'PR', latitude: -25.5347, longitude: -49.2064 },
  { cidade: 'Colombo', estado: 'PR', latitude: -25.2917, longitude: -49.2242 },
  { cidade: 'Londrina', estado: 'PR', latitude: -23.3045, longitude: -51.1696 },
  { cidade: 'Maringá', estado: 'PR', latitude: -23.4205, longitude: -51.9331 },
  { cidade: 'Porto Alegre', estado: 'RS', latitude: -30.0346, longitude: -51.2177 },
  { cidade: 'Canoas', estado: 'RS', latitude: -29.9178, longitude: -51.1836 },
  { cidade: 'Caxias do Sul', estado: 'RS', latitude: -29.1678, longitude: -51.1794 },
  { cidade: 'Florianópolis', estado: 'SC', latitude: -27.5954, longitude: -48.548 },
  { cidade: 'São José', estado: 'SC', latitude: -27.6136, longitude: -48.6366 },
  { cidade: 'Joinville', estado: 'SC', latitude: -26.3044, longitude: -48.8487 },
  { cidade: 'Blumenau', estado: 'SC', latitude: -26.9194, longitude: -49.0661 },
  { cidade: 'Brasília', estado: 'DF', latitude: -15.7939, longitude: -47.8828 },
  { cidade: 'Taguatinga', estado: 'DF', latitude: -15.8333, longitude: -48.0564 },
  { cidade: 'Goiânia', estado: 'GO', latitude: -16.6869, longitude: -49.2648 },
  { cidade: 'Aparecida de Goiânia', estado: 'GO', latitude: -16.8198, longitude: -49.2469 },
  { cidade: 'Anápolis', estado: 'GO', latitude: -16.3281, longitude: -48.9531 },
  { cidade: 'Salvador', estado: 'BA', latitude: -12.9714, longitude: -38.5014 },
  { cidade: 'Lauro de Freitas', estado: 'BA', latitude: -12.8944, longitude: -38.3272 },
  { cidade: 'Feira de Santana', estado: 'BA', latitude: -12.2664, longitude: -38.9664 },
  { cidade: 'Vitória da Conquista', estado: 'BA', latitude: -14.8619, longitude: -40.8444 },
  { cidade: 'Recife', estado: 'PE', latitude: -8.0476, longitude: -34.877 },
  { cidade: 'Olinda', estado: 'PE', latitude: -8.0089, longitude: -34.8553 },
  { cidade: 'Jaboatão dos Guararapes', estado: 'PE', latitude: -8.1128, longitude: -35.0147 },
  { cidade: 'Fortaleza', estado: 'CE', latitude: -3.7172, longitude: -38.5433 },
  { cidade: 'Caucaia', estado: 'CE', latitude: -3.7361, longitude: -38.6531 },
  { cidade: 'Vitória', estado: 'ES', latitude: -20.3155, longitude: -40.3128 },
  { cidade: 'Vila Velha', estado: 'ES', latitude: -20.3297, longitude: -40.2925 },
  { cidade: 'Serra', estado: 'ES', latitude: -20.1286, longitude: -40.3078 },
  { cidade: 'Cariacica', estado: 'ES', latitude: -20.2639, longitude: -40.42 },
  { cidade: 'Manaus', estado: 'AM', latitude: -3.119, longitude: -60.0217 },
  { cidade: 'Belém', estado: 'PA', latitude: -1.4558, longitude: -48.4902 },
  { cidade: 'Ananindeua', estado: 'PA', latitude: -1.3656, longitude: -48.3722 },
  { cidade: 'São Luís', estado: 'MA', latitude: -2.5387, longitude: -44.2825 },
  { cidade: 'João Pessoa', estado: 'PB', latitude: -7.1195, longitude: -34.845 },
  { cidade: 'Natal', estado: 'RN', latitude: -5.7945, longitude: -35.211 },
  { cidade: 'Maceió', estado: 'AL', latitude: -9.6658, longitude: -35.735 },
  { cidade: 'Aracaju', estado: 'SE', latitude: -10.9472, longitude: -37.0731 },
  { cidade: 'Teresina', estado: 'PI', latitude: -5.0892, longitude: -42.8019 },
  { cidade: 'Campo Grande', estado: 'MS', latitude: -20.4697, longitude: -54.6201 },
  { cidade: 'Cuiabá', estado: 'MT', latitude: -15.6014, longitude: -56.0979 },
  { cidade: 'Palmas', estado: 'TO', latitude: -10.1844, longitude: -48.3336 },
  { cidade: 'Porto Velho', estado: 'RO', latitude: -8.7619, longitude: -63.9039 },
  { cidade: 'Rio Branco', estado: 'AC', latitude: -9.9747, longitude: -67.8243 },
  { cidade: 'Macapá', estado: 'AP', latitude: 0.0349, longitude: -51.0694 },
  { cidade: 'Boa Vista', estado: 'RR', latitude: 2.8235, longitude: -60.6758 }
];

// Coordenadas centrais por UF como fallback
const STATE_CAPITALS_COORDS: Record<string, { latitude: number; longitude: number; cidade: string }> = {
  MG: { latitude: -19.9167, longitude: -43.9345, cidade: 'Belo Horizonte' },
  SP: { latitude: -23.5505, longitude: -46.6333, cidade: 'São Paulo' },
  RJ: { latitude: -22.9068, longitude: -43.1729, cidade: 'Rio de Janeiro' },
  PR: { latitude: -25.4284, longitude: -49.2733, cidade: 'Curitiba' },
  RS: { latitude: -30.0346, longitude: -51.2177, cidade: 'Porto Alegre' },
  SC: { latitude: -27.5954, longitude: -48.548, cidade: 'Florianópolis' },
  DF: { latitude: -15.7939, longitude: -47.8828, cidade: 'Brasília' },
  GO: { latitude: -16.6869, longitude: -49.2648, cidade: 'Goiânia' },
  BA: { latitude: -12.9714, longitude: -38.5014, cidade: 'Salvador' },
  PE: { latitude: -8.0476, longitude: -34.877, cidade: 'Recife' },
  CE: { latitude: -3.7172, longitude: -38.5433, cidade: 'Fortaleza' },
  ES: { latitude: -20.3155, longitude: -40.3128, cidade: 'Vitória' },
  AM: { latitude: -3.119, longitude: -60.0217, cidade: 'Manaus' },
  PA: { latitude: -1.4558, longitude: -48.4902, cidade: 'Belém' },
  MA: { latitude: -2.5387, longitude: -44.2825, cidade: 'São Luís' },
  PB: { latitude: -7.1195, longitude: -34.845, cidade: 'João Pessoa' },
  RN: { latitude: -5.7945, longitude: -35.211, cidade: 'Natal' },
  AL: { latitude: -9.6658, longitude: -35.735, cidade: 'Maceió' },
  SE: { latitude: -10.9472, longitude: -37.0731, cidade: 'Aracaju' },
  PI: { latitude: -5.0892, longitude: -42.8019, cidade: 'Teresina' },
  MS: { latitude: -20.4697, longitude: -54.6201, cidade: 'Campo Grande' },
  MT: { latitude: -15.6014, longitude: -56.0979, cidade: 'Cuiabá' },
  TO: { latitude: -10.1844, longitude: -48.3336, cidade: 'Palmas' },
  RO: { latitude: -8.7619, longitude: -63.9039, cidade: 'Porto Velho' },
  AC: { latitude: -9.9747, longitude: -67.8243, cidade: 'Rio Branco' },
  AP: { latitude: 0.0349, longitude: -51.0694, cidade: 'Macapá' },
  RR: { latitude: 2.8235, longitude: -60.6758, cidade: 'Boa Vista' }
};

export function normalizeTextKey(text?: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function clampRadiusKm(radiusKm: number): number {
  if (!Number.isFinite(radiusKm)) return 15;
  return Math.max(5, Math.min(40, Math.round(radiusKm)));
}

/**
 * Fórmula de Haversine para distância exata em quilômetros (km) entre 2 coordenadas geográficas
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

/**
 * Gera um deslocamento determinístico pequeno (~0.5km a ~4.5km) para diferenciar bairros/CEPs dentro de uma mesma cidade
 */
function computeNeighborhoodOffset(seedText: string): { dLat: number; dLon: number } {
  const clean = normalizeTextKey(seedText);
  if (!clean) return { dLat: 0, dLon: 0 };
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) % 100000;
  }
  const angle = ((hash % 360) * Math.PI) / 180;
  const radiusDeg = 0.008 + ((hash % 30) / 1000); // ~0.9 km a ~4.2 km
  return {
    dLat: Math.round(Math.sin(angle) * radiusDeg * 10000) / 10000,
    dLon: Math.round(Math.cos(angle) * radiusDeg * 10000) / 10000
  };
}

/**
 * Resolve coordenadas geográficas para qualquer cidade, estado, bairro ou CEP informado
 */
export function resolveCoordinatesForLocation(params: {
  cidade?: string;
  estado?: string;
  bairro?: string;
  cep?: string;
  latitude?: number;
  longitude?: number;
}): GeoCoordinates {
  if (
    typeof params.latitude === 'number' &&
    typeof params.longitude === 'number' &&
    Number.isFinite(params.latitude) &&
    Number.isFinite(params.longitude)
  ) {
    return {
      latitude: params.latitude,
      longitude: params.longitude,
      cidade: params.cidade?.trim() || 'São Paulo',
      estado: (params.estado?.trim() || 'SP').toUpperCase(),
      bairro: params.bairro?.trim()
    };
  }

  const cityNorm = normalizeTextKey(params.cidade);
  const ufNorm = (params.estado || '').trim().toUpperCase();
  const bairroNorm = normalizeTextKey(params.bairro).replace(/\s+/g, '_');

  // 1. Procura cidade exata na tabela de cidades
  let matchedCity = BRAZIL_CITIES_COORDS.find(
    (c) => normalizeTextKey(c.cidade) === cityNorm && (!ufNorm || c.estado === ufNorm)
  );
  if (!matchedCity && cityNorm) {
    matchedCity = BRAZIL_CITIES_COORDS.find(
      (c) => normalizeTextKey(c.cidade).includes(cityNorm) || cityNorm.includes(normalizeTextKey(c.cidade))
    );
  }

  if (matchedCity) {
    if (bairroNorm && matchedCity.bairros && matchedCity.bairros[bairroNorm]) {
      return {
        latitude: matchedCity.bairros[bairroNorm].latitude,
        longitude: matchedCity.bairros[bairroNorm].longitude,
        cidade: matchedCity.cidade,
        estado: matchedCity.estado,
        bairro: params.bairro?.trim()
      };
    }

    const offset = params.bairro
      ? computeNeighborhoodOffset(params.bairro)
      : params.cep
      ? computeNeighborhoodOffset(params.cep)
      : { dLat: 0, dLon: 0 };

    return {
      latitude: Number((matchedCity.latitude + offset.dLat).toFixed(5)),
      longitude: Number((matchedCity.longitude + offset.dLon).toFixed(5)),
      cidade: matchedCity.cidade,
      estado: matchedCity.estado,
      bairro: params.bairro?.trim()
    };
  }

  // 2. Fallback para capital do estado + offset determinístico pelo nome da cidade
  const stateFallback = STATE_CAPITALS_COORDS[ufNorm] || STATE_CAPITALS_COORDS.SP;
  const cityOffset = cityNorm ? computeNeighborhoodOffset(cityNorm + '_' + (params.bairro || '')) : { dLat: 0, dLon: 0 };

  return {
    latitude: Number((stateFallback.latitude + cityOffset.dLat * 2).toFixed(5)),
    longitude: Number((stateFallback.longitude + cityOffset.dLon * 2).toFixed(5)),
    cidade: params.cidade?.trim() || stateFallback.cidade,
    estado: ufNorm || 'SP',
    bairro: params.bairro?.trim()
  };
}

/**
 * Encontra a cidade conhecida mais próxima para uma coordenada de GPS do navegador
 */
export function findNearestCityFromCoords(latitude: number, longitude: number): CityCoordinateEntry {
  let best = BRAZIL_CITIES_COORDS[0];
  let bestDist = Infinity;
  for (const entry of BRAZIL_CITIES_COORDS) {
    const d = calculateDistanceKm(latitude, longitude, entry.latitude, entry.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = entry;
    }
  }
  return best;
}

/**
 * Infere os tipos de veículo a partir das categorias de CNH atendidas
 */
export function inferVehicleTypesFromCategories(categories: CnhCategory[]): LocatorVehicleType[] {
  const types = new Set<LocatorVehicleType>();
  for (const cat of categories) {
    if (cat === 'A' || cat === 'ACC' || cat === 'AB' || cat === 'AC' || cat === 'AD' || cat === 'AE') {
      types.add('MOTO');
    }
    if (cat === 'B' || cat === 'AB' || cat === 'PCD' || cat === 'OUTRA') {
      types.add('CARRO');
    }
    if (cat === 'C' || cat === 'AC' || cat === 'E' || cat === 'AE') {
      types.add('CAMINHAO');
    }
    if (cat === 'D' || cat === 'AD') {
      types.add('ONIBUS');
    }
  }
  if (types.size === 0) {
    types.add('CARRO');
  }
  return Array.from(types);
}

/**
 * Constrói ou complementa o perfil de cobertura geográfica e filtros de um instrutor
 */
export function buildEffectiveInstructorCoverage(params: {
  instructor: User;
  organization?: Organization;
  savedCoverage?: InstructorCoverageProfile;
  packages: PackageOffer[];
  vehicles: Vehicle[];
}): InstructorCoverageProfile {
  const { instructor, organization, savedCoverage, packages, vehicles } = params;

  const cidadeBase =
    savedCoverage?.cidadeBase?.trim() ||
    instructor.cidade?.trim() ||
    organization?.cidade?.trim() ||
    'São Paulo';
  const estadoBase = (
    savedCoverage?.estadoBase?.trim() ||
    instructor.estado?.trim() ||
    organization?.estado?.trim() ||
    'SP'
  ).toUpperCase();
  const bairroBase =
    savedCoverage?.bairroBase?.trim() ||
    instructor.bairro?.trim() ||
    organization?.bairro?.trim() ||
    'Centro';
  const cepBase = savedCoverage?.cepBase?.trim() || instructor.cep?.trim() || organization?.cep?.trim();

  // Categorias dos pacotes ativos cadastrados pelo instrutor
  const pkgCategories = Array.from(
    new Set(packages.filter((p) => p.ativo).map((p) => p.categoriaCnh))
  );
  const categoriasAtendidas: CnhCategory[] =
    savedCoverage?.categoriasAtendidas && savedCoverage.categoriasAtendidas.length > 0
      ? Array.from(new Set([...savedCoverage.categoriasAtendidas, ...pkgCategories]))
      : pkgCategories.length > 0
      ? pkgCategories
      : ['B'];

  // Tipos de veículo (MOTO, CARRO, CAMINHAO, ONIBUS)
  const vehicleFleetTypes = vehicles.map((v) => v.tipo);
  const inferredTypes = inferVehicleTypesFromCategories(categoriasAtendidas);
  const tiposVeiculo: LocatorVehicleType[] =
    savedCoverage?.tiposVeiculo && savedCoverage.tiposVeiculo.length > 0
      ? savedCoverage.tiposVeiculo
      : Array.from(new Set([...vehicleFleetTypes, ...inferredTypes]));

  const tipoCambio: VehicleTransmissionType = savedCoverage?.tipoCambio || 'AMBOS';
  const raioAtendimentoKm = clampRadiusKm(savedCoverage?.raioAtendimentoKm ?? 20);

  const cidadesSet = new Set<string>();
  if (cidadeBase) cidadesSet.add(cidadeBase);
  if (savedCoverage?.cidadesAtendidas) {
    savedCoverage.cidadesAtendidas.forEach((c) => {
      if (c && c.trim()) cidadesSet.add(c.trim());
    });
  }

  const coords = resolveCoordinatesForLocation({
    cidade: cidadeBase,
    estado: estadoBase,
    bairro: bairroBase,
    cep: cepBase,
    latitude: savedCoverage?.latitude,
    longitude: savedCoverage?.longitude
  });

  return {
    instrutorId: instructor.id,
    organizacaoId: instructor.organizacaoId,
    raioAtendimentoKm,
    cidadeBase: coords.cidade,
    estadoBase: coords.estado,
    bairroBase,
    cepBase,
    cidadesAtendidas: Array.from(cidadesSet),
    bairrosAtendidos: savedCoverage?.bairrosAtendidos || (bairroBase ? [bairroBase] : []),
    categoriasAtendidas,
    tiposVeiculo,
    tipoCambio,
    latitude: coords.latitude,
    longitude: coords.longitude,
    atualizadoEm: savedCoverage?.atualizadoEm || new Date().toISOString()
  };
}

export interface LocatedInstructorResult {
  instructor: User;
  organization?: Organization;
  coverage: InstructorCoverageProfile;
  packages: PackageOffer[];
  distanceKm: number;
  matchesCityDirectly: boolean;
  instructorCode: string;
}

export interface InstructorLocatorFilterParams {
  referenceCoords: GeoCoordinates;
  maxDistanceKm: number; // 5 a 40 km
  cidadeFiltro?: string; // 'TODAS' ou nome da cidade
  categoriaFiltro?: CnhCategory | 'TODAS';
  tipoVeiculoFiltro?: LocatorVehicleType | 'TODOS';
  tipoCambioFiltro?: VehicleTransmissionType | 'TODOS';
}

/**
 * Filtra e ordena os instrutores disponíveis para o mapa do aluno
 */
export function filterInstructorsForStudentMap(
  candidates: Array<{
    instructor: User;
    organization?: Organization;
    coverage: InstructorCoverageProfile;
    packages: PackageOffer[];
  }>,
  filters: InstructorLocatorFilterParams
): LocatedInstructorResult[] {
  const searchRadiusKm = clampRadiusKm(filters.maxDistanceKm);
  const targetCityNorm =
    filters.cidadeFiltro && filters.cidadeFiltro !== 'TODAS'
      ? normalizeTextKey(filters.cidadeFiltro)
      : '';

  const results: LocatedInstructorResult[] = [];

  for (const item of candidates) {
    const { instructor, organization, coverage, packages } = item;
    const lat = coverage.latitude ?? -23.5505;
    const lon = coverage.longitude ?? -46.6333;

    const distanceKm = calculateDistanceKm(
      filters.referenceCoords.latitude,
      filters.referenceCoords.longitude,
      lat,
      lon
    );

    const attendedCitiesNorm = coverage.cidadesAtendidas.map((c) => normalizeTextKey(c));
    const baseCityNorm = normalizeTextKey(coverage.cidadeBase);
    const refCityNorm = normalizeTextKey(filters.referenceCoords.cidade);

    const matchesCityDirectly =
      Boolean(targetCityNorm && (baseCityNorm === targetCityNorm || attendedCitiesNorm.includes(targetCityNorm))) ||
      Boolean(refCityNorm && (baseCityNorm === refCityNorm || attendedCitiesNorm.includes(refCityNorm)));

    // 1. Filtro de Cidade explícito selecionado pelo usuário
    if (targetCityNorm) {
      const servesTargetCity =
        baseCityNorm === targetCityNorm ||
        attendedCitiesNorm.includes(targetCityNorm) ||
        distanceKm <= Math.min(searchRadiusKm, coverage.raioAtendimentoKm);
      if (!servesTargetCity) continue;
    }

    // 2. Filtro de Distância (Raio de 5km a 40km selecionado pelo aluno E raio que o instrutor atende)
    // Se o instrutor cadastrou explicitamente a cidade do aluno em `cidadesAtendidas` e está dentro do raio buscado pelo aluno, ou dentro do raio mútuo:
    const withinStudentRadius = distanceKm <= searchRadiusKm;
    const withinInstructorCoverage =
      distanceKm <= coverage.raioAtendimentoKm || matchesCityDirectly;

    if (!withinStudentRadius || !withinInstructorCoverage) {
      continue;
    }

    // 3. Filtro de Categoria CNH
    if (filters.categoriaFiltro && filters.categoriaFiltro !== 'TODAS') {
      const hasCat =
        coverage.categoriasAtendidas.includes(filters.categoriaFiltro) ||
        packages.some((p) => p.ativo && p.categoriaCnh === filters.categoriaFiltro);
      if (!hasCat) continue;
    }

    // 4. Filtro de Tipo de Veículo (MOTO, CARRO, CAMINHAO, ONIBUS)
    if (filters.tipoVeiculoFiltro && filters.tipoVeiculoFiltro !== 'TODOS') {
      if (!coverage.tiposVeiculo.includes(filters.tipoVeiculoFiltro)) {
        continue;
      }
    }

    // 5. Filtro de Tipo de Câmbio (MANUAL, AUTOMATICO, AMBOS)
    if (filters.tipoCambioFiltro && filters.tipoCambioFiltro !== 'TODOS') {
      if (
        coverage.tipoCambio !== 'AMBOS' &&
        coverage.tipoCambio !== filters.tipoCambioFiltro
      ) {
        continue;
      }
    }

    results.push({
      instructor,
      organization,
      coverage,
      packages: packages.filter((p) => p.ativo),
      distanceKm,
      matchesCityDirectly,
      instructorCode: instructor.id.replace('usr_', '').toUpperCase()
    });
  }

  return results.sort((a, b) => a.distanceKm - b.distanceKm);
}

export interface MarketStudentPoint {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  bairro: string;
  categoriaCnh: CnhCategory;
  tipoVeiculo: LocatorVehicleType;
  tipoCambio: VehicleTransmissionType;
  latitude: number;
  longitude: number;
  distanceToInstructorKm: number;
  origem: 'ALUNO_MATRICULADO' | 'PROCURANDO_INSTRUTOR';
  semInstrutorNaCidade: boolean;
  statusLead?: StudentLeadRequest['status'];
  instrutorVinculadoId?: string;
  criadoEm: string;
  observacoes?: string;
}

export interface MarketCitySummary {
  cidade: string;
  estado: string;
  totalAlunosMatriculados: number;
  totalAlunosProcurando: number;
  totalAlunos: number;
  totalInstrutores: number;
  bairros: string[];
  distanciaMediaKm: number;
  semInstrutor: boolean;
}

/**
 * Calcula o panorama completo para o Mapa Interno Exclusivo de Instrutores Logados
 */
export function computeInstructorMarketOverview(params: {
  loggedInstructor: User;
  loggedInstructorCoverage: InstructorCoverageProfile;
  allInstructorsWithCoverage: Array<{
    instructor: User;
    coverage: InstructorCoverageProfile;
  }>;
  allStudents: Student[];
  allStudentLeads: StudentLeadRequest[];
}) {
  const {
    loggedInstructorCoverage,
    allInstructorsWithCoverage,
    allStudents,
    allStudentLeads
  } = params;

  const baseLat = loggedInstructorCoverage.latitude ?? -23.5505;
  const baseLon = loggedInstructorCoverage.longitude ?? -46.6333;

  // Mapeia todas as cidades que já possuem ao menos 1 instrutor atendendo
  const citiesWithInstructors = new Set<string>();
  allInstructorsWithCoverage.forEach(({ coverage }) => {
    if (coverage.cidadeBase) {
      citiesWithInstructors.add(normalizeTextKey(coverage.cidadeBase));
    }
    coverage.cidadesAtendidas.forEach((c) => citiesWithInstructors.add(normalizeTextKey(c)));
  });

  // Pontos de Instrutores com distância até o instrutor logado
  const instructorPoints = allInstructorsWithCoverage.map(({ instructor, coverage }) => {
    const lat = coverage.latitude ?? baseLat;
    const lon = coverage.longitude ?? baseLon;
    const distanceKm = calculateDistanceKm(baseLat, baseLon, lat, lon);
    return {
      instructor,
      coverage,
      latitude: lat,
      longitude: lon,
      distanceToMeKm: distanceKm
    };
  });

  // Pontos de Alunos (Matriculados + Leads à procura de instrutor)
  const studentPoints: MarketStudentPoint[] = [];

  for (const st of allStudents) {
    const coords = resolveCoordinatesForLocation({
      cidade: st.cidade || loggedInstructorCoverage.cidadeBase,
      estado: st.estado || loggedInstructorCoverage.estadoBase,
      bairro: st.bairro,
      cep: st.cep
    });
    const dist = calculateDistanceKm(baseLat, baseLon, coords.latitude, coords.longitude);
    const cityHasInst = citiesWithInstructors.has(normalizeTextKey(coords.cidade));
    const inferredVeh = inferVehicleTypesFromCategories([st.categoriaCnh])[0] || 'CARRO';

    studentPoints.push({
      id: st.id,
      nome: st.nome,
      telefone: st.telefone,
      cidade: coords.cidade,
      estado: coords.estado,
      bairro: st.bairro || 'Centro',
      categoriaCnh: st.categoriaCnh,
      tipoVeiculo: inferredVeh,
      tipoCambio: 'AMBOS',
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceToInstructorKm: dist,
      origem: 'ALUNO_MATRICULADO',
      semInstrutorNaCidade: !cityHasInst,
      instrutorVinculadoId: st.instrutorId,
      criadoEm: st.dataCadastro
    });
  }

  for (const lead of allStudentLeads) {
    const coords = resolveCoordinatesForLocation({
      cidade: lead.cidade,
      estado: lead.estado,
      bairro: lead.bairro,
      cep: lead.cep,
      latitude: lead.latitude,
      longitude: lead.longitude
    });
    const dist = calculateDistanceKm(baseLat, baseLon, coords.latitude, coords.longitude);
    const cityHasInst = citiesWithInstructors.has(normalizeTextKey(coords.cidade));

    studentPoints.push({
      id: lead.id,
      nome: lead.nome,
      telefone: lead.telefone,
      cidade: coords.cidade,
      estado: coords.estado,
      bairro: lead.bairro || 'Centro',
      categoriaCnh: lead.categoriaCnh,
      tipoVeiculo: lead.tipoVeiculo,
      tipoCambio: lead.tipoCambio,
      latitude: coords.latitude,
      longitude: coords.longitude,
      distanceToInstructorKm: dist,
      origem: 'PROCURANDO_INSTRUTOR',
      semInstrutorNaCidade: !cityHasInst || lead.semInstrutorNaCidade,
      statusLead: lead.status,
      criadoEm: lead.criadoEm,
      observacoes: lead.observacoes
    });
  }

  // Agrupamento por Cidade
  const cityMap = new Map<string, MarketCitySummary>();

  const ensureCity = (cidade: string, estado: string): MarketCitySummary => {
    const key = normalizeTextKey(cidade);
    const existing = cityMap.get(key);
    if (existing) return existing;
    const coords = resolveCoordinatesForLocation({ cidade, estado });
    const dist = calculateDistanceKm(baseLat, baseLon, coords.latitude, coords.longitude);
    const created: MarketCitySummary = {
      cidade: cidade.trim() || 'Não informada',
      estado: (estado || 'SP').toUpperCase(),
      totalAlunosMatriculados: 0,
      totalAlunosProcurando: 0,
      totalAlunos: 0,
      totalInstrutores: 0,
      bairros: [],
      distanciaMediaKm: dist,
      semInstrutor: !citiesWithInstructors.has(key)
    };
    cityMap.set(key, created);
    return created;
  };

  instructorPoints.forEach((ip) => {
    const attendedCities =
      ip.coverage.cidadesAtendidas.length > 0
        ? ip.coverage.cidadesAtendidas
        : [ip.coverage.cidadeBase];
    attendedCities.forEach((cityName) => {
      if (!cityName || !cityName.trim()) return;
      const summary = ensureCity(cityName, ip.coverage.estadoBase);
      summary.totalInstrutores += 1;
      summary.semInstrutor = false;
    });
  });

  studentPoints.forEach((sp) => {
    const summary = ensureCity(sp.cidade, sp.estado);
    if (sp.origem === 'PROCURANDO_INSTRUTOR') {
      summary.totalAlunosProcurando += 1;
    } else {
      summary.totalAlunosMatriculados += 1;
    }
    summary.totalAlunos += 1;
    if (sp.bairro && !summary.bairros.includes(sp.bairro)) {
      summary.bairros.push(sp.bairro);
    }
  });

  const citySummaries = Array.from(cityMap.values()).sort((a, b) => {
    if (a.semInstrutor !== b.semInstrutor) return a.semInstrutor ? -1 : 1;
    return b.totalAlunos - a.totalAlunos;
  });

  return {
    instructorPoints,
    studentPoints,
    citySummaries,
    citiesWithoutInstructors: citySummaries.filter((c) => c.semInstrutor && c.totalAlunos > 0)
  };
}
