import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  MapPin,
  Clock,
  Navigation,
  PauseCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Smartphone,
  Cpu,
  Eye,
  FileSpreadsheet,
  Calendar,
  UserCheck,
  Car,
  Sparkles,
  RefreshCw,
  Compass
} from 'lucide-react';
import type {
  Organization,
  User,
  Lesson,
  Student,
  LessonCheckinRecord,
  LessonGpsPoint
} from '../../types';
import { db, syncFromSupabase } from '../../lib/storage';
import { formatDateBR } from '../../lib/validation';
import {
  evaluateHardwareForLiveMap,
  computeRouteTelemetry,
  formatDurationHMS,
  generateSimulatedGpsStep
} from '../../lib/lessonCheckinService';
import {
  getSaaSPlans,
  configureModuleAcrossPlans
} from '../../lib/saasPlans';
import { LessonRouteMap } from './LessonRouteMap';
import { resolveStudentIdentity } from '../../legal/studentIdentity';

interface LessonCheckinViewProps {
  currentUser: User;
  currentOrg: Organization;
}

type ViewDisplayMode = 'AMBOS' | 'TEMPO' | 'MAPA';
type CheckinTab = 'OPERACAO' | 'RELATORIO';

export const LessonCheckinView: React.FC<LessonCheckinViewProps> = ({
  currentUser,
  currentOrg
}) => {
  const orgId = currentOrg?.id || currentUser.organizacaoId || 'org_direcao_certa_01';
  const isMaster =
    currentUser.papel === 'SUPER_ADMIN' || currentUser.email.toLowerCase() === 'cassiordcosta@gmail.com';
  const isStudent = currentUser.papel === 'ALUNO';

  const [activeTab, setActiveTab] = useState<CheckinTab>('OPERACAO');
  const [dataVersion, setDataVersion] = useState<number>(0);

  // Master validation & hardware contingency simulation controls
  const [forceLowSpecSimulation, setForceLowSpecSimulation] = useState<boolean>(false);
  const [viewDisplayMode, setViewDisplayMode] = useState<ViewDisplayMode>('AMBOS');
  const [geoPermissionState, setGeoPermissionState] = useState<
    'IDLE' | 'REQUESTING' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED'
  >('IDLE');
  const [geoNotice, setGeoNotice] = useState<string>('');
  const [statusFeedback, setStatusFeedback] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(
    null
  );

  // Post-checkout finished summary (especially important when live map was deferred due to low hardware!)
  const [lastCompletedCheckin, setLastCompletedCheckin] = useState<LessonCheckinRecord | null>(null);

  // Optional evaluation fields on checkout (instructor/master)
  const [checkoutGrade, setCheckoutGrade] = useState<number>(9);
  const [checkoutNote, setCheckoutNote] = useState<string>('');

  // Live clock seconds when check-in is active
  const [liveElapsedSec, setLiveElapsedSec] = useState<number>(0);
  const watchIdRef = useRef<number | null>(null);

  // Reports filters
  const [reportInstructorFilter, setReportInstructorFilter] = useState<string>(() =>
    !isMaster && !isStudent ? currentUser.id : 'TODOS'
  );
  const [reportStudentFilter, setReportStudentFilter] = useState<string>('TODOS');
  const [selectedReportCheckinId, setSelectedReportCheckinId] = useState<string | null>(null);

  // Master plan rollout selector
  const [plansSnapshot, setPlansSnapshot] = useState(() => getSaaSPlans());
  const [selectedPlansForModule, setSelectedPlansForModule] = useState<string[]>(() =>
    Object.values(getSaaSPlans())
      .filter((p) => p.modulosPermitidos.includes('LESSON_CHECKIN_GPS'))
      .map((p) => p.id)
  );
  const [savingPlans, setSavingPlans] = useState<boolean>(false);

  // Hardware evaluation BEFORE initializing the live map
  const hardwareCheck = useMemo(
    () => evaluateHardwareForLiveMap({ forceLowSpec: forceLowSpecSimulation }),
    [forceLowSpecSimulation]
  );

  // Sync updates listener
  useEffect(() => {
    const onSync = () => setDataVersion((v) => v + 1);
    window.addEventListener('agd:data-synced', onSync);
    window.addEventListener('storage', onSync);
    return () => {
      window.removeEventListener('agd:data-synced', onSync);
      window.removeEventListener('storage', onSync);
    };
  }, []);

  // Load domain data (always alphabetically sorted for students)
  const allUsers = useMemo(() => db.getUsers(orgId), [orgId, dataVersion]);
  const allStudents = useMemo(() => db.getStudents(orgId), [orgId, dataVersion]);
  const allLessons = useMemo(() => db.getLessons(orgId), [orgId, dataVersion]);
  const vehicles = useMemo(() => db.getVehicles(orgId), [orgId, dataVersion]);
  const checkins = useMemo(() => db.getLessonCheckins(orgId), [orgId, dataVersion]);

  const loggedStudent = useMemo(
    () => (isStudent ? resolveStudentIdentity(allStudents, currentUser) : undefined),
    [isStudent, allStudents, currentUser]
  );

  // Eligible students for this actor (already A-Z sorted)
  const visibleStudents = useMemo(() => {
    if (isStudent) return loggedStudent ? [loggedStudent] : [];
    if (isMaster || currentUser.papel === 'ADMIN_ORG') return allStudents;
    return allStudents.filter((s) => !s.instrutorId || s.instrutorId === currentUser.id);
  }, [isStudent, loggedStudent, isMaster, currentUser.papel, currentUser.id, allStudents]);

  // Scheduled/active lessons available for check-in
  const candidateLessons = useMemo(() => {
    const filtered = allLessons.filter((l) => {
      if (l.status !== 'AGENDADA' && l.status !== 'EM_ANDAMENTO') return false;
      if (isStudent) return loggedStudent ? l.alunoId === loggedStudent.id : false;
      if (!isMaster && currentUser.papel === 'INSTRUTOR') {
        return !l.instrutorId || l.instrutorId === currentUser.id;
      }
      return true;
    });

    return filtered.sort((a, b) => {
      const aActive = a.status === 'EM_ANDAMENTO' ? 0 : 1;
      const bActive = b.status === 'EM_ANDAMENTO' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return `${a.data}_${a.horaInicio}`.localeCompare(`${b.data}_${b.horaInicio}`);
    });
  }, [allLessons, isStudent, loggedStudent, isMaster, currentUser.papel, currentUser.id]);

  // Active in-progress check-in for current actor
  const activeCheckin = useMemo(() => {
    if (isStudent && loggedStudent) {
      return checkins.find((c) => c.status === 'EM_ANDAMENTO' && c.alunoId === loggedStudent.id);
    }
    if (!isMaster && currentUser.papel === 'INSTRUTOR') {
      return checkins.find(
        (c) =>
          c.status === 'EM_ANDAMENTO' &&
          (!c.instrutorId || c.instrutorId === currentUser.id)
      );
    }
    return checkins.find((c) => c.status === 'EM_ANDAMENTO');
  }, [checkins, isStudent, loggedStudent, isMaster, currentUser.papel, currentUser.id]);

  // Selected scheduled lesson for check-in
  const [selectedLessonId, setSelectedLessonId] = useState<string>('');
  useEffect(() => {
    if (activeCheckin) {
      setSelectedLessonId(activeCheckin.aulaId);
      return;
    }
    if (selectedLessonId && candidateLessons.some((l) => l.id === selectedLessonId)) {
      return;
    }
    setSelectedLessonId(candidateLessons[0]?.id || '');
  }, [activeCheckin, candidateLessons, selectedLessonId]);

  const selectedLesson: Lesson | undefined = useMemo(
    () => candidateLessons.find((l) => l.id === selectedLessonId) || candidateLessons[0],
    [candidateLessons, selectedLessonId]
  );

  const selectedLessonStudent: Student | undefined = useMemo(() => {
    const id = activeCheckin?.alunoId || selectedLesson?.alunoId;
    return id ? allStudents.find((s) => s.id === id) : undefined;
  }, [activeCheckin, selectedLesson, allStudents]);

  const selectedLessonInstructor: User | undefined = useMemo(() => {
    const id = activeCheckin?.instrutorId || selectedLesson?.instrutorId || selectedLessonStudent?.instrutorId;
    return id ? allUsers.find((u) => u.id === id) : undefined;
  }, [activeCheckin, selectedLesson, selectedLessonStudent, allUsers]);

  // Keep live timer synced with active check-in
  useEffect(() => {
    if (!activeCheckin) {
      setLiveElapsedSec(0);
      return;
    }
    const computeElapsed = () => {
      const startMs = new Date(activeCheckin.checkinEm).getTime();
      if (!Number.isFinite(startMs)) return activeCheckin.tempoTotalSegundos || 0;
      return Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    };
    setLiveElapsedSec(computeElapsed());
    const id = setInterval(() => {
      setLiveElapsedSec(computeElapsed());
    }, 1000);
    return () => clearInterval(id);
  }, [activeCheckin?.id, activeCheckin?.checkinEm]);

  // Mobile GPS watcher while check-in is active (records points even when live map is hidden or hardware is limited!)
  useEffect(() => {
    if (!activeCheckin) {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPermissionState('UNSUPPORTED');
      return;
    }

    const onPosition = (pos: GeolocationPosition) => {
      setGeoPermissionState('GRANTED');
      setGeoNotice('');
      const latestCheckin = db
        .getLessonCheckins(orgId)
        .find((c) => c.id === activeCheckin.id && c.status === 'EM_ANDAMENTO');
      if (!latestCheckin) return;

      const coords = latestCheckin.coordenadas || [];
      const speedKmh =
        pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
          ? Math.max(0, Math.round(pos.coords.speed * 3.6))
          : undefined;
      const point: LessonGpsPoint = {
        lat: Number(pos.coords.latitude.toFixed(6)),
        lng: Number(pos.coords.longitude.toFixed(6)),
        timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
        speedKmh,
        accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined
      };

      const nextPoints = [...coords, point];
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(latestCheckin.checkinEm).getTime()) / 1000)
      );
      const telemetry = computeRouteTelemetry(nextPoints, elapsed);

      db.updateLessonCheckinProgress(latestCheckin.id, {
        coordenadas: nextPoints,
        tempoTotalSegundos: telemetry.totalSeconds,
        tempoDeslocamentoSegundos: telemetry.movingSeconds,
        tempoParadaSegundos: telemetry.stoppedSeconds,
        distanciaKm: telemetry.distanceKm
      });
      setDataVersion((v) => v + 1);
    };

    const onError = (err: GeolocationPositionError) => {
      if (err.code === err.PERMISSION_DENIED) {
        setGeoPermissionState('DENIED');
        setGeoNotice(
          'Permissão de GPS negada no navegador. Autorize a localização do aparelho ou use o simulador Master para validação.'
        );
      } else {
        setGeoNotice('Sinal GPS instável no momento. Tentando reconectar automaticamente.');
      }
    };

    try {
      watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 12000
      });
    } catch {
      setGeoPermissionState('UNSUPPORTED');
    }

    return () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [activeCheckin?.id, orgId]);

  const activeTelemetry = useMemo(() => {
    if (!activeCheckin) {
      return computeRouteTelemetry([], 0);
    }
    return computeRouteTelemetry(activeCheckin.coordenadas || [], liveElapsedSec);
  }, [activeCheckin, liveElapsedSec]);

  // Display details cleanly visible even in low-hardware fallback mode
  const displayStudentName =
    activeCheckin?.alunoNome || selectedLessonStudent?.nome || 'Nenhum aluno selecionado';
  const displayInstructorName =
    activeCheckin?.instrutorNome ||
    selectedLessonInstructor?.nome ||
    (!isStudent ? currentUser.nome : 'Instrutor Credenciado');
  const displayDate = activeCheckin?.dataAgendamento || selectedLesson?.data || new Date().toISOString().slice(0, 10);
  const displayTime =
    activeCheckin
      ? `${activeCheckin.horaInicioAgendamento} - ${activeCheckin.horaFimAgendamento}`
      : selectedLesson
      ? `${selectedLesson.horaInicio} - ${selectedLesson.horaFim}`
      : '--:--';

  const requestGpsAndStartCheckin = async () => {
    if (!selectedLesson || !selectedLessonStudent) {
      setStatusFeedback({
        text: 'Selecione uma aula agendada para iniciar o check-in.',
        type: 'error'
      });
      return;
    }

    setLastCompletedCheckin(null);
    setGeoPermissionState('REQUESTING');

    let initialPoint: LessonGpsPoint | undefined;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      await new Promise<void>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGeoPermissionState('GRANTED');
            setGeoNotice('');
            initialPoint = {
              lat: Number(pos.coords.latitude.toFixed(6)),
              lng: Number(pos.coords.longitude.toFixed(6)),
              timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
              speedKmh:
                pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
                  ? Math.max(0, Math.round(pos.coords.speed * 3.6))
                  : 0,
              accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined
            };
            resolve();
          },
          (err) => {
            if (err.code === err.PERMISSION_DENIED) {
              setGeoPermissionState('DENIED');
              setGeoNotice(
                'Acesso ao GPS não foi autorizado. O cronômetro foi iniciado; conceda acesso à localização para gravar o trajeto.'
              );
            } else {
              setGeoPermissionState('IDLE');
              setGeoNotice('Buscando sinal de satélite GPS em segundo plano...');
            }
            resolve();
          },
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 5000 }
        );
      });
    } else {
      setGeoPermissionState('UNSUPPORTED');
    }

    const record = db.startLessonCheckin({
      lesson: selectedLesson,
      student: selectedLessonStudent,
      instructor: selectedLessonInstructor || (!isStudent ? currentUser : undefined),
      actor: currentUser,
      modoHardware: hardwareCheck.canRunLiveMap ? 'LIVE_MAP' : 'LOW_SPEC_DEFERRED_MAP',
      motivoHardwareLimitado: hardwareCheck.reason,
      initialPoint
    });

    setStatusFeedback({
      text: `Check-in iniciado às ${new Date(record.checkinEm).toLocaleTimeString('pt-BR')}! Tempo e GPS em monitoramento.`,
      type: 'success'
    });
    setDataVersion((v) => v + 1);
  };

  const handleCheckoutLesson = () => {
    if (!activeCheckin) return;
    const telemetry = computeRouteTelemetry(activeCheckin.coordenadas || [], liveElapsedSec);
    const res = db.finishLessonCheckin({
      checkinId: activeCheckin.id,
      actor: currentUser,
      tempoTotalSegundos: telemetry.totalSeconds,
      tempoDeslocamentoSegundos: telemetry.movingSeconds,
      tempoParadaSegundos: telemetry.stoppedSeconds,
      distanciaKm: telemetry.distanceKm,
      coordenadas: activeCheckin.coordenadas,
      notaAula: !isStudent ? checkoutGrade : undefined,
      observacaoInstrutor: !isStudent && checkoutNote.trim() ? checkoutNote.trim() : undefined
    });

    if (res.checkin) {
      setLastCompletedCheckin(res.checkin);
    }
    setCheckoutNote('');
    setStatusFeedback({
      text: `Check-out concluído! Aula de ${displayStudentName} computada e creditada no plano (${formatDurationHMS(
        telemetry.totalSeconds
      )} · ${telemetry.distanceKm.toFixed(2)} km).`,
      type: 'success'
    });
    setDataVersion((v) => v + 1);
  };

  // Master validation helpers
  const handleMasterSimulateGpsStep = (stopped: boolean) => {
    if (!activeCheckin) return;
    const nextPt = generateSimulatedGpsStep(activeCheckin.coordenadas || [], {
      stopped,
      stepSeconds: 15
    });
    const nextPoints = [...(activeCheckin.coordenadas || []), nextPt];
    const telemetry = computeRouteTelemetry(nextPoints, Math.max(liveElapsedSec, nextPoints.length * 15));
    db.updateLessonCheckinProgress(activeCheckin.id, {
      coordenadas: nextPoints,
      tempoTotalSegundos: telemetry.totalSeconds,
      tempoDeslocamentoSegundos: telemetry.movingSeconds,
      tempoParadaSegundos: telemetry.stoppedSeconds,
      distanciaKm: telemetry.distanceKm
    });
    setDataVersion((v) => v + 1);
  };

  const handleMasterCreateTestLesson = () => {
    let targetStudent = visibleStudents[0] || allStudents[0];
    if (!targetStudent) {
      const createdStudent: Student = {
        id: `stu_val_gps_${Date.now()}`,
        organizacaoId: orgId,
        instrutorId: allUsers.find((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG')?.id || currentUser.id,
        nome: 'Aluno Validação Master GPS',
        email: 'validacao.gps@gestaodirecao.local',
        telefone: '(31) 99999-0000',
        cpfMascarado: '***.***.000-99',
        cpfFingerprint: `fp_val_${Date.now()}`,
        dataNascimento: '1998-05-15',
        idade: 28,
        categoriaCnh: 'B',
        status: 'EM_ANDAMENTO',
        aulasCumpridas: 0,
        totalAulasContratadas: 20,
        habilidades: {
          baliza: 0,
          controleEmbreagem: 0,
          transitoPesado: 0,
          conversoesCruzamentos: 0,
          rodoviaVelocidade: 0,
          sinalizacaoPreferencia: 0,
          posturaDefensiva: 0,
          simuladoExame: 0
        },
        observacoesInstrutor: 'Cadastro temporário para validação Master de Check-in GPS.',
        dataCadastro: new Date().toISOString().slice(0, 10)
      };
      db.saveStudent(createdStudent, currentUser.id);
      targetStudent = createdStudent;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const nowHour = String(Math.max(6, Math.min(23, new Date().getHours()))).padStart(2, '0');
    const horaInicio = `${nowHour}:00`;
    const horaFim = `${nowHour}:50`;
    const instrutorId =
      targetStudent.instrutorId ||
      allUsers.find((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG')?.id ||
      currentUser.id;
    const veiculoId = vehicles[0]?.id || 'veh_simulado_01';

    const testLesson: Lesson = {
      id: `lsn_val_${Date.now()}`,
      organizacaoId: orgId,
      alunoId: targetStudent.id,
      instrutorId,
      veiculoId,
      data: todayStr,
      horaInicio,
      horaFim,
      topico: 'Validação Master — Circuito GPS, Tempo em Movimento e Paradas',
      status: 'AGENDADA',
      criadoEm: new Date().toISOString()
    };

    const res = db.createLesson(testLesson, currentUser.id);
    if (res.success) {
      setSelectedLessonId(testLesson.id);
      setStatusFeedback({
        text: `Aula de teste criada para ${targetStudent.nome} hoje às ${horaInicio}. Clique em "Iniciar Check-in" para testar.`,
        type: 'success'
      });
    } else {
      // Fallback para hora seguinte caso o slot atual já esteja ocupado
      const nextHour = String(Math.min(23, new Date().getHours() + 1)).padStart(2, '0');
      const altLesson: Lesson = {
        ...testLesson,
        id: `lsn_val_${Date.now()}_alt`,
        horaInicio: `${nextHour}:00`,
        horaFim: `${nextHour}:50`
      };
      const altRes = db.createLesson(altLesson, currentUser.id);
      if (altRes.success) {
        setSelectedLessonId(altLesson.id);
        setStatusFeedback({
          text: `Aula de teste criada para ${targetStudent.nome} hoje às ${nextHour}:00.`,
          type: 'success'
        });
      } else {
        setStatusFeedback({
          text: res.error || 'Já existe aula agendada disponível na lista acima.',
          type: 'info'
        });
      }
    }
    setDataVersion((v) => v + 1);
  };

  const handleSavePlansRollout = async () => {
    setSavingPlans(true);
    try {
      const result = await configureModuleAcrossPlans('LESSON_CHECKIN_GPS', selectedPlansForModule);
      setPlansSnapshot(getSaaSPlans());
      setStatusFeedback({
        text:
          selectedPlansForModule.length > 0
            ? `Módulo liberado nos planos: ${selectedPlansForModule.join(', ')} (${
                result.syncedRemote ? 'sincronizado no banco' : 'salvo localmente'
              }).`
            : 'Módulo restringido apenas ao Administrador Master (desabilitado nos planos comerciais).',
        type: 'success'
      });
    } finally {
      setSavingPlans(false);
    }
  };

  // Report data scoped by role and sorted filters
  const instructorsForFilter = useMemo(
    () =>
      allUsers
        .filter((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG')
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })),
    [allUsers]
  );

  const filteredReportCheckins = useMemo(() => {
    return checkins.filter((c) => {
      if (isStudent) {
        return loggedStudent ? c.alunoId === loggedStudent.id : false;
      }
      if (!isMaster && currentUser.papel === 'INSTRUTOR') {
        if (c.instrutorId !== currentUser.id) return false;
      } else if (reportInstructorFilter !== 'TODOS' && c.instrutorId !== reportInstructorFilter) {
        return false;
      }
      if (reportStudentFilter !== 'TODOS' && c.alunoId !== reportStudentFilter) {
        return false;
      }
      return true;
    });
  }, [
    checkins,
    isStudent,
    loggedStudent,
    isMaster,
    currentUser.papel,
    currentUser.id,
    reportInstructorFilter,
    reportStudentFilter
  ]);

  const selectedReportRecord = useMemo(
    () => filteredReportCheckins.find((c) => c.id === selectedReportCheckinId) || filteredReportCheckins[0] || null,
    [filteredReportCheckins, selectedReportCheckinId]
  );

  // Whether the live map is allowed to render during the operation screen
  const canRenderLiveMap = hardwareCheck.canRunLiveMap;

  return (
    <div className="space-y-5 min-w-0">
      {/* Cabeçalho do Módulo */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-blue-900/50">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300">
                <Navigation className="w-5 h-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Check-in Prático & Telemetria GPS
              </span>
              {isMaster && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  Modo Homologação Master
                </span>
              )}
            </div>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white mt-1">
              Check-in / Check-out de Aula & Mapa de Percurso
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Controle de início e término de aula com medidor de tempo em deslocamento/parada, registro individual por aluno e verificação anti-falha de hardware.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('OPERACAO')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'OPERACAO'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Cronômetro & Check-in</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RELATORIO')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                activeTab === 'RELATORIO'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Relatório de Percursos ({filteredReportCheckins.length})</span>
            </button>
            <button
              type="button"
              onClick={() => syncFromSupabase().then(() => setDataVersion((v) => v + 1)).catch(() => {})}
              className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
              title="Sincronizar registros com a nuvem"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sincronizar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de operação */}
      {statusFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusFeedback.text}</span>
        </div>
      )}

      {/* PAINEL DE VALIDAÇÃO MASTER & CONFIGURAÇÃO DE PLANOS */}
      {isMaster && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500 text-slate-950 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-amber-950">
                  Validação Exclusiva do Administrador Master & Liberação nos Planos
                </h2>
                <p className="text-xs text-amber-900 mt-0.5">
                  Teste o fluxo completo de Check-in, Telemetria GPS e Fallback de Hardware antes de liberar nos pacotes de assinatura dos instrutores e alunos.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleMasterCreateTestLesson}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Criar Aula Teste Agora</span>
              </button>
              <button
                type="button"
                onClick={() => setForceLowSpecSimulation((prev) => !prev)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer flex items-center gap-1.5 transition-colors ${
                  forceLowSpecSimulation
                    ? 'bg-rose-600 text-white border-rose-700'
                    : 'bg-white text-amber-950 border-amber-300 hover:bg-amber-100'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>
                  {forceLowSpecSimulation ? 'Desativar Simulação Hardware Fraco' : 'Simular Hardware Limitado'}
                </span>
              </button>
            </div>
          </div>

          {activeCheckin && (
            <div className="p-3 bg-white rounded-xl border border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-800">
                Simulador GPS em Andamento ({activeCheckin.coordenadas.length} pontos capturados):
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleMasterSimulateGpsStep(false)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold cursor-pointer"
                >
                  + Simular Deslocamento (+15s)
                </button>
                <button
                  type="button"
                  onClick={() => handleMasterSimulateGpsStep(true)}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg font-bold cursor-pointer"
                >
                  + Simular Veículo Parado (+15s)
                </button>
              </div>
            </div>
          )}

          {/* Configuração nos Planos SaaS */}
          <div className="pt-3 border-t border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="space-y-1">
              <span className="font-extrabold text-amber-950 block">
                Disponibilizar módulo nos Planos de Assinatura:
              </span>
              <div className="flex flex-wrap gap-3">
                {(['DEMO', 'BASICO', 'AVANCADO', 'MASTER'] as const).map((planId) => {
                  const checked = selectedPlansForModule.includes(planId);
                  return (
                    <label key={planId} className="inline-flex items-center gap-1.5 font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setSelectedPlansForModule((prev) =>
                            prev.includes(planId) ? prev.filter((p) => p !== planId) : [...prev, planId]
                          )
                        }
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span>{plansSnapshot[planId]?.id || planId}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={savingPlans}
              onClick={handleSavePlansRollout}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer shrink-0 shadow-xs"
            >
              {savingPlans ? 'Salvando...' : 'Salvar Liberação nos Planos'}
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 1: OPERAÇÃO DE CHECK-IN / CHECK-OUT, MEDIDOR DE TEMPO & MAPA AO VIVO   */}
      {/* ========================================================================= */}
      {activeTab === 'OPERACAO' && (
        <div className="space-y-5 min-w-0">
          {/* Diagnóstico / Alerta de Hardware (Segurança Anti-Falha) */}
          {!hardwareCheck.canRunLiveMap ? (
            <div
              role="alert"
              className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 flex items-start gap-3 shadow-xs"
            >
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1 min-w-0">
                <p className="font-extrabold text-sm text-amber-950">
                  Modo de Contingência Ativado — Hardware Insuficiente para Mapa ao Vivo
                </p>
                <p className="text-amber-900 leading-relaxed">{hardwareCheck.reason}</p>
                <p className="text-[11px] font-mono text-amber-800">
                  Diagnóstico: {hardwareCheck.specsSummary}. As coordenadas GPS serão gravadas em segundo plano e o trajeto completo no mapa será apresentado após o Check-out.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-800 font-semibold min-w-0">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="truncate">
                  Hardware verificado para Mapa ao Vivo ({hardwareCheck.specsSummary})
                </span>
              </div>

              {/* Botões de Alternância: Ambos | Somente Tempo | Somente Mapa */}
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('AMBOS')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    viewDisplayMode === 'AMBOS'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Ambos (Tempo + Mapa)
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('TEMPO')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    viewDisplayMode === 'TEMPO'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Somente Medidor de Tempo
                </button>
                <button
                  type="button"
                  onClick={() => setViewDisplayMode('MAPA')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    viewDisplayMode === 'MAPA'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Somente Mapa
                </button>
              </div>
            </div>
          )}

          {/* Barra Fixa e Responsiva de Dados da Aula (Sempre Visível em Qualquer Hardware) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            {!activeCheckin && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Selecione a Aula Agendada para Iniciar o Check-in:
                </label>
                {candidateLessons.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600">
                    Nenhuma aula agendada pendente encontrada. Caso o instrutor/aluno não utilizem o check-in, as aulas agendadas na Agenda continuam sendo computadas automaticamente ao final do horário.
                  </div>
                ) : (
                  <select
                    aria-label="Selecionar aula agendada para check-in"
                    value={selectedLesson?.id || ''}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-xl bg-white text-xs font-semibold text-slate-900"
                  >
                    {candidateLessons.map((l) => {
                      const st = allStudents.find((s) => s.id === l.alunoId);
                      return (
                        <option key={l.id} value={l.id}>
                          {st?.nome || 'Aluno'} — {formatDateBR(l.data)} ({l.horaInicio} - {l.horaFim}) · {l.topico}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
            )}

            {/* Identificação Clara e Responsiva (Nunca Quebra Dados) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Aluno</span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5 break-words flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{displayStudentName}</span>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Instrutor</span>
                <p className="text-sm font-extrabold text-slate-900 mt-0.5 break-words flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{displayInstructorName}</span>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Data do Agendamento</span>
                <p className="text-sm font-mono font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{formatDateBR(displayDate)}</span>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-0">
                <span className="text-[11px] font-bold uppercase text-slate-500 block">Horário da Aula</span>
                <p className="text-sm font-mono font-extrabold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{displayTime}</span>
                </p>
              </div>
            </div>

            {geoNotice && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{geoNotice}</span>
              </div>
            )}

            {/* Botões Principais de Início (Check-in) e Término (Check-out) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100">
              {!activeCheckin ? (
                <button
                  type="button"
                  disabled={!selectedLesson || !selectedLessonStudent}
                  onClick={requestGpsAndStartCheckin}
                  className="w-full sm:w-auto px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Play className="w-5 h-5 fill-current" />
                  <span>
                    {geoPermissionState === 'REQUESTING'
                      ? 'Solicitando GPS e Iniciando...'
                      : 'Iniciar Check-in da Aula'}
                  </span>
                </button>
              ) : (
                <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-900 font-extrabold border border-emerald-300 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Aula em Andamento · Check-in ativo</span>
                    </span>
                    <span className="text-slate-500 font-mono">
                      Início: {new Date(activeCheckin.checkinEm).toLocaleTimeString('pt-BR')}
                    </span>
                  </div>

                  {isStudent && !isMaster ? (
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold">
                      Rastreamento ativo. Ao término da aula, o instrutor realizará o Check-out para finalizar (ou o sistema dará baixa automática após o horário).
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                        <span className="font-semibold text-slate-600 whitespace-nowrap">Nota:</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          step="0.5"
                          aria-label="Nota da aula no check-out"
                          value={checkoutGrade}
                          onChange={(e) => setCheckoutGrade(Math.min(10, Math.max(1, Number(e.target.value) || 9)))}
                          className="w-14 px-2 py-1 border border-slate-300 rounded-lg font-mono font-bold text-center bg-white"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Observação rápida da aula (opcional)"
                        aria-label="Observação rápida da aula no check-out"
                        value={checkoutNote}
                        onChange={(e) => setCheckoutNote(e.target.value)}
                        className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white min-w-[180px]"
                      />
                      <button
                        type="button"
                        onClick={handleCheckoutLesson}
                        className="px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-sm font-extrabold shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all shrink-0"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>Finalizar Check-out & Computar Aula</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ÁREA PRINCIPAL: MEDIDOR DE TEMPO + MAPA AO VIVO (RESPEITA HARDWARE E ESCOLHA DO USUÁRIO) */}
          <div
            className={`grid grid-cols-1 gap-5 ${
              canRenderLiveMap && viewDisplayMode === 'AMBOS' ? 'lg:grid-cols-12' : ''
            }`}
          >
            {/* MEDIDOR DE TEMPO */}
            {(!canRenderLiveMap || viewDisplayMode === 'AMBOS' || viewDisplayMode === 'TEMPO') && (
              <div
                className={`bg-slate-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800 space-y-5 ${
                  canRenderLiveMap && viewDisplayMode === 'AMBOS' ? 'lg:col-span-5' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-300 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    <span>Medidor de Tempo da Aula</span>
                  </span>
                  <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200">
                    {(activeCheckin?.coordenadas || []).length} ponto(s) GPS
                  </span>
                </div>

                {/* Cronômetro Gigante Responsivo */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center">
                  <span className="text-xs uppercase tracking-widest text-slate-400 font-bold block">
                    Tempo Total Computado (Check-in)
                  </span>
                  <p
                    data-testid="checkin-total-timer"
                    className="text-4xl sm:text-5xl font-black font-mono tracking-tight text-emerald-400 mt-1 break-all"
                  >
                    {formatDurationHMS(activeTelemetry.totalSeconds)}
                  </p>
                </div>

                {/* Deslocamento vs Parada + Distância */}
                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
                    <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                      <Navigation className="w-3.5 h-3.5 shrink-0" />
                      <span>Em Deslocamento</span>
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">
                      {formatDurationHMS(activeTelemetry.movingSeconds)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                    <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <PauseCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Tempo de Parada</span>
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">
                      {formatDurationHMS(activeTelemetry.stoppedSeconds)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                    <span className="text-[11px] font-bold text-emerald-300 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span>Distância</span>
                    </span>
                    <p className="text-lg sm:text-xl font-extrabold font-mono text-white mt-1">
                      {activeTelemetry.distanceKm.toFixed(2)} km
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* MAPA AO VIVO (RENDERIZADO SOMENTE QUANDO HARDWARE FOR SUFICIENTE E USUÁRIO ESCOLHER MAPA/AMBOS) */}
            {canRenderLiveMap && (viewDisplayMode === 'AMBOS' || viewDisplayMode === 'MAPA') && (
              <div className={viewDisplayMode === 'AMBOS' ? 'lg:col-span-7' : ''}>
                <LessonRouteMap
                  points={activeCheckin?.coordenadas || []}
                  title={`Trajeto Ao Vivo · ${displayStudentName}`}
                  isLive={Boolean(activeCheckin)}
                  heightClass="h-72 sm:h-[380px]"
                />
              </div>
            )}
          </div>

          {/* MAPA EXIBIDO APÓS O TÉRMINO DA AULA (OBRIGATÓRIO QUANDO HARDWARE ERA LIMITADO NO LIVE) */}
          {lastCompletedCheckin && (
            <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-black uppercase">
                    Aula Finalizada · Registro Computado
                  </span>
                  <h3 className="text-base font-extrabold text-emerald-950 mt-1">
                    Resumo e Mapa do Percurso Realizado — {lastCompletedCheckin.alunoNome}
                  </h3>
                  <p className="text-xs text-emerald-900">
                    {formatDateBR(lastCompletedCheckin.dataAgendamento)} ({lastCompletedCheckin.horaInicioAgendamento} -{' '}
                    {lastCompletedCheckin.horaFimAgendamento}) · Total:{' '}
                    <strong>{formatDurationHMS(lastCompletedCheckin.tempoTotalSegundos)}</strong> · Deslocamento:{' '}
                    <strong>{formatDurationHMS(lastCompletedCheckin.tempoDeslocamentoSegundos)}</strong> · Parada:{' '}
                    <strong>{formatDurationHMS(lastCompletedCheckin.tempoParadaSegundos)}</strong> ·{' '}
                    <strong>{lastCompletedCheckin.distanciaKm.toFixed(2)} km</strong>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLastCompletedCheckin(null)}
                  className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold cursor-pointer self-start"
                >
                  Fechar Resumo
                </button>
              </div>

              <LessonRouteMap
                points={lastCompletedCheckin.coordenadas || []}
                title={`Trajeto Finalizado (${formatDateBR(lastCompletedCheckin.dataAgendamento)})`}
                heightClass="h-72 sm:h-80"
              />
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: RELATÓRIO INDIVIDUAL DE PERCURSOS POR ALUNO E INSTRUTOR            */}
      {/* ========================================================================= */}
      {activeTab === 'RELATORIO' && (
        <div className="space-y-5 min-w-0">
          {/* Filtros do Relatório (Alunos sempre em ordem alfabética) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              {(isMaster || currentUser.papel === 'ADMIN_ORG') && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Filtrar por Instrutor:
                  </label>
                  <select
                    aria-label="Filtrar relatório por instrutor"
                    value={reportInstructorFilter}
                    onChange={(e) => setReportInstructorFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold"
                  >
                    <option value="TODOS">Todos os Instrutores</option>
                    {instructorsForFilter.map((inst) => (
                      <option key={inst.id} value={inst.id}>
                        {inst.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!isStudent && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Filtrar por Aluno (Ordem Alfabética):
                  </label>
                  <select
                    aria-label="Filtrar relatório por aluno"
                    value={reportStudentFilter}
                    onChange={(e) => setReportStudentFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white text-xs font-semibold"
                  >
                    <option value="TODOS">Todos os Alunos ({visibleStudents.length})</option>
                    {visibleStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nome} (CNH {st.categoriaCnh})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="text-xs text-slate-600 font-semibold bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 shrink-0">
              Total listado: <strong className="text-slate-900">{filteredReportCheckins.length}</strong> registro(s)
            </div>
          </div>

          {filteredReportCheckins.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Nenhum registro de Check-in GPS encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Lista de registros individuais */}
              <div className="lg:col-span-5 space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
                {filteredReportCheckins.map((rec) => {
                  const isSelected = selectedReportRecord?.id === rec.id;
                  return (
                    <button
                      key={rec.id}
                      type="button"
                      onClick={() => setSelectedReportCheckinId(rec.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-1 ring-blue-500/30'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-extrabold text-sm text-slate-900 truncate">{rec.alunoNome}</p>
                          <p className="text-xs text-slate-600 truncate">Instrutor: {rec.instrutorNome}</p>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                            rec.status === 'FINALIZADO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {rec.status === 'FINALIZADO' ? 'FINALIZADA' : 'EM ANDAMENTO'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 font-mono flex flex-wrap gap-x-3 gap-y-1">
                        <span>📅 {formatDateBR(rec.dataAgendamento)}</span>
                        <span>
                          ⏰ {rec.horaInicioAgendamento} - {rec.horaFimAgendamento}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">Total</span>
                          <strong className="font-mono text-slate-900">
                            {formatDurationHMS(rec.tempoTotalSegundos)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Deslocamento</span>
                          <strong className="font-mono text-blue-700">
                            {formatDurationHMS(rec.tempoDeslocamentoSegundos)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Parada</span>
                          <strong className="font-mono text-amber-700">
                            {formatDurationHMS(rec.tempoParadaSegundos)}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Percurso</span>
                          <strong className="font-mono text-emerald-700">{rec.distanciaKm.toFixed(2)} km</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] pt-1 text-blue-700 font-bold">
                        <span>
                          {rec.modoHardware === 'LOW_SPEC_DEFERRED_MAP'
                            ? 'Modo Hardware Limitado (Mapa pós-aula)'
                            : 'Mapa Ao Vivo'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visualizar Mapa</span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Painel de Visualização do Mapa do Percurso Selecionado */}
              <div className="lg:col-span-7 space-y-3">
                {selectedReportRecord && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                          Percurso: {selectedReportRecord.alunoNome}
                        </h3>
                        <p className="text-xs text-slate-600">
                          Instrutor: <strong>{selectedReportRecord.instrutorNome}</strong> · Agendamento:{' '}
                          <strong className="font-mono">
                            {formatDateBR(selectedReportRecord.dataAgendamento)} às{' '}
                            {selectedReportRecord.horaInicioAgendamento} - {selectedReportRecord.horaFimAgendamento}
                          </strong>
                        </p>
                      </div>
                      <div className="text-right text-xs font-mono">
                        <span className="block text-slate-500">
                          Check-in: {new Date(selectedReportRecord.checkinEm).toLocaleTimeString('pt-BR')}
                        </span>
                        {selectedReportRecord.checkoutEm && (
                          <span className="block text-emerald-700 font-bold">
                            Check-out: {new Date(selectedReportRecord.checkoutEm).toLocaleTimeString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>

                    <LessonRouteMap
                      points={selectedReportRecord.coordenadas || []}
                      title={`Trajeto do Dia ${formatDateBR(selectedReportRecord.dataAgendamento)} (${selectedReportRecord.distanciaKm.toFixed(
                        2
                      )} km)`}
                      heightClass="h-72 sm:h-96"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
