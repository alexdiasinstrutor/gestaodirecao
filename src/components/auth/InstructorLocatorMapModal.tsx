import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Search,
  Car,
  Phone,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal,
  Sparkles,
  UserCheck,
  Send,
  Compass,
  Loader2,
  MessageCircle,
  ShieldCheck
} from 'lucide-react';
import {
  CNH_CATEGORIES,
  CnhCategory,
  LocatorVehicleType,
  StudentLeadRequest,
  User,
  VehicleTransmissionType
} from '../../types';
import { db, syncFromSupabase } from '../../lib/storage';
import {
  BRAZIL_CITIES_COORDS,
  buildEffectiveInstructorCoverage,
  clampRadiusKm,
   filterInstructorsForStudentMap,
  findNearestCityFromCoords,
  LocatedInstructorResult,
  normalizeTextKey,
  resolveCoordinatesForLocation
} from '../../lib/geoService';
import { InteractiveGeoMap, GeoMapPin } from '../common/InteractiveGeoMap';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { cleanPhoneDigits, formatPhone, isValidPhone, maskPhoneInput } from '../../lib/validation';

interface InstructorLocatorMapModalProps {
  onClose: () => void;
  onSelectInstructor: (instructor: User, code: string) => void;
}

export const InstructorLocatorMapModal: React.FC<InstructorLocatorMapModalProps> = ({
  onClose,
  onSelectInstructor
}) => {
  const [syncing, setSyncing] = useState<boolean>(true);
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Localização de referência do aluno (Cidade, Bairro, UF ou GPS)
  const [estadoBusca, setEstadoBusca] = useState<string>('MG');
  const [cidadeBusca, setCidadeBusca] = useState<string>('Belo Horizonte');
  const [bairroBusca, setBairroBusca] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsFeedback, setGpsFeedback] = useState<string>('');

  // Filtros do Mapa (Raio 5 a 40 km, Cidade do App, Categoria, Tipo de Veículo, Câmbio)
  const [radiusKm, setRadiusKm] = useState<number>(20);
  const [cidadeAppFiltro, setCidadeAppFiltro] = useState<string>('TODAS');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CnhCategory | 'TODAS'>('TODAS');
  const [tipoVeiculoFiltro, setTipoVeiculoFiltro] = useState<LocatorVehicleType | 'TODOS'>('TODOS');
  const [tipoCambioFiltro, setTipoCambioFiltro] = useState<VehicleTransmissionType | 'TODOS'>('TODOS');

  const [selectedPinId, setSelectedPinId] = useState<string | undefined>(undefined);

  // Formulário de Demanda Reversa ("Não localizou instrutor? Sinalize que está à procura")
  const [showLeadForm, setShowLeadForm] = useState<boolean>(false);
  const [leadNome, setLeadNome] = useState<string>('');
  const [leadTelefone, setLeadTelefone] = useState<string>('');
  const [leadEmail, setLeadEmail] = useState<string>('');
  const [leadEstado, setLeadEstado] = useState<string>('MG');
  const [leadCidade, setLeadCidade] = useState<string>('Belo Horizonte');
  const [leadBairro, setLeadBairro] = useState<string>('');
  const [leadCategoria, setLeadCategoria] = useState<CnhCategory>('B');
  const [leadTipoVeiculo, setLeadTipoVeiculo] = useState<LocatorVehicleType>('CARRO');
  const [leadTipoCambio, setLeadTipoCambio] = useState<VehicleTransmissionType>('AMBOS');
  const [leadObservacoes, setLeadObservacoes] = useState<string>('');
  const [leadError, setLeadError] = useState<string>('');
  const [leadSuccess, setLeadSuccess] = useState<boolean>(false);
  const [leadSaving, setLeadSaving] = useState<boolean>(false);

  // Hidrata dados do Supabase ao abrir o mapa
  useEffect(() => {
    let mounted = true;
    setSyncing(true);
    Promise.all([db.syncRemoteInstructors(), syncFromSupabase()])
      .then(() => {
        if (!mounted) return;
        const instructors = db.getAllInstructors();
        const firstInst = instructors[0];
        if (firstInst) {
          const org = db.getOrganization(firstInst.organizacaoId);
          const cov = db.getInstructorCoverage(firstInst.id);
          const initialCity = cov?.cidadeBase || firstInst.cidade || org?.cidade || 'Belo Horizonte';
          const initialState = cov?.estadoBase || firstInst.estado || org?.estado || 'MG';
          setCidadeBusca(initialCity);
          setEstadoBusca(initialState);
          setLeadCidade(initialCity);
          setLeadEstado(initialState);
        }
        setDataVersion((v) => v + 1);
      })
      .finally(() => {
        if (mounted) setSyncing(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Lista todos os instrutores credenciados com suas respectivas coberturas e pacotes
  const allCandidates = useMemo(() => {
    const instructors = db.getAllInstructors();
    return instructors.map((inst) => {
      const org = db.getOrganization(inst.organizacaoId);
      const savedCov = db.getInstructorCoverage(inst.id);
      const pkgs = db.getPackages(inst.organizacaoId, inst.id);
      const vehicles = db.getVehicles(inst.organizacaoId);
      const coverage = buildEffectiveInstructorCoverage({
        instructor: inst,
        organization: org,
        savedCoverage: savedCov,
        packages: pkgs,
        vehicles
      });
      return {
        instructor: inst,
        organization: org,
        coverage,
        packages: pkgs
      };
    });
  }, [dataVersion]);

  // Lista de todas as cidades cadastradas/atendidas no app para o seletor rápido
  const appRegisteredCities = useMemo(() => {
    const citySet = new Set<string>();
    allCandidates.forEach(({ coverage }) => {
      if (coverage.cidadeBase) citySet.add(coverage.cidadeBase);
      coverage.cidadesAtendidas.forEach((c) => {
        if (c && c.trim()) citySet.add(c.trim());
      });
    });
    BRAZIL_CITIES_COORDS.slice(0, 25).forEach((c) => citySet.add(c.cidade));
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [allCandidates]);

  // Coordenada central de referência para o mapa (GPS ou Cidade/Bairro digitado)
  const referenceCoords = useMemo(() => {
    if (gpsCoords) {
      return resolveCoordinatesForLocation({
        cidade: cidadeBusca,
        estado: estadoBusca,
        bairro: bairroBusca,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude
      });
    }
    const activeCity = cidadeAppFiltro !== 'TODAS' ? cidadeAppFiltro : cidadeBusca;
    return resolveCoordinatesForLocation({
      cidade: activeCity,
      estado: estadoBusca,
      bairro: bairroBusca
    });
  }, [gpsCoords, cidadeBusca, estadoBusca, bairroBusca, cidadeAppFiltro]);

  // Filtra os instrutores conforme o raio (5km a 40km) e os filtros escolhidos pelo aluno
  const locatedInstructors: LocatedInstructorResult[] = useMemo(() => {
    return filterInstructorsForStudentMap(allCandidates, {
      referenceCoords,
      maxDistanceKm: clampRadiusKm(radiusKm),
      cidadeFiltro: cidadeAppFiltro,
      categoriaFiltro,
      tipoVeiculoFiltro,
      tipoCambioFiltro
    });
  }, [
    allCandidates,
    referenceCoords,
    radiusKm,
    cidadeAppFiltro,
    categoriaFiltro,
    tipoVeiculoFiltro,
    tipoCambioFiltro
  ]);

  // Pinos para o Mapa Interativo (No modo público do aluno, exibe estritamente instrutores!)
  const mapPins: GeoMapPin[] = useMemo(() => {
    return locatedInstructors.map((item) => ({
      id: item.instructor.id,
      latitude: item.coverage.latitude ?? referenceCoords.latitude,
      longitude: item.coverage.longitude ?? referenceCoords.longitude,
      title: item.instructor.nome,
      subtitle: `${item.coverage.cidadeBase}/${item.coverage.estadoBase}${
        item.coverage.bairroBase ? ` · ${item.coverage.bairroBase}` : ''
      } · Atende até ${item.coverage.raioAtendimentoKm} km`,
      badgeText: `CNH ${item.coverage.categoriasAtendidas.join(', ')}`,
      distanceKm: item.distanceKm,
      type: 'INSTRUCTOR',
      meta: item
    }));
  }, [locatedInstructors, referenceCoords]);

  // Captura Geolocalização do navegador do aluno
  const handleUseBrowserGeolocation = () => {
    setGpsFeedback('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsFeedback('Geolocalização não suportada neste navegador. Informe sua cidade e bairro.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ latitude, longitude });
        const nearest = findNearestCityFromCoords(latitude, longitude);
        setCidadeBusca(nearest.cidade);
        setEstadoBusca(nearest.estado);
        setLeadCidade(nearest.cidade);
        setLeadEstado(nearest.estado);
        setCidadeAppFiltro('TODAS');
        setGpsLoading(false);
        setGpsFeedback(`Localização GPS obtida com sucesso (próximo a ${nearest.cidade}/${nearest.estado}).`);
      },
      () => {
        setGpsLoading(false);
        setGpsFeedback('Permissão de GPS não concedida. Selecione sua cidade e bairro abaixo.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Cadastro reverso do aluno que não localizou instrutor na sua região
  const handleRegisterStudentLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setLeadError('');

    if (!leadNome.trim() || leadNome.trim().length < 3) {
      setLeadError('Informe seu nome completo (mínimo 3 caracteres).');
      return;
    }

    const phoneDigits = cleanPhoneDigits(leadTelefone);
    if (!phoneDigits || !isValidPhone(phoneDigits)) {
      setLeadError('O número de WhatsApp com DDD válido é obrigatório (Ex: (11) 98765-4321).');
      return;
    }

    if (!leadCidade.trim() || !leadEstado.trim()) {
      setLeadError('Informe a Cidade e o Estado (UF) onde você procura instrutor.');
      return;
    }

    setLeadSaving(true);
    try {
      const targetCoords = resolveCoordinatesForLocation({
        cidade: leadCidade.trim(),
        estado: leadEstado.trim().toUpperCase(),
        bairro: leadBairro.trim()
      });

      const cityKey = normalizeTextKey(leadCidade);
      const anyInstructorInCity = allCandidates.some(
        ({ coverage }) =>
          normalizeTextKey(coverage.cidadeBase) === cityKey ||
          coverage.cidadesAtendidas.some((c) => normalizeTextKey(c) === cityKey)
      );

      const newLead: StudentLeadRequest = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nome: leadNome.trim(),
        telefone: formatPhone(phoneDigits),
        email: leadEmail.trim() || undefined,
        estado: leadEstado.trim().toUpperCase(),
        cidade: leadCidade.trim(),
        bairro: leadBairro.trim() || 'Centro',
        categoriaCnh: leadCategoria,
        tipoVeiculo: leadTipoVeiculo,
        tipoCambio: leadTipoCambio,
        raioDesejadoKm: clampRadiusKm(radiusKm),
        observacoes:
          leadObservacoes.trim() ||
          `Aluno procurando instrutor em ${leadCidade.trim()}/${leadEstado.trim().toUpperCase()} (Raio ${radiusKm} km).`,
        latitude: targetCoords.latitude,
        longitude: targetCoords.longitude,
        semInstrutorNaCidade: !anyInstructorInCity || locatedInstructors.length === 0,
        status: 'AGUARDANDO_INSTRUTOR',
        criadoEm: new Date().toISOString()
      };

      await db.createStudentLeadAsync(newLead);
      setLeadSuccess(true);
      setLeadSaving(false);
    } catch (err: any) {
      setLeadError('Erro ao registrar solicitação: ' + (err?.message || 'Tente novamente.'));
      setLeadSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-6xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-cyan-400 border border-blue-500/30 rounded-2xl">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-extrabold text-white">
                  Localizar Instrutor Credenciado por Geolocalização
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold uppercase">
                  Busca Inteligente 5 km a 40 km
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Encontre instrutores próximos ao seu endereço, filtre por categoria, câmbio e veículo ou fale direto no WhatsApp.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo Principal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* Painel de Filtros e Geolocalização */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="font-bold text-slate-900 text-xs">
                  1. Defina sua Localização (GPS ou Cidade/Bairro) e o Raio de Distância (5 km a 40 km)
                </span>
              </div>

              <button
                type="button"
                onClick={handleUseBrowserGeolocation}
                disabled={gpsLoading}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
              >
                {gpsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Navigation className="w-3.5 h-3.5" />
                )}
                <span>Usar Minha Geolocalização Atual (GPS)</span>
              </button>
            </div>

            {gpsFeedback && (
              <div className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <Compass className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{gpsFeedback}</span>
              </div>
            )}

            {/* Linha 1 de Controles: Cidade do App, Cidade/Bairro manual e Slider de Raio 5km-40km */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cidades Cadastradas no App
                </label>
                <select
                  value={cidadeAppFiltro}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCidadeAppFiltro(val);
                    setGpsCoords(null);
                    if (val !== 'TODAS') {
                      setCidadeBusca(val);
                      setLeadCidade(val);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">-- Todas as Cidades no Raio --</option>
                  {appRegisteredCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sua Cidade / Município (UF)
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={cidadeBusca}
                    onChange={(e) => {
                      setCidadeBusca(e.target.value);
                      setLeadCidade(e.target.value);
                      setCidadeAppFiltro('TODAS');
                      setGpsCoords(null);
                    }}
                    placeholder="Ex: Belo Horizonte, São Paulo..."
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-blue-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    maxLength={2}
                    value={estadoBusca}
                    onChange={(e) => {
                      setEstadoBusca(e.target.value.toUpperCase());
                      setLeadEstado(e.target.value.toUpperCase());
                    }}
                    placeholder="UF"
                    className="w-14 px-2 py-2 border border-slate-300 rounded-xl bg-white text-center font-mono uppercase text-xs focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Seu Bairro / Região
                </label>
                <input
                  type="text"
                  value={bairroBusca}
                  onChange={(e) => {
                    setBairroBusca(e.target.value);
                    setLeadBairro(e.target.value);
                    setGpsCoords(null);
                  }}
                  placeholder="Ex: Centro, Savassi, Pampulha..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Barra Deslizante de Distância: 5 km até 40 km */}
              <div className="bg-white p-2.5 rounded-xl border border-blue-200 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-800 text-[11px]">Distância da Busca:</span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono font-extrabold text-xs">
                    Até {radiusKm} km
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(clampRadiusKm(Number(e.target.value)))}
                  aria-label="Raio de distância em quilômetros (5 a 40 km)"
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-0.5">
                  <span>5 km</span>
                  <span>15 km</span>
                  <span>25 km</span>
                  <span>40 km</span>
                </div>
              </div>
            </div>

            {/* Linha 2 de Filtros: Categoria CNH, Tipo de Veículo e Tipo de Câmbio */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Filtro por Categoria CNH
                </label>
                <select
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value as CnhCategory | 'TODAS')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">Todas as Categorias (A, B, AB, C, D, E...)</option>
                  {CNH_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tipo de Veículo
                </label>
                <select
                  value={tipoVeiculoFiltro}
                  onChange={(e) => setTipoVeiculoFiltro(e.target.value as LocatorVehicleType | 'TODOS')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Todos os Veículos (Moto, Carro, Caminhão, Ônibus)</option>
                  <option value="MOTO">🏍️ Moto / Motocicleta</option>
                  <option value="CARRO">🚗 Carro / Automóvel</option>
                  <option value="CAMINHAO">🚚 Caminhão / Carga</option>
                  <option value="ONIBUS">🚌 Ônibus / Micro-ônibus / Van</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Tipo de Câmbio (Carro Manual / Automático)
                </label>
                <select
                  value={tipoCambioFiltro}
                  onChange={(e) => setTipoCambioFiltro(e.target.value as VehicleTransmissionType | 'TODOS')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="TODOS">Manual ou Automático (Todos)</option>
                  <option value="MANUAL">⚙️ Câmbio Manual</option>
                  <option value="AUTOMATICO">🅰️ Câmbio Automático</option>
                  <option value="AMBOS">🔄 Ambos (Manual e Automático)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Grid Principal: Mapa à Esquerda + Lista de Instrutores e Contato WhatsApp à Direita */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Coluna do Mapa (7 colunas) */}
            <div className="lg:col-span-7 space-y-2">
              <InteractiveGeoMap
                centerLat={referenceCoords.latitude}
                centerLon={referenceCoords.longitude}
                radiusKm={radiusKm}
                pins={mapPins}
                selectedPinId={selectedPinId}
                onSelectPin={(pin) => setSelectedPinId(pin.id)}
                mode="PUBLIC_STUDENT"
              />
            </div>

            {/* Coluna da Lista de Instrutores Encontrados (5 colunas) */}
            <div className="lg:col-span-5 flex flex-col bg-slate-50 border border-slate-200 rounded-2xl p-3.5 max-h-[460px] overflow-y-auto space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>Instrutores Encontrados no Raio ({locatedInstructors.length})</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Raio de {radiusKm} km a partir de {referenceCoords.cidade}/{referenceCoords.estado}
                  </p>
                </div>
                {syncing && (
                  <span className="text-[11px] text-blue-600 font-semibold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Atualizando...
                  </span>
                )}
              </div>

              {locatedInstructors.length > 0 ? (
                <div className="space-y-2.5">
                  {locatedInstructors.map((item) => {
                    const isSelected = selectedPinId === item.instructor.id;
                    const whatsMsg = `Olá instrutor(a) ${item.instructor.nome}! Localizei seu perfil no mapa do Gestão AD (${item.coverage.cidadeBase}/${item.coverage.estadoBase}) e gostaria de informações sobre as aulas práticas.`;
                    const whatsUrl = buildWhatsAppLink(item.instructor.telefone, whatsMsg);

                    return (
                      <div
                        key={item.instructor.id}
                        onClick={() => setSelectedPinId(item.instructor.id)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2.5 ${
                          isSelected
                            ? 'bg-emerald-50/70 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-blue-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs block">
                              {item.instructor.nome}
                            </span>
                            <span className="text-[11px] text-slate-600 block">
                              📍 {item.coverage.cidadeBase}/{item.coverage.estadoBase}
                              {item.coverage.bairroBase ? ` · ${item.coverage.bairroBase}` : ''}
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold text-[11px] shrink-0">
                            {item.distanceKm} km
                          </span>
                        </div>

                        {/* Badges de Categoria, Veículo, Câmbio e Raio */}
                        <div className="flex flex-wrap gap-1">
                          <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono text-[10px] font-bold">
                            CNH {item.coverage.categoriasAtendidas.join(', ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                            Câmbio: {item.coverage.tipoCambio === 'AMBOS' ? 'Manual e Automático' : item.coverage.tipoCambio}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-semibold">
                            Veículos: {item.coverage.tiposVeiculo.join(', ')}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                            Atende até {item.coverage.raioAtendimentoKm} km
                          </span>
                        </div>

                        {item.coverage.cidadesAtendidas.length > 0 && (
                          <p className="text-[11px] text-slate-600">
                            <strong>Cidades atendidas:</strong> {item.coverage.cidadesAtendidas.join(', ')}
                          </p>
                        )}

                        {/* Botões de Ação: WhatsApp e Selecionar para Matrícula */}
                        <div className="flex flex-col sm:flex-row gap-2 pt-1">
                          {whatsUrl ? (
                            <a
                              href={whatsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Chamar no WhatsApp</span>
                            </a>
                          ) : (
                            <span className="flex-1 py-2 px-3 bg-slate-100 text-slate-400 rounded-xl font-semibold text-xs text-center">
                              WhatsApp Indisponível
                            </span>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectInstructor(item.instructor, item.instructorCode);
                            }}
                            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Ver Planos / Matricular</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-950 space-y-2.5 text-center">
                  <AlertCircle className="w-7 h-7 text-amber-600 mx-auto" />
                  <div className="space-y-1">
                    <p className="font-bold text-xs text-amber-900">
                      Nenhum instrutor localizado num raio de {radiusKm} km com estes filtros.
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Você pode aumentar a barra de distância (até 40 km) ou registrar seu interesse abaixo para que os instrutores da plataforma entrem em contato com você pelo WhatsApp!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(true)}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                  >
                    📢 Sinalizar que Procuro Instrutor na Minha Região
                  </button>
                </div>
              )}

              {/* Atalho Permanente para Demanda Reversa */}
              <div className="pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowLeadForm(!showLeadForm)}
                  className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>
                    {showLeadForm
                      ? 'Ocultar Formulário de Procura de Instrutor'
                      : 'Não encontrou instrutor na sua cidade/bairro? Cadastre seu alerta aqui!'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Seção de Cadastro de Demanda Reversa (Aluno à Procura de Instrutor) */}
          {(showLeadForm || locatedInstructors.length === 0) && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-indigo-200 rounded-2xl space-y-3.5 animate-in fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Procurando Instrutor na sua Área? Deixe seu Contato para Atendimento!</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Ao registrar sua solicitação, o sistema notificará imediatamente os instrutores na seção de <strong>Mensagens e Notificações</strong> para que entrem em contato com você via WhatsApp.
                  </p>
                </div>
              </div>

              {leadSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-xs block text-emerald-900">
                        Solicitação registrada e enviada aos instrutores com sucesso!
                      </span>
                      <span className="text-xs text-emerald-800">
                        Os instrutores que atendem ou passarem a atender {leadCidade}/{leadEstado} receberam sua notificação e poderão chamar você no WhatsApp informado.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLeadSuccess(false)}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 rounded-xl font-bold text-xs cursor-pointer shrink-0"
                  >
                    Nova Solicitação
                  </button>
                </div>
              ) : (
                <form onSubmit={handleRegisterStudentLead} className="space-y-3">
                  {leadError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{leadError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Seu Nome Completo *</label>
                      <input
                        type="text"
                        required
                        value={leadNome}
                        onChange={(e) => setLeadNome(e.target.value)}
                        placeholder="Ex: Lucas Oliveira"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Seu WhatsApp com DDD *</label>
                      <input
                        type="tel"
                        required
                        value={leadTelefone}
                        onChange={(e) => setLeadTelefone(maskPhoneInput(e.target.value))}
                        placeholder="(11) 98765-4321"
                        maxLength={15}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono text-xs focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Cidade & UF Desejada *</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          required
                          value={leadCidade}
                          onChange={(e) => setLeadCidade(e.target.value)}
                          placeholder="Ex: Betim"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-indigo-600 focus:outline-none"
                        />
                        <input
                          type="text"
                          required
                          maxLength={2}
                          value={leadEstado}
                          onChange={(e) => setLeadEstado(e.target.value.toUpperCase())}
                          placeholder="UF"
                          className="w-14 px-2 py-2 border border-slate-300 rounded-xl bg-white text-center font-mono uppercase text-xs focus:border-indigo-600 focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Seu Bairro *</label>
                      <input
                        type="text"
                        required
                        value={leadBairro}
                        onChange={(e) => setLeadBairro(e.target.value)}
                        placeholder="Ex: Centro, Jardim..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-indigo-600 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Categoria CNH Pretendida</label>
                      <select
                        value={leadCategoria}
                        onChange={(e) => setLeadCategoria(e.target.value as CnhCategory)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-medium focus:border-indigo-600 focus:outline-none"
                      >
                        {CNH_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Tipo de Veículo</label>
                      <select
                        value={leadTipoVeiculo}
                        onChange={(e) => setLeadTipoVeiculo(e.target.value as LocatorVehicleType)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-medium focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="CARRO">Carro / Utilitário</option>
                        <option value="MOTO">Moto / Motocicleta</option>
                        <option value="CAMINHAO">Caminhão</option>
                        <option value="ONIBUS">Ônibus / Van</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Preferência de Câmbio</label>
                      <select
                        value={leadTipoCambio}
                        onChange={(e) => setLeadTipoCambio(e.target.value as VehicleTransmissionType)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-medium focus:border-indigo-600 focus:outline-none"
                      >
                        <option value="AMBOS">Manual ou Automático</option>
                        <option value="MANUAL">Somente Manual</option>
                        <option value="AUTOMATICO">Somente Automático</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Observações / Horário Preferido</label>
                      <input
                        type="text"
                        value={leadObservacoes}
                        onChange={(e) => setLeadObservacoes(e.target.value)}
                        placeholder="Ex: Prefiro aulas pela manhã ou sábado"
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-indigo-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={leadSaving}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {leadSaving
                          ? 'Registrando Solicitação...'
                          : 'Notificar Instrutores que Procuro Atendimento nesta Região'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
          <span className="text-slate-600 flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Privacidade Garantida: Ao escolher seu instrutor, o código dele é preenchido automaticamente no cadastro.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl font-bold cursor-pointer"
          >
            Fechar Mapa
          </button>
        </div>
      </div>
    </div>
  );
};
