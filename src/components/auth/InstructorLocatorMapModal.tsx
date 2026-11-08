import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  MapPin,
  Navigation,
  Search,
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
import {
  ESTADOS_BRASIL,
  formatCEP,
  isValidCEPFormat,
  lookupAddressByCEP
} from '../../lib/cepService';
import { InteractiveGeoMap, GeoMapPin } from '../common/InteractiveGeoMap';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { cleanPhoneDigits, formatPhone, isValidPhone, maskPhoneInput } from '../../lib/validation';

interface InstructorLocatorMapModalProps {
  onClose: () => void;
  onSelectInstructor?: (instructor: User, code: string) => void;
}

export const InstructorLocatorMapModal: React.FC<InstructorLocatorMapModalProps> = ({
  onClose
}) => {
  const [syncing, setSyncing] = useState<boolean>(true);
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Estado e Cidade detectados da localização da pessoa (GPS ou CEP digitado)
  const [detectedUserState, setDetectedUserState] = useState<string>('MG');
  const [detectedUserCity, setDetectedUserCity] = useState<string>('Betim');

  // Seleção de Estado primeiro (1º Passo) + CEP de auto-preenchimento + Cidade e Bairro
  const [estadoBusca, setEstadoBusca] = useState<string>('MG');
  const [cepBusca, setCepBusca] = useState<string>('');
  const [cepLoading, setCepLoading] = useState<boolean>(false);
  const [cepFeedback, setCepFeedback] = useState<string>('');
  const [cidadeBusca, setCidadeBusca] = useState<string>('Betim');
  const [bairroBusca, setBairroBusca] = useState<string>('');
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [gpsFeedback, setGpsFeedback] = useState<string>('');

  // Filtros do Mapa (Raio 5 a 40 km, Cidade listada, Categoria, Tipo de Veículo, Câmbio)
  const [radiusKm, setRadiusKm] = useState<number>(20);
  const [cidadeAppFiltro, setCidadeAppFiltro] = useState<string>('TODAS');
  const [categoriaFiltro, setCategoriaFiltro] = useState<CnhCategory | 'TODAS'>('TODAS');
  const [tipoVeiculoFiltro, setTipoVeiculoFiltro] = useState<LocatorVehicleType | 'TODOS'>('TODOS');
  const [tipoCambioFiltro, setTipoCambioFiltro] = useState<VehicleTransmissionType | 'TODOS'>('TODOS');

  const [selectedPinId, setSelectedPinId] = useState<string | undefined>(undefined);

  // Formulário de Lista de Alunos em Busca de Instrutores (com auto-preenchimento por CEP)
  const [showLeadForm, setShowLeadForm] = useState<boolean>(false);
  const [leadNome, setLeadNome] = useState<string>('');
  const [leadTelefone, setLeadTelefone] = useState<string>('');
  const [leadEmail, setLeadEmail] = useState<string>('');
  const [leadCep, setLeadCep] = useState<string>('');
  const [leadCepLoading, setLeadCepLoading] = useState<boolean>(false);
  const [leadEstado, setLeadEstado] = useState<string>('MG');
  const [leadCidade, setLeadCidade] = useState<string>('Betim');
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
          const initialCity = cov?.cidadeBase || firstInst.cidade || org?.cidade || 'Betim';
          const initialState = (cov?.estadoBase || firstInst.estado || org?.estado || 'MG').toUpperCase();
          setDetectedUserState(initialState);
          setDetectedUserCity(initialCity);
          setEstadoBusca(initialState);
          setCidadeBusca(initialCity);
          setLeadEstado(initialState);
          setLeadCidade(initialCity);
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

  // Verifica se o Estado selecionado é diferente do Estado da localização/CEP atual da pessoa
  const isSearchingDifferentState = useMemo(() => {
    return normalizeTextKey(estadoBusca) !== normalizeTextKey(detectedUserState);
  }, [estadoBusca, detectedUserState]);

  // Cidades que possuem instrutores cadastrados no Estado (UF) selecionado
  const cidadesComInstrutoresNoEstado = useMemo(() => {
    const targetUf = estadoBusca.trim().toUpperCase();
    const citySet = new Set<string>();
    allCandidates.forEach(({ coverage }) => {
      if ((coverage.estadoBase || '').toUpperCase() === targetUf) {
        if (coverage.cidadeBase && coverage.cidadeBase.trim()) {
          citySet.add(coverage.cidadeBase.trim());
        }
        coverage.cidadesAtendidas.forEach((c) => {
          if (c && c.trim()) citySet.add(c.trim());
        });
      }
    });
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [allCandidates, estadoBusca]);

  // Lista inteligente de cidades exibidas após selecionar o Estado primeiro:
  // - Se for o mesmo Estado da localização/CEP da pessoa: lista a cidade da localização/CEP + cidades com instrutores + cidades do Estado.
  // - Se a pessoa estiver procurando em OUTRO Estado diferente da localização dela: lista estritamente as cidades que possuem instrutores cadastrados naquele Estado!
  const cidadesListadasParaEstado = useMemo(() => {
    const targetUf = estadoBusca.trim().toUpperCase();
    if (isSearchingDifferentState) {
      return cidadesComInstrutoresNoEstado;
    }
    const citySet = new Set<string>();
    if (detectedUserCity && detectedUserState.toUpperCase() === targetUf) {
      citySet.add(detectedUserCity.trim());
    }
    if (cidadeBusca && estadoBusca.toUpperCase() === targetUf) {
      citySet.add(cidadeBusca.trim());
    }
    cidadesComInstrutoresNoEstado.forEach((c) => citySet.add(c));
    BRAZIL_CITIES_COORDS.filter((c) => c.estado.toUpperCase() === targetUf).forEach((c) =>
      citySet.add(c.cidade)
    );
    return Array.from(citySet).sort((a, b) => a.localeCompare(b));
  }, [
    estadoBusca,
    isSearchingDifferentState,
    cidadesComInstrutoresNoEstado,
    detectedUserCity,
    detectedUserState,
    cidadeBusca
  ]);

  // Auto-preenchimento ao selecionar o Estado (1º Passo)
  const handleSelectStateFirst = (newUf: string) => {
    const cleanUf = newUf.toUpperCase();
    setEstadoBusca(cleanUf);
    setLeadEstado(cleanUf);
    setGpsCoords(null);
    setCepFeedback('');

    // Calcula cidades com instrutores neste novo Estado
    const instructorCitiesInUf = new Set<string>();
    allCandidates.forEach(({ coverage }) => {
      if ((coverage.estadoBase || '').toUpperCase() === cleanUf) {
        if (coverage.cidadeBase) instructorCitiesInUf.add(coverage.cidadeBase.trim());
        coverage.cidadesAtendidas.forEach((c) => {
          if (c && c.trim()) instructorCitiesInUf.add(c.trim());
        });
      }
    });
    const instCitiesList = Array.from(instructorCitiesInUf).sort((a, b) => a.localeCompare(b));

    if (cleanUf === detectedUserState.toUpperCase()) {
      // Mesmo Estado da localização/CEP da pessoa: auto-preenche com a cidade da pessoa
      const targetCity = detectedUserCity || instCitiesList[0] || 'Belo Horizonte';
      setCidadeBusca(targetCity);
      setCidadeAppFiltro(targetCity);
      setLeadCidade(targetCity);
    } else {
      // Procurando em outro Estado diferente da localização: lista apenas as cidades que possuem instrutores cadastrados
      if (instCitiesList.length > 0) {
        setCidadeBusca(instCitiesList[0]);
        setCidadeAppFiltro(instCitiesList[0]);
        setLeadCidade(instCitiesList[0]);
      } else {
        const fallbackStateCity =
          BRAZIL_CITIES_COORDS.find((c) => c.estado === cleanUf)?.cidade || '';
        setCidadeBusca(fallbackStateCity);
        setCidadeAppFiltro('TODAS');
        setLeadCidade(fallbackStateCity);
        setShowLeadForm(true);
      }
    }
  };

  // Auto-preenchimento ao digitar o CEP no painel do mapa
  const handleCepBuscaChange = async (rawValue: string) => {
    const formatted = formatCEP(rawValue);
    setCepBusca(formatted);
    setLeadCep(formatted);
    setCepFeedback('');

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8 && isValidCEPFormat(digits)) {
      setCepLoading(true);
      try {
        const res = await lookupAddressByCEP(digits, estadoBusca);
        if (res.success && res.cidade && res.estado) {
          const uf = res.estado.toUpperCase();
          setDetectedUserState(uf);
          setDetectedUserCity(res.cidade);
          setEstadoBusca(uf);
          setCidadeBusca(res.cidade);
          setCidadeAppFiltro(res.cidade);
          if (res.bairro) {
            setBairroBusca(res.bairro);
            setLeadBairro(res.bairro);
          }
          setLeadEstado(uf);
          setLeadCidade(res.cidade);
          setGpsCoords(null);
          setCepFeedback(
            `CEP ${formatted} localizado automaticamente: ${res.cidade}/${uf}${
              res.bairro ? ` (${res.bairro})` : ''
            }.`
          );
        } else if (res.message) {
          setCepFeedback(res.message);
        }
      } finally {
        setCepLoading(false);
      }
    }
  };

  // Auto-preenchimento ao digitar o CEP no formulário de lista de alunos em busca de instrutores
  const handleLeadCepChange = async (rawValue: string) => {
    const formatted = formatCEP(rawValue);
    setLeadCep(formatted);
    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 8 && isValidCEPFormat(digits)) {
      setLeadCepLoading(true);
      try {
        const res = await lookupAddressByCEP(digits, leadEstado);
        if (res.success && res.cidade && res.estado) {
          const uf = res.estado.toUpperCase();
          setLeadEstado(uf);
          setLeadCidade(res.cidade);
          if (res.bairro) {
            setLeadBairro(res.bairro);
          }
        }
      } finally {
        setLeadCepLoading(false);
      }
    }
  };

  // Coordenada central de referência para o mapa (GPS, CEP ou Cidade/Bairro selecionado)
  const referenceCoords = useMemo(() => {
    if (gpsCoords) {
      return resolveCoordinatesForLocation({
        cidade: cidadeBusca,
        estado: estadoBusca,
        bairro: bairroBusca,
        cep: cepBusca,
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude
      });
    }
    const activeCity = cidadeAppFiltro !== 'TODAS' ? cidadeAppFiltro : cidadeBusca;
    return resolveCoordinatesForLocation({
      cidade: activeCity,
      estado: estadoBusca,
      bairro: bairroBusca,
      cep: cepBusca
    });
  }, [gpsCoords, cidadeBusca, estadoBusca, bairroBusca, cepBusca, cidadeAppFiltro]);

  // Filtra os instrutores conforme o Estado, Cidade, Raio (5km a 40km) e filtros escolhidos
  const locatedInstructors: LocatedInstructorResult[] = useMemo(() => {
    // Se a pessoa está procurando em outro Estado e aquele Estado não tem instrutores cadastrados, retorna vazio para permitir salvar na lista de procura
    if (isSearchingDifferentState && cidadesComInstrutoresNoEstado.length === 0) {
      return [];
    }
    const candidatesInState = allCandidates.filter(
      ({ coverage }) => (coverage.estadoBase || '').toUpperCase() === estadoBusca.trim().toUpperCase()
    );
    return filterInstructorsForStudentMap(candidatesInState, {
      referenceCoords,
      maxDistanceKm: clampRadiusKm(radiusKm),
      cidadeFiltro: cidadeAppFiltro,
      categoriaFiltro,
      tipoVeiculoFiltro,
      tipoCambioFiltro
    });
  }, [
    allCandidates,
    estadoBusca,
    isSearchingDifferentState,
    cidadesComInstrutoresNoEstado,
    referenceCoords,
    radiusKm,
    cidadeAppFiltro,
    categoriaFiltro,
    tipoVeiculoFiltro,
    tipoCambioFiltro
  ]);

  // Pinos para o Mapa Interativo (No modo público do aluno, exibe estritamente instrutores e apenas as cidades atendidas, sem exibir o bairro do endereço do instrutor)
  const mapPins: GeoMapPin[] = useMemo(() => {
    return locatedInstructors.map((item) => {
      const cidadesExibidas =
        item.coverage.cidadesAtendidas.length > 0
          ? item.coverage.cidadesAtendidas.join(', ')
          : item.coverage.cidadeBase;
      return {
        id: item.instructor.id,
        latitude: item.coverage.latitude ?? referenceCoords.latitude,
        longitude: item.coverage.longitude ?? referenceCoords.longitude,
        title: item.instructor.nome,
        subtitle: `${cidadesExibidas}/${item.coverage.estadoBase} · Atende até ${item.coverage.raioAtendimentoKm} km`,
        badgeText: `CNH ${item.coverage.categoriasAtendidas.join(', ')}`,
        distanceKm: item.distanceKm,
        type: 'INSTRUCTOR',
        meta: item
      };
    });
  }, [locatedInstructors, referenceCoords]);

  // Captura Geolocalização do navegador do aluno
  const handleUseBrowserGeolocation = () => {
    setGpsFeedback('');
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsFeedback('Geolocalização não suportada neste navegador. Digite seu CEP ou selecione seu Estado e Cidade.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setGpsCoords({ latitude, longitude });
        const nearest = findNearestCityFromCoords(latitude, longitude);
        setDetectedUserState(nearest.estado);
        setDetectedUserCity(nearest.cidade);
        setEstadoBusca(nearest.estado);
        setCidadeBusca(nearest.cidade);
        setCidadeAppFiltro(nearest.cidade);
        setLeadCidade(nearest.cidade);
        setLeadEstado(nearest.estado);
        setGpsLoading(false);
        setGpsFeedback(`Localização GPS obtida com sucesso: ${nearest.cidade}/${nearest.estado}.`);
      },
      () => {
        setGpsLoading(false);
        setGpsFeedback('Permissão de GPS não concedida. Digite seu CEP ou selecione seu Estado e Cidade abaixo.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Cadastro reverso do aluno que não localizou instrutor na sua região (salvo com CEP na lista de alunos em busca de instrutores)
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
      setLeadError('Informe o seu CEP ou a Cidade e o Estado (UF) onde você procura instrutor.');
      return;
    }

    setLeadSaving(true);
    try {
      const targetCoords = resolveCoordinatesForLocation({
        cidade: leadCidade.trim(),
        estado: leadEstado.trim().toUpperCase(),
        bairro: leadBairro.trim(),
        cep: leadCep.trim()
      });

      const cityKey = normalizeTextKey(leadCidade);
      const anyInstructorInCity = allCandidates.some(
        ({ coverage }) =>
          normalizeTextKey(coverage.cidadeBase) === cityKey ||
          coverage.cidadesAtendidas.some((c) => normalizeTextKey(c) === cityKey)
      );

      const cleanCep = leadCep.replace(/\D/g, '').length === 8 ? formatCEP(leadCep) : undefined;

      const newLead: StudentLeadRequest = {
        id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nome: leadNome.trim(),
        telefone: formatPhone(phoneDigits),
        email: leadEmail.trim() || undefined,
        cep: cleanCep,
        estado: leadEstado.trim().toUpperCase(),
        cidade: leadCidade.trim(),
        bairro: leadBairro.trim() || 'Centro',
        categoriaCnh: leadCategoria,
        tipoVeiculo: leadTipoVeiculo,
        tipoCambio: leadTipoCambio,
        raioDesejadoKm: clampRadiusKm(radiusKm),
        observacoes:
          leadObservacoes.trim() ||
          `Aluno procurando instrutor em ${leadCidade.trim()}/${leadEstado.trim().toUpperCase()}${
            cleanCep ? ` (CEP: ${cleanCep})` : ''
          } — Raio ${radiusKm} km.`,
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
                Selecione seu Estado ou digite seu CEP para auto-preenchimento e entre em contato direto com o instrutor pelo WhatsApp.
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
                  1. Selecione primeiro o Estado (UF) ou digite seu CEP para Auto-Preenchimento
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

            {cepFeedback && (
              <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{cepFeedback}</span>
              </div>
            )}

            {isSearchingDifferentState && (
              <div className="px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-medium flex items-center justify-between gap-2 flex-wrap">
                <span>
                  📍 Você selecionou o estado <strong>{estadoBusca}</strong> (diferente da sua localização atual em{' '}
                  <strong>{detectedUserState}</strong>). Listando exclusivamente as cidades de{' '}
                  <strong>{estadoBusca}</strong> que possuem instrutores cadastrados (
                  {cidadesComInstrutoresNoEstado.length}).
                </span>
                {cidadesComInstrutoresNoEstado.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(true)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] cursor-pointer shrink-0"
                  >
                    Preencher meu CEP na Lista de Espera
                  </button>
                )}
              </div>
            )}

            {/* Linha 1 de Controles: 1º Estado (UF), 2º CEP (Auto-preenchimento), 3º Cidades Disponíveis, 4º Bairro e 5º Raio */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1º PASSO: ESTADO (UF) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  1º Selecione o Estado (UF) *
                </label>
                <select
                  value={estadoBusca}
                  onChange={(e) => handleSelectStateFirst(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-bold text-xs focus:border-blue-600 focus:outline-none cursor-pointer"
                >
                  {ESTADOS_BRASIL.map((st) => (
                    <option key={st.uf} value={st.uf}>
                      {st.uf} — {st.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2º PASSO: SEU CEP (AUTO-PREENCHIMENTO) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Seu CEP (Auto-Preenchimento)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={cepBusca}
                    onChange={(e) => handleCepBuscaChange(e.target.value)}
                    placeholder="00000-000"
                    maxLength={9}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono text-xs focus:border-blue-600 focus:outline-none"
                  />
                  {cepLoading && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 absolute right-3 top-2.5" />
                  )}
                </div>
              </div>

              {/* 3º PASSO: CIDADES DE ACORDO COM LOCALIZAÇÃO/CEP OU INSTRUTORES NO ESTADO */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {isSearchingDifferentState
                    ? `Cidades c/ Instrutores (${estadoBusca})`
                    : `Cidades (${estadoBusca} · Sua Região)`}
                </label>
                {cidadesListadasParaEstado.length > 0 ? (
                  <select
                    value={cidadeAppFiltro !== 'TODAS' ? cidadeAppFiltro : cidadeBusca}
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
                    <option value="TODAS">-- Todas no Raio ({estadoBusca}) --</option>
                    {cidadesListadasParaEstado.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3 py-2 border border-amber-300 rounded-xl bg-amber-50 text-amber-900 font-semibold text-[11px]">
                    Sem instrutores em {estadoBusca}. Preencha seu CEP abaixo!
                  </div>
                )}
              </div>

              {/* 4º PASSO: BAIRRO / REGIÃO */}
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
                  placeholder="Ex: Centro, Citrolândia..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* 5º PASSO: BARRA DESLIZANTE DE DISTÂNCIA (5 KM A 40 KM) */}
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
                    const whatsMsg = `Olá instrutor(a) ${item.instructor.nome}! Localizei seu perfil no mapa do Gestão AD (${item.coverage.cidadeBase}/${item.coverage.estadoBase}) e gostaria de informações sobre os planos e aulas práticas.`;
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
                              📍{' '}
                              {item.coverage.cidadesAtendidas.length > 0
                                ? `${item.coverage.cidadesAtendidas.join(', ')}/${item.coverage.estadoBase}`
                                : `${item.coverage.cidadeBase}/${item.coverage.estadoBase}`}
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

                        {/* Botão de Ação Exclusivo: Contato via WhatsApp Primeiro */}
                        <div className="pt-1">
                          {whatsUrl ? (
                            <a
                              href={whatsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                            >
                              <MessageCircle className="w-4 h-4" />
                              <span>Chamar no WhatsApp</span>
                            </a>
                          ) : (
                            <span className="block w-full py-2 px-3 bg-slate-100 text-slate-400 rounded-xl font-semibold text-xs text-center">
                              WhatsApp Indisponível
                            </span>
                          )}
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
                      Nenhum instrutor localizado em {referenceCoords.cidade}/{estadoBusca} num raio de {radiusKm} km.
                    </p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Preencha seu CEP abaixo para ficar salvo na <strong>lista de alunos em busca de instrutores</strong> e receber o contato de um profissional pelo WhatsApp!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLeadForm(true)}
                    className="w-full py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
                  >
                    📢 Preencher meu CEP na Lista de Alunos em Busca de Instrutores
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
                      ? 'Ocultar Lista de Alunos em Busca de Instrutores'
                      : 'Não encontrou instrutor? Preencha seu CEP para entrar na lista de procura!'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Seção de Cadastro de Demanda Reversa (Lista de Alunos em Busca de Instrutores com CEP) */}
          {(showLeadForm || locatedInstructors.length === 0) && (
            <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-indigo-200 rounded-2xl space-y-3.5 animate-in fade-in">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-indigo-950 text-xs sm:text-sm flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Lista de Alunos em Busca de Instrutores — Preencha seu CEP e Contato</span>
                  </h3>
                  <p className="text-xs text-slate-600">
                    Ao informar seu CEP e WhatsApp, você fica salvo na lista de alunos à procura de instrutor e os profissionais credenciados serão notificados em <strong>Mensagens e Notificações</strong> para chamá-lo no WhatsApp.
                  </p>
                </div>
              </div>

              {leadSuccess ? (
                <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl text-emerald-950 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-xs block text-emerald-900">
                        Você foi salvo na lista de alunos em busca de instrutores com sucesso!
                      </span>
                      <span className="text-xs text-emerald-800">
                        Os instrutores que atendem ou passarem a atender {leadCidade}/{leadEstado}{' '}
                        {leadCep ? `(CEP ${leadCep})` : ''} receberam sua notificação e entrarão em contato pelo WhatsApp.
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
                      <label className="block font-bold text-slate-700 mb-1">Seu CEP (Auto-Preenchimento) *</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={leadCep}
                          onChange={(e) => handleLeadCepChange(e.target.value)}
                          placeholder="00000-000"
                          maxLength={9}
                          className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono text-xs focus:border-indigo-600 focus:outline-none"
                        />
                        {leadCepLoading && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600 absolute right-3 top-2.5" />
                        )}
                      </div>
                    </div>

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
                        <select
                          value={leadEstado}
                          onChange={(e) => setLeadEstado(e.target.value.toUpperCase())}
                          className="w-18 px-2 py-2 border border-slate-300 rounded-xl bg-white text-center font-mono uppercase text-xs focus:border-indigo-600 focus:outline-none cursor-pointer"
                        >
                          {ESTADOS_BRASIL.map((st) => (
                            <option key={st.uf} value={st.uf}>
                              {st.uf}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Seu Bairro *</label>
                      <input
                        type="text"
                        required
                        value={leadBairro}
                        onChange={(e) => setLeadBairro(e.target.value)}
                        placeholder="Ex: Centro, Citrolândia..."
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
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                    <input
                      type="text"
                      value={leadObservacoes}
                      onChange={(e) => setLeadObservacoes(e.target.value)}
                      placeholder="Observações opcionais (Ex: Prefiro aulas pela manhã ou sábado)"
                      className="w-full sm:flex-1 px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs focus:border-indigo-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={leadSaving}
                      className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm cursor-pointer transition-colors shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {leadSaving
                          ? 'Salvando na Lista...'
                          : 'Salvar meu CEP na Lista de Alunos em Busca de Instrutores'}
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
            <span>Entre em contato direto com o instrutor pelo WhatsApp para receber o código ou link de matrícula.</span>
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
