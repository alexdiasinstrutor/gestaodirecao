import React, { useState, useEffect, useMemo } from 'react';
import {
  MapPin,
  Bell,
  Compass,
  Users,
  UserCheck,
  MessageCircle,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Navigation,
  Sparkles,
  Car,
  Save,
  Building2,
  Search,
  RefreshCw
} from 'lucide-react';
import {
  CNH_CATEGORIES,
  CnhCategory,
  InstructorCoverageProfile,
  LocatorVehicleType,
  Organization,
  StudentLeadRequest,
  User,
  VehicleTransmissionType
} from '../../types';
import { db, syncFromSupabase } from '../../lib/storage';
import {
  BRAZIL_CITIES_COORDS,
  buildEffectiveInstructorCoverage,
  clampRadiusKm,
  computeInstructorMarketOverview,
  findNearestCityFromCoords,
  normalizeTextKey,
  resolveCoordinatesForLocation
} from '../../lib/geoService';
import { InteractiveGeoMap, GeoMapPin } from '../common/InteractiveGeoMap';
import { buildWhatsAppLink } from '../../lib/whatsapp';

interface InstructorGeoDemandViewProps {
  currentUser: User;
  currentOrg: Organization;
}

export const InstructorGeoDemandView: React.FC<InstructorGeoDemandViewProps> = ({
  currentUser,
  currentOrg
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'MAPA_MERCADO' | 'NOTIFICACOES' | 'MINHA_COBERTURA'>('MAPA_MERCADO');
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Carrega cobertura atual do instrutor logado
  const initialCoverage = useMemo(() => {
    const saved = db.getInstructorCoverage(currentUser.id);
    const pkgs = db.getPackages(currentOrg.id, currentUser.id);
    const vehicles = db.getVehicles(currentOrg.id);
    return buildEffectiveInstructorCoverage({
      instructor: currentUser,
      organization: currentOrg,
      savedCoverage: saved,
      packages: pkgs,
      vehicles
    });
  }, [currentUser, currentOrg, dataVersion]);

  // Estado editável de configuração de área de atendimento do instrutor
  const [raioKm, setRaioKm] = useState<number>(initialCoverage.raioAtendimentoKm);
  const [cidadeBase, setCidadeBase] = useState<string>(initialCoverage.cidadeBase);
  const [estadoBase, setEstadoBase] = useState<string>(initialCoverage.estadoBase);
  const [bairroBase, setBairroBase] = useState<string>(initialCoverage.bairroBase || 'Centro');
  const [cidadesAtendidas, setCidadesAtendidas] = useState<string[]>(initialCoverage.cidadesAtendidas);
  const [novaCidadeInput, setNovaCidadeInput] = useState<string>('');
  const [categoriasAtendidas, setCategoriasAtendidas] = useState<CnhCategory[]>(
    initialCoverage.categoriasAtendidas
  );
  const [tiposVeiculo, setTiposVeiculo] = useState<LocatorVehicleType[]>(initialCoverage.tiposVeiculo);
  const [tipoCambio, setTipoCambio] = useState<VehicleTransmissionType>(initialCoverage.tipoCambio);
  const [customCoords, setCustomCoords] = useState<{ latitude?: number; longitude?: number }>({
    latitude: initialCoverage.latitude,
    longitude: initialCoverage.longitude
  });
  const [saveFeedback, setSaveFeedback] = useState<string>('');
  const [savingCoverage, setSavingCoverage] = useState<boolean>(false);

  // Filtros do Mapa Interno do Instrutor
  const [mapFilterCity, setMapFilterCity] = useState<string>('TODAS');
  const [mapFilterRadiusKm, setMapFilterRadiusKm] = useState<number>(40);
  const [mapShowStudents, setMapShowStudents] = useState<boolean>(true);
  const [mapShowLeads, setMapShowLeads] = useState<boolean>(true);
  const [mapShowInstructors, setMapShowInstructors] = useState<boolean>(true);
  const [selectedPinId, setSelectedPinId] = useState<string | undefined>(undefined);

  // Sincronização em tempo real ao acessar a tela
  useEffect(() => {
    let mounted = true;
    const handleSync = () => {
      if (mounted) setDataVersion((v) => v + 1);
    };
    window.addEventListener('agd:data-synced', handleSync);
    setSyncing(true);
    syncFromSupabase()
      .then(() => {
        if (mounted) setDataVersion((v) => v + 1);
      })
      .finally(() => {
        if (mounted) setSyncing(false);
      });
    return () => {
      mounted = false;
      window.removeEventListener('agd:data-synced', handleSync);
    };
  }, []);

  // Atualiza campos quando initialCoverage muda após sync
  useEffect(() => {
    setRaioKm(initialCoverage.raioAtendimentoKm);
    setCidadeBase(initialCoverage.cidadeBase);
    setEstadoBase(initialCoverage.estadoBase);
    setBairroBase(initialCoverage.bairroBase || 'Centro');
    setCidadesAtendidas(initialCoverage.cidadesAtendidas);
    setCategoriasAtendidas(initialCoverage.categoriasAtendidas);
    setTiposVeiculo(initialCoverage.tiposVeiculo);
    setTipoCambio(initialCoverage.tipoCambio);
  }, [initialCoverage.atualizadoEm]);

  // Panorama completo de Alunos (Matriculados + Procurando Instrutor) e Instrutores
  const marketOverview = useMemo(() => {
    const allInstructors = db.getAllInstructors();
    const allInstructorsWithCoverage = allInstructors.map((inst) => {
      const org = db.getOrganization(inst.organizacaoId);
      const saved = db.getInstructorCoverage(inst.id);
      const pkgs = db.getPackages(inst.organizacaoId, inst.id);
      const vehicles = db.getVehicles(inst.organizacaoId);
      return {
        instructor: inst,
        coverage: buildEffectiveInstructorCoverage({
          instructor: inst,
          organization: org,
          savedCoverage: saved,
          packages: pkgs,
          vehicles
        })
      };
    });

    const allOrgs = db.getOrganizations();
    const allStudents = allOrgs.flatMap((o) => db.getStudents(o.id));
    const allLeads = db.getStudentLeads();

    return computeInstructorMarketOverview({
      loggedInstructor: currentUser,
      loggedInstructorCoverage: initialCoverage,
      allInstructorsWithCoverage,
      allStudents,
      allStudentLeads: allLeads
    });
  }, [currentUser, initialCoverage, dataVersion]);

  // Lista de solicitações de alunos (Leads) para a aba "Mensagens e Notificações"
  const studentLeads = useMemo(() => {
    return db.getStudentLeads();
  }, [dataVersion]);

  const leadsWithoutInstructorsCount = useMemo(
    () =>
      marketOverview.studentPoints.filter(
        (sp) => sp.origem === 'PROCURANDO_INSTRUTOR' && sp.semInstrutorNaCidade
      ).length,
    [marketOverview]
  );

  // Pinos filtrados para o Mapa Interno do Instrutor
  const internalMapPins: GeoMapPin[] = useMemo(() => {
    const pins: GeoMapPin[] = [];
    const cityKey = mapFilterCity !== 'TODAS' ? normalizeTextKey(mapFilterCity) : '';

    if (mapShowLeads || mapShowStudents) {
      for (const sp of marketOverview.studentPoints) {
        if (sp.origem === 'PROCURANDO_INSTRUTOR' && !mapShowLeads) continue;
        if (sp.origem === 'ALUNO_MATRICULADO' && !mapShowStudents) continue;
        if (cityKey && normalizeTextKey(sp.cidade) !== cityKey) continue;
        if (sp.distanceToInstructorKm > mapFilterRadiusKm && !cityKey) continue;

        pins.push({
          id: `stu_pin_${sp.id}`,
          latitude: sp.latitude,
          longitude: sp.longitude,
          title: `${sp.nome} (${sp.origem === 'PROCURANDO_INSTRUTOR' ? 'Procurando Instrutor' : 'Aluno'})`,
          subtitle: `${sp.cidade}/${sp.estado} · Bairro: ${sp.bairro} · CNH ${sp.categoriaCnh} (${sp.tipoVeiculo})`,
          badgeText: sp.semInstrutorNaCidade ? 'Sem Instrutor na Cidade' : `CNH ${sp.categoriaCnh}`,
          distanceKm: sp.distanceToInstructorKm,
          type: sp.origem === 'PROCURANDO_INSTRUTOR' ? 'STUDENT_LEAD' : 'STUDENT_ACTIVE',
          meta: sp
        });
      }
    }

    if (mapShowInstructors) {
      for (const ip of marketOverview.instructorPoints) {
        if (cityKey && normalizeTextKey(ip.coverage.cidadeBase) !== cityKey) continue;
        if (ip.distanceToMeKm > mapFilterRadiusKm && !cityKey) continue;

        const cidadesExibidas =
          ip.coverage.cidadesAtendidas.length > 0
            ? ip.coverage.cidadesAtendidas.join(', ')
            : ip.coverage.cidadeBase;

        pins.push({
          id: `inst_pin_${ip.instructor.id}`,
          latitude: ip.latitude,
          longitude: ip.longitude,
          title: `${ip.instructor.nome}${ip.instructor.id === currentUser.id ? ' (Você)' : ''}`,
          subtitle: `${cidadesExibidas}/${ip.coverage.estadoBase} · Raio ${ip.coverage.raioAtendimentoKm} km`,
          badgeText: `Instrutor · CNH ${ip.coverage.categoriasAtendidas.join(',')}`,
          distanceKm: ip.distanceToMeKm,
          type: 'INSTRUCTOR',
          meta: ip
        });
      }
    }

    return pins;
  }, [
    marketOverview,
    mapFilterCity,
    mapFilterRadiusKm,
    mapShowStudents,
    mapShowLeads,
    mapShowInstructors,
    currentUser.id
  ]);

  // Salvar configuração de área de atendimento do instrutor
  const handleSaveCoverage = async (e?: React.FormEvent, overrideCities?: string[]) => {
    if (e) e.preventDefault();
    setSavingCoverage(true);
    setSaveFeedback('');

    try {
      const targetCities = overrideCities || cidadesAtendidas;
      const ensuredCities = Array.from(
        new Set([cidadeBase.trim(), ...targetCities.map((c) => c.trim())].filter(Boolean))
      );
      const resolved = resolveCoordinatesForLocation({
        cidade: cidadeBase.trim(),
        estado: estadoBase.trim().toUpperCase(),
        bairro: bairroBase.trim(),
        latitude: customCoords.latitude,
        longitude: customCoords.longitude
      });

      const updatedProfile: InstructorCoverageProfile = {
        instrutorId: currentUser.id,
        organizacaoId: currentOrg.id,
        raioAtendimentoKm: clampRadiusKm(raioKm),
        cidadeBase: resolved.cidade,
        estadoBase: resolved.estado,
        bairroBase: bairroBase.trim() || 'Centro',
        cidadesAtendidas: ensuredCities,
        categoriasAtendidas: categoriasAtendidas.length > 0 ? categoriasAtendidas : ['B'],
        tiposVeiculo: tiposVeiculo.length > 0 ? tiposVeiculo : ['CARRO'],
        tipoCambio,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        atualizadoEm: new Date().toISOString()
      };

      await db.saveInstructorCoverageAsync(updatedProfile);
      setCidadesAtendidas(ensuredCities);
      setDataVersion((v) => v + 1);
      setSaveFeedback(
        `Área de atendimento salva e sincronizada! Raio: ${updatedProfile.raioAtendimentoKm} km · ${ensuredCities.length} cidade(s) atendida(s).`
      );
    } finally {
      setSavingCoverage(false);
    }
  };

  const handleAddCityToCoverage = async (cityToAdd: string) => {
    const clean = cityToAdd.trim();
    if (!clean) return;
    const exists = cidadesAtendidas.some((c) => normalizeTextKey(c) === normalizeTextKey(clean));
    if (exists) {
      setNovaCidadeInput('');
      return;
    }
    const nextCities = [...cidadesAtendidas, clean];
    setCidadesAtendidas(nextCities);
    setNovaCidadeInput('');
    await handleSaveCoverage(undefined, nextCities);
  };

  const handleRemoveCityFromCoverage = async (cityToRemove: string) => {
    const nextCities = cidadesAtendidas.filter(
      (c) => normalizeTextKey(c) !== normalizeTextKey(cityToRemove)
    );
    setCidadesAtendidas(nextCities);
    await handleSaveCoverage(undefined, nextCities);
  };

  const handleUseMyGPS = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nearest = findNearestCityFromCoords(pos.coords.latitude, pos.coords.longitude);
        setCidadeBase(nearest.cidade);
        setEstadoBase(nearest.estado);
        setCustomCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setSaveFeedback(`GPS capturado: ${nearest.cidade}/${nearest.estado}. Clique em Salvar para confirmar.`);
      },
      () => {
        setSaveFeedback('Informe sua cidade e bairro manualmente abaixo.');
      }
    );
  };

  return (
    <div className="space-y-4">
      {/* Banner Topo: Mapa de Demanda, Alunos & Área de Atendimento */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-4 sm:p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-bold uppercase">
                Exclusivo para Instrutores Logados
              </span>
              {leadsWithoutInstructorsCount > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center gap-1 animate-pulse">
                  <Bell className="w-3 h-3" />
                  <span>{leadsWithoutInstructorsCount} aluno(s) procurando instrutor em cidades sem atendimento!</span>
                </span>
              )}
            </div>
            <h1 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400 shrink-0" />
              <span>Mapa de Alunos, Cidades Atendidas (5–40 km) & Notificações de Demanda</span>
            </h1>
            <p className="text-xs text-slate-300 max-w-3xl">
              Visualize quantos alunos e instrutores existem em cada cidade e bairro, veja a distância até o seu cadastro, configure seu raio de atendimento (5 km a 40 km) e chame alunos à procura de instrutor diretamente pelo WhatsApp.
            </p>
          </div>

          {/* Seletor de Sub-Abas */}
          <div className="flex flex-wrap gap-1.5 bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700 shrink-0">
            <button
              type="button"
              onClick={() => setActiveSubTab('MAPA_MERCADO')}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'MAPA_MERCADO'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mapa de Alunos & Instrutores</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('NOTIFICACOES')}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'NOTIFICACOES'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Mensagens & Notificações ({studentLeads.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('MINHA_COBERTURA')}
              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeSubTab === 'MINHA_COBERTURA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Minha Área & Cidades ({raioKm} km)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Indicadores Rápidos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 block">Total de Alunos Mapeados</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">
            {marketOverview.studentPoints.length}
          </span>
          <span className="text-[11px] text-blue-600 font-semibold">
            {marketOverview.studentPoints.filter((s) => s.origem === 'PROCURANDO_INSTRUTOR').length} procurando instrutor
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold text-slate-500 block">Instrutores Cadastrados</span>
          <span className="text-xl font-black text-slate-900 mt-0.5 block">
            {marketOverview.instructorPoints.length}
          </span>
          <span className="text-[11px] text-emerald-700 font-semibold">
            Em {marketOverview.citySummaries.filter((c) => c.totalInstrutores > 0).length} cidade(s)
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-amber-200 shadow-2xs">
          <span className="text-[11px] font-bold text-amber-800 block">Cidades sem Instrutor</span>
          <span className="text-xl font-black text-amber-600 mt-0.5 block">
            {marketOverview.citiesWithoutInstructors.length}
          </span>
          <span className="text-[11px] text-amber-700 font-semibold">
            Oportunidades imediatas de atendimento
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-2xs">
          <span className="text-[11px] font-bold text-emerald-800 block">Seu Raio de Atendimento</span>
          <span className="text-xl font-black text-emerald-700 mt-0.5 block">
            {initialCoverage.raioAtendimentoKm} km
          </span>
          <span className="text-[11px] text-slate-600 truncate block">
            Base: {initialCoverage.cidadeBase}/{initialCoverage.estadoBase} ({initialCoverage.cidadesAtendidas.length} cidades)
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-ABA 1: MAPA INTERNO DE ALUNOS & INSTRUTORES (EXCLUSIVO LOGADO) */}
      {/* ===================================================================== */}
      {activeSubTab === 'MAPA_MERCADO' && (
        <div className="space-y-4">
          {/* Barra de Filtros do Mapa do Instrutor */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Filtrar Mapa por Cidade</label>
                <select
                  value={mapFilterCity}
                  onChange={(e) => setMapFilterCity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  <option value="TODAS">-- Todas as Cidades no Raio --</option>
                  {marketOverview.citySummaries.map((cs) => (
                    <option key={`${cs.cidade}_${cs.estado}`} value={cs.cidade}>
                      {cs.cidade}/{cs.estado} ({cs.totalAlunos} alunos · {cs.totalInstrutores} instrutores)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-bold text-slate-700">Distância até Você:</span>
                  <span className="font-mono font-bold text-blue-700">Até {mapFilterRadiusKm} km</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={40}
                  step={1}
                  value={mapFilterRadiusKm}
                  onChange={(e) => setMapFilterRadiusKm(clampRadiusKm(Number(e.target.value)))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>5 km</span>
                  <span>20 km</span>
                  <span>40 km</span>
                </div>
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-2 sm:pt-4">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapShowLeads}
                    onChange={(e) => setMapShowLeads(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Alunos Procurando Instrutor</span>
                </label>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapShowStudents}
                    onChange={(e) => setMapShowStudents(e.target.checked)}
                    className="rounded text-indigo-600"
                  />
                  <span>Alunos Matriculados</span>
                </label>

                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mapShowInstructors}
                    onChange={(e) => setMapShowInstructors(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span>Instrutores Cadastrados</span>
                </label>
              </div>
            </div>
          </div>

          {/* Grid: Mapa Interativo + Resumo por Cidades, Bairros e Distâncias */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            <div className="lg:col-span-7">
              <InteractiveGeoMap
                centerLat={initialCoverage.latitude ?? -19.9167}
                centerLon={initialCoverage.longitude ?? -43.9345}
                radiusKm={mapFilterRadiusKm}
                pins={internalMapPins}
                selectedPinId={selectedPinId}
                onSelectPin={(pin) => setSelectedPinId(pin.id)}
                mode="INTERNAL_INSTRUCTOR"
              />
            </div>

            {/* Painel Lateral: Quantidade de Alunos e Instrutores por Cidade, Bairro e Distância */}
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 max-h-[460px] overflow-y-auto space-y-3 text-xs">
              <div className="border-b border-slate-200 pb-2.5">
                <h3 className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Panorama por Cidade, Bairros e Distância até Você</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Veja quantos alunos e instrutores existem em cada região e adicione cidades à sua rota.
                </p>
              </div>

              {marketOverview.citySummaries.map((city) => {
                const isAttendedByMe = initialCoverage.cidadesAtendidas.some(
                  (c) => normalizeTextKey(c) === normalizeTextKey(city.cidade)
                );

                return (
                  <div
                    key={`${city.cidade}_${city.estado}`}
                    className={`p-3 rounded-2xl border space-y-2 ${
                      city.semInstrutor && city.totalAlunos > 0
                        ? 'bg-amber-50/70 border-amber-300'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                          <span>
                            {city.cidade} / {city.estado}
                          </span>
                          {city.semInstrutor && city.totalAlunos > 0 && (
                            <span className="px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold">
                              Sem Instrutor!
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-slate-600 block">
                          Bairros: {city.bairros.length > 0 ? city.bairros.join(', ') : 'Centro'}
                        </span>
                      </div>

                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold text-[10px] shrink-0">
                        distância: {city.distanciaMediaKm} km
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-white p-1.5 rounded-xl border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Total Alunos</span>
                        <span className="font-extrabold text-slate-900 text-xs">{city.totalAlunos}</span>
                      </div>
                      <div className="bg-white p-1.5 rounded-xl border border-amber-200">
                        <span className="text-[10px] text-amber-800 block">Procurando</span>
                        <span className="font-extrabold text-amber-700 text-xs">
                          {city.totalAlunosProcurando}
                        </span>
                      </div>
                      <div className="bg-white p-1.5 rounded-xl border border-emerald-200">
                        <span className="text-[10px] text-emerald-800 block">Instrutores</span>
                        <span className="font-extrabold text-emerald-700 text-xs">
                          {city.totalInstrutores}
                        </span>
                      </div>
                    </div>

                    {!isAttendedByMe ? (
                      <button
                        type="button"
                        onClick={() => handleAddCityToCoverage(city.cidade)}
                        className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Passar a Atender {city.cidade}</span>
                      </button>
                    ) : (
                      <span className="block text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-1">
                        ✓ Cidade já incluída na sua área de atendimento
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-ABA 2: SESSÃO MENSAGENS E NOTIFICAÇÕES (DEMANDA REVERSA DE ALUNOS) */}
      {/* ===================================================================== */}
      {activeSubTab === 'NOTIFICACOES' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span>Mensagens e Notificações — Alunos à Procura de Instrutor</span>
              </h2>
              <p className="text-xs text-slate-600">
                 O sistema notifica aqui todos os alunos que se cadastraram procurando atendimento (especialmente em cidades que ainda não possuem instrutor). Selecione um aluno para encaminhar uma mensagem via WhatsApp!
              </p>
            </div>
          </div>

          {studentLeads.length === 0 ? (
            <div className="p-8 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-2">
              <Sparkles className="w-8 h-8 text-blue-500 mx-auto" />
              <p className="font-bold text-slate-900 text-sm">
                Nenhuma solicitação de aluno pendente no momento
              </p>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Assim que um aluno acessar o mapa público e sinalizar que está procurando um instrutor na cidade/bairro dele, você receberá o alerta aqui com o botão direto para o WhatsApp dele.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {studentLeads.map((lead) => {
                const pointInfo = marketOverview.studentPoints.find((p) => p.id === lead.id);
                const distanceKm = pointInfo?.distanceToInstructorKm ?? 0;
                const isAttendedCity = initialCoverage.cidadesAtendidas.some(
                  (c) => normalizeTextKey(c) === normalizeTextKey(lead.cidade)
                );

                const whatsText = `Olá ${lead.nome}! Sou o(a) instrutor(a) ${currentUser.nome}, credenciado(a) na plataforma Gestão AD. Vi sua notificação procurando aulas práticas (CNH ${lead.categoriaCnh} - ${lead.tipoVeiculo}) em ${lead.cidade}/${lead.estado} e posso atender você! Vamos conversar?`;
                const whatsLink = buildWhatsAppLink(lead.telefone, whatsText);

                return (
                  <div
                    key={lead.id}
                    className={`p-4 rounded-2xl border space-y-3 transition-all ${
                      lead.semInstrutorNaCidade
                        ? 'bg-amber-50/60 border-amber-300 shadow-xs'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-slate-900 text-sm">{lead.nome}</span>
                          {lead.semInstrutorNaCidade && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-extrabold text-[10px]">
                              ⚠️ Cidade sem Instrutor
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold text-[10px]">
                            a {distanceKm} km de você
                          </span>
                        </div>
                        <span className="text-xs text-slate-600 block mt-0.5">
                          📍 <strong>{lead.cidade}/{lead.estado}</strong> · Bairro: {lead.bairro || 'Centro'}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                          lead.status === 'AGUARDANDO_INSTRUTOR'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {lead.status === 'AGUARDANDO_INSTRUTOR' ? 'Aguardando Contato' : 'Em Contato'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                        CNH {lead.categoriaCnh}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-semibold">
                        Veículo: {lead.tipoVeiculo}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-semibold">
                        Câmbio: {lead.tipoCambio}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                        WhatsApp: {lead.telefone}
                      </span>
                    </div>

                    {lead.observacoes && (
                      <p className="text-xs text-slate-700 bg-white/80 p-2.5 rounded-xl border border-slate-200/80">
                        “{lead.observacoes}”
                      </p>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {whatsLink && (
                        <a
                          href={whatsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            db.updateStudentLeadStatusAsync(lead.id, 'EM_CONTATO', currentUser);
                            setDataVersion((v) => v + 1);
                          }}
                          className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Atender Aluno via WhatsApp</span>
                        </a>
                      )}

                      {!isAttendedCity && (
                        <button
                          type="button"
                          onClick={() => handleAddCityToCoverage(lead.cidade)}
                          className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Atender {lead.cidade}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-ABA 3: CONFIGURAR MINHA ÁREA DE ATENDIMENTO (5 A 40 KM & CIDADES) */}
      {/* ===================================================================== */}
      {activeSubTab === 'MINHA_COBERTURA' && (
        <form
          onSubmit={(e) => handleSaveCoverage(e)}
          className="bg-white rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-2xs space-y-5 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                <span>Configuração da Minha Área de Atendimento (5 km a 40 km) & Cidades</span>
              </h2>
              <p className="text-xs text-slate-600">
                Defina até quantos quilômetros do seu endereço/cidade você atende, cadastre as cidades atendidas e informe os tipos de câmbio e veículos disponíveis para o filtro dos alunos.
              </p>
            </div>

            <button
              type="button"
              onClick={handleUseMyGPS}
              className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Capturar Minha Posição GPS</span>
            </button>
          </div>

          {saveFeedback && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{saveFeedback}</span>
            </div>
          )}

          {/* Endereço Base e Raio de 5 km a 40 km */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Sua Cidade Base *</label>
              <input
                type="text"
                required
                value={cidadeBase}
                onChange={(e) => {
                  setCidadeBase(e.target.value);
                  setCustomCoords({});
                }}
                placeholder="Ex: Belo Horizonte"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Estado (UF) *</label>
              <input
                type="text"
                required
                maxLength={2}
                value={estadoBase}
                onChange={(e) => {
                  setEstadoBase(e.target.value.toUpperCase());
                  setCustomCoords({});
                }}
                placeholder="MG"
                className="w-full px-3 py-2 border border-slate-300 rounded-xl font-mono uppercase focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Seu Bairro Base *</label>
              <input
                type="text"
                required
                value={bairroBase}
                onChange={(e) => {
                  setBairroBase(e.target.value);
                  setCustomCoords({});
                }}
                placeholder="Ex: Centro, Pampulha..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-slate-800">Raio que Você Atende:</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-mono font-extrabold text-xs">
                  {raioKm} km
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={40}
                step={1}
                value={raioKm}
                onChange={(e) => setRaioKm(clampRadiusKm(Number(e.target.value)))}
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

          {/* Cidades que o Instrutor Atende */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
            <label className="block font-extrabold text-slate-900">
              Cidades que Você Atende (aparecerão na busca por cidade e no mapa dos alunos)
            </label>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={novaCidadeInput}
                onChange={(e) => setNovaCidadeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCityToCoverage(novaCidadeInput);
                  }
                }}
                placeholder="Digite o nome de uma cidade que você deseja atender (Ex: Contagem, Betim, Guarulhos...)"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleAddCityToCoverage(novaCidadeInput)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar Cidade</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {cidadesAtendidas.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-xs shadow-2xs"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{city}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCityFromCoverage(city)}
                    className="text-slate-400 hover:text-red-600 ml-1 cursor-pointer"
                    title={`Remover ${city}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Câmbio, Tipos de Veículo e Categorias CNH para o Filtro do Mapa */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-extrabold text-slate-900">
                Tipo de Câmbio dos seus Veículos
              </label>
              <select
                value={tipoCambio}
                onChange={(e) => setTipoCambio(e.target.value as VehicleTransmissionType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold text-xs focus:border-blue-600 focus:outline-none"
              >
                <option value="AMBOS">Manual e Automático (Ambos)</option>
                <option value="MANUAL">Somente Câmbio Manual</option>
                <option value="AUTOMATICO">Somente Câmbio Automático</option>
              </select>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-extrabold text-slate-900">
                Tipos de Veículos que Você Ministra Aula
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['MOTO', 'CARRO', 'CAMINHAO', 'ONIBUS'] as LocatorVehicleType[]).map((tv) => {
                  const checked = tiposVeiculo.includes(tv);
                  return (
                    <label
                      key={tv}
                      className={`flex items-center gap-1.5 p-2 rounded-xl border font-bold cursor-pointer ${
                        checked
                          ? 'bg-blue-50 border-blue-400 text-blue-900'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setTiposVeiculo((prev) => Array.from(new Set([...prev, tv])));
                          } else {
                            setTiposVeiculo((prev) => prev.filter((item) => item !== tv));
                          }
                        }}
                      />
                      <span>{tv}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
              <label className="block font-extrabold text-slate-900">
                Categorias CNH Atendidas
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['A', 'B', 'AB', 'C', 'D', 'E', 'ACC', 'PCD'] as CnhCategory[]).map((cat) => {
                  const active = categoriasAtendidas.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setCategoriasAtendidas((prev) => prev.filter((c) => c !== cat));
                        } else {
                          setCategoriasAtendidas((prev) => [...prev, cat]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded-lg font-mono font-bold text-xs cursor-pointer border transition-colors ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      CNH {cat}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={savingCoverage}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>
                {savingCoverage
                  ? 'Salvando e Sincronizando...'
                  : 'Salvar Minha Área de Atendimento (5 a 40 km) e Cidades'}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
