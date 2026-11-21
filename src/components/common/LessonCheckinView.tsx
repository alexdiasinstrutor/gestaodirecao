import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Compass,
  Radio,
  X
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
  generateSimulatedGpsStep,
  filterEligibleCheckinLessons,
  shouldAcceptGpsPoint
} from '../../lib/lessonCheckinService';
import { mobileGpsKeepAlive, MobileKeepAliveStatus } from '../../lib/mobileGpsKeepAlive';
import {
  getSaaSPlans,
  configureModuleAcrossPlans
} from '../../lib/saasPlans';
import { LessonRouteMap } from './LessonRouteMap';
import { resolveStudentIdentity } from '../../legal/studentIdentity';

interface LessonCheckinViewProps {
  currentUser: User;
  currentOrg: Organization;
  initialTab?: CheckinTab;
}

type ViewDisplayMode = 'AMBOS' | 'TEMPO' | 'MAPA';
type CheckinTab = 'OPERACAO' | 'RELATORIO';

const DISPLAY_MODE_STORAGE_KEY = 'agd_checkin_display_mode_v1';

export const LessonCheckinView: React.FC<LessonCheckinViewProps> = ({
  currentUser,
  currentOrg,
  initialTab = 'OPERACAO'
}) => {
  const orgId = currentOrg?.id || currentUser.organizacaoId || 'org_direcao_certa_01';
  const isMaster =
    currentUser.papel === 'SUPER_ADMIN' || currentUser.email.toLowerCase() === 'cassiordcosta@gmail.com';
  const isStudent = currentUser.papel === 'ALUNO';

  const [activeTab, setActiveTab] = useState<CheckinTab>(initialTab);
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const [dataVersion, setDataVersion] = useState<number>(0);

  // Persist view display mode preference so upgrades/reloads never reset user setup
  const [viewDisplayMode, setViewDisplayMode] = useState<ViewDisplayMode>(() => {
    try {
      const saved = localStorage.getItem(DISPLAY_MODE_STORAGE_KEY);
      if (saved === 'AMBOS' || saved === 'TEMPO' || saved === 'MAPA') return saved;
    } catch {
      // ignore
    }
    return 'AMBOS';
  });

  const handleChangeViewDisplayMode = (mode: ViewDisplayMode) => {
    setViewDisplayMode(mode);
    try {
      localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  };

  // Master validation & hardware contingency simulation controls
  const [forceLowSpecSimulation, setForceLowSpecSimulation] = useState<boolean>(false);
  const [geoPermissionState, setGeoPermissionState] = useState<
    'IDLE' | 'REQUESTING' | 'GRANTED' | 'DENIED' | 'UNSUPPORTED'
  >('IDLE');
  const [geoNotice, setGeoNotice] = useState<string>('');
  const [statusFeedback, setStatusFeedback] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  // Sync feedback state for both header "Sincronizar" and report "Sincronizar Relatório"
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Preview GPS point so live map centers on current location even before check-in starts
  const [previewGpsPoint, setPreviewGpsPoint] = useState<LessonGpsPoint | null>(null);

  // Mobile background keep-alive status (Wake Lock + silent background audio)
  const [keepAliveStatus, setKeepAliveStatus] = useState<MobileKeepAliveStatus>(() =>
    mobileGpsKeepAlive.getStatus()
  );

  // Post-checkout finished summary (especially important when live map was deferred due to low hardware!)
  const [lastCompletedCheckin, setLastCompletedCheckin] = useState<LessonCheckinRecord | null>(null);

  // Optional evaluation fields on checkout (instructor/master)
  const [checkoutGrade, setCheckoutGrade] = useState<number>(9);
  const [checkoutNote, setCheckoutNote] = useState<string>('');

  // Live clock seconds when check-in is active
  const [liveElapsedSec, setLiveElapsedSec] = useState<number>(0);
  const watchIdRef = useRef<number | null>(null);
  const lastGpsUpdateMsRef = useRef<number>(0);
  const lastCloudFlushMsRef = useRef<number>(0);
  const activeCheckinIdRef = useRef<string | null>(null);

  // Reports filters & on-demand opened route (table grid -> click to open route/map)
  const [reportInstructorFilter, setReportInstructorFilter] = useState<string>(() =>
    !isMaster && !isStudent ? currentUser.id : 'TODOS'
  );
  const [reportStudentFilter, setReportStudentFilter] = useState<string>('TODOS');
  const [openedReportCheckinId, setOpenedReportCheckinId] = useState<string | null>(null);
  const reportDetailRef = useRef<HTMLDivElement | null>(null);

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

  // Run auto-completion on mount so past scheduled lessons move to report/concluded instead of staying selectable
  useEffect(() => {
    try {
      const autoCount = db.autoCompleteElapsedLessons({ orgId, actorId: currentUser.id });
      if (autoCount > 0) {
        setDataVersion((v) => v + 1);
      }
    } catch (err) {
      console.error('Erro ao verificar aulas vencidas:', err);
    }
  }, [orgId, currentUser.id]);

  // Subscribe to mobile keep-alive status and cleanup on unmount
  useEffect(() => {
    const unsub = mobileGpsKeepAlive.subscribe(setKeepAliveStatus);
    return () => {
      unsub();
      void mobileGpsKeepAlive.stop();
    };
  }, []);

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

  // Real cloud sync action shared by header "Sincronizar" and Report "Sincronizar Relatório"
  const handleSyncNow = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const res = await syncFromSupabase();
      try {
        db.autoCompleteElapsedLessons({ orgId, actorId: currentUser.id });
      } catch {
        // ignore auto-complete errors during sync
      }
      setPlansSnapshot(getSaaSPlans());
      setDataVersion((v) => v + 1);

      if (res.synced) {
        const timeStr = new Date().toLocaleTimeString('pt-BR');
        setLastSyncedAt(timeStr);
        const total = db.getLessonCheckins(orgId).length;
        setStatusFeedback({
          text:
            res.failedCount && res.failedCount > 0
              ? `Sincronizado às ${timeStr} (${total} percurso(s)), mas ${res.failedCount} item(ns) aguardam nova tentativa.`
              : `Sincronismo concluído com sucesso às ${timeStr} (${total} percurso(s) na base).`,
          type: res.failedCount && res.failedCount > 0 ? 'info' : 'success'
        });
      } else {
        setStatusFeedback({
          text: `Falha ao sincronizar com o banco: ${res.error || 'verifique sua conexão com a internet.'}`,
          type: 'error'
        });
      }
    } catch (err: any) {
      setStatusFeedback({
        text: `Erro durante o sincronismo: ${err?.message || 'tente novamente.'}`,
        type: 'error'
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, orgId, currentUser.id]);

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

  // Scheduled/active lessons eligible for check-in: ONLY future scheduled lessons or current active check-in
  const candidateLessons = useMemo(() => {
    const futureOrActive = filterEligibleCheckinLessons(allLessons, checkins, Date.now());
    const roleScoped = futureOrActive.filter((l) => {
      if (isStudent) return loggedStudent ? l.alunoId === loggedStudent.id : false;
      if (!isMaster && currentUser.papel === 'INSTRUTOR') {
        return !l.instrutorId || l.instrutorId === currentUser.id;
      }
      return true;
    });

    return roleScoped.sort((a, b) => {
      const aActive = a.status === 'EM_ANDAMENTO' ? 0 : 1;
      const bActive = b.status === 'EM_ANDAMENTO' ? 0 : 1;
      if (aActive !== bActive) return aActive - bActive;
      return `${a.data}_${a.horaInicio}`.localeCompare(`${b.data}_${b.horaInicio}`);
    });
  }, [allLessons, checkins, isStudent, loggedStudent, isMaster, currentUser.papel, currentUser.id]);

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

  // Optional non-blocking preview GPS point when live map is displayed prior to starting check-in
  useEffect(() => {
    if (activeCheckin || !hardwareCheck.canRunLiveMap || activeTab !== 'OPERACAO') return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setPreviewGpsPoint({
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
          timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
          speedKmh:
            pos.coords.speed !== null && Number.isFinite(pos.coords.speed)
              ? Math.max(0, Math.round(pos.coords.speed * 3.6))
              : 0,
          accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : undefined
        });
      },
      () => {
        // Silent ignore before explicit check-in start
      },
      { enableHighAccuracy: false, timeout: 4000, maximumAge: 15000 }
    );
    return () => {
      cancelled = true;
    };
  }, [activeCheckin?.id, hardwareCheck.canRunLiveMap, activeTab]);

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

  // Helper to ingest a geolocation position safely into active check-in
  const ingestPosition = useCallback(
    (pos: GeolocationPosition, forceCloudFlush = false) => {
      const targetId = activeCheckinIdRef.current;
      if (!targetId) return;

      setGeoPermissionState('GRANTED');
      setGeoNotice('');

      const latestCheckin = db
        .getLessonCheckins(orgId)
        .find((c) => c.id === targetId && c.status === 'EM_ANDAMENTO');
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

      setPreviewGpsPoint(point);

      if (!shouldAcceptGpsPoint(coords, point)) {
        return;
      }

      lastGpsUpdateMsRef.current = Date.now();
      const nextPoints = [...coords, point];
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(latestCheckin.checkinEm).getTime()) / 1000)
      );
      const telemetry = computeRouteTelemetry(nextPoints, elapsed);

      const nowMs = Date.now();
      const shouldFlushCloud =
        forceCloudFlush || coords.length === 0 || nowMs - lastCloudFlushMsRef.current >= 15000;
      if (shouldFlushCloud) {
        lastCloudFlushMsRef.current = nowMs;
      }

      db.updateLessonCheckinProgress(
        latestCheckin.id,
        {
          coordenadas: nextPoints,
          tempoTotalSegundos: telemetry.totalSeconds,
          tempoDeslocamentoSegundos: telemetry.movingSeconds,
          tempoParadaSegundos: telemetry.stoppedSeconds,
          distanciaKm: telemetry.distanceKm
        },
        { persistRemote: shouldFlushCloud }
      );
      setDataVersion((v) => v + 1);
    },
    [orgId]
  );

  // Mobile GPS watcher + Wake Lock + background/lock recovery while check-in is active
  useEffect(() => {
    activeCheckinIdRef.current = activeCheckin?.id || null;

    const clearWatcher = () => {
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };

    if (!activeCheckin) {
      clearWatcher();
      return;
    }

    lastGpsUpdateMsRef.current = Date.now();

    // Ensure Wake Lock / background session stays engaged even after page reload
    if (!mobileGpsKeepAlive.getStatus().active) {
      void mobileGpsKeepAlive.start(activeCheckin.alunoNome);
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPermissionState('UNSUPPORTED');
      return;
    }

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

    const startWatcher = () => {
      clearWatcher();
      try {
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => ingestPosition(pos, false),
          onError,
          {
            enableHighAccuracy: true,
            maximumAge: 3000,
            timeout: 15000
          }
        );
      } catch {
        setGeoPermissionState('UNSUPPORTED');
      }
    };

    const requestImmediatePosition = (forceCloud: boolean) => {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => ingestPosition(pos, forceCloud),
          () => {
            // fallback standard accuracy
            navigator.geolocation.getCurrentPosition(
              (pos) => ingestPosition(pos, forceCloud),
              () => {},
              { enableHighAccuracy: false, timeout: 6000, maximumAge: 15000 }
            );
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 4000 }
        );
      } catch {
        // ignore
      }
    };

    startWatcher();
    if ((activeCheckin.coordenadas || []).length === 0) {
      requestImmediatePosition(true);
    }

    // Heartbeat fallback every 8s if watchPosition stalls
    const heartbeatId = setInterval(() => {
      if (Date.now() - lastGpsUpdateMsRef.current >= 8000) {
        requestImmediatePosition(false);
      }
    }, 8000);

    // Flush to cloud before backgrounding & recover watcher/WakeLock immediately upon screen unlock
    const flushNowOnHide = () => {
      const latest = db
        .getLessonCheckins(orgId)
        .find((c) => c.id === activeCheckin.id && c.status === 'EM_ANDAMENTO');
      if (!latest) return;
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - new Date(latest.checkinEm).getTime()) / 1000)
      );
      const telemetry = computeRouteTelemetry(latest.coordenadas || [], elapsed);
      lastCloudFlushMsRef.current = Date.now();
      db.updateLessonCheckinProgress(
        latest.id,
        {
          tempoTotalSegundos: telemetry.totalSeconds,
          tempoDeslocamentoSegundos: telemetry.movingSeconds,
          tempoParadaSegundos: telemetry.stoppedSeconds,
          distanciaKm: telemetry.distanceKm
        },
        { persistRemote: true }
      );
    };

    const handleWakeRecovery = () => {
      void mobileGpsKeepAlive.refreshOnVisibility(activeCheckin.alunoNome);
      startWatcher();
      requestImmediatePosition(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushNowOnHide();
      } else if (document.visibilityState === 'visible') {
        handleWakeRecovery();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWakeRecovery);
    window.addEventListener('pageshow', handleWakeRecovery);
    window.addEventListener('pagehide', flushNowOnHide);
    window.addEventListener('online', handleWakeRecovery);

    return () => {
      clearInterval(heartbeatId);
      clearWatcher();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWakeRecovery);
      window.removeEventListener('pageshow', handleWakeRecovery);
      window.removeEventListener('pagehide', flushNowOnHide);
      window.removeEventListener('online', handleWakeRecovery);
    };
  }, [activeCheckin?.id, activeCheckin?.alunoNome, orgId, ingestPosition]);

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
        text: 'Selecione uma aula agendada futura para iniciar o check-in.',
        type: 'error'
      });
      return;
    }

    setLastCompletedCheckin(null);
    setGeoPermissionState('REQUESTING');

    // Start Wake Lock & silent background audio inside user gesture so browser keeps GPS alive in background
    void mobileGpsKeepAlive.start(selectedLessonStudent.nome);

    let initialPoint: LessonGpsPoint | undefined;
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      const readPos = (highAccuracy: boolean, timeout: number) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout,
            maximumAge: highAccuracy ? 4000 : 15000
          });
        });

      try {
        let pos: GeolocationPosition;
        try {
          pos = await readPos(true, 6000);
        } catch (err: any) {
          if (err?.code === 1) throw err; // PERMISSION_DENIED
          pos = await readPos(false, 5000);
        }
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
        setPreviewGpsPoint(initialPoint);
      } catch (err: any) {
        if (err?.code === 1) {
          setGeoPermissionState('DENIED');
          setGeoNotice(
            'Acesso ao GPS não foi autorizado. O cronômetro foi iniciado; conceda acesso à localização para gravar o trajeto.'
          );
        } else {
          setGeoPermissionState('IDLE');
          setGeoNotice('Buscando sinal de satélite GPS em segundo plano...');
        }
      }
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
      text: `Check-in iniciado às ${new Date(record.checkinEm).toLocaleTimeString('pt-BR')}! Tempo e GPS em monitoramento contínuo.`,
      type: 'success'
    });
    setDataVersion((v) => v + 1);
  };

  const handleCheckoutLesson = () => {
    if (!activeCheckin) return;
    void mobileGpsKeepAlive.stop();

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
    db.updateLessonCheckinProgress(
      activeCheckin.id,
      {
        coordenadas: nextPoints,
        tempoTotalSegundos: telemetry.totalSeconds,
        tempoDeslocamentoSegundos: telemetry.movingSeconds,
        tempoParadaSegundos: telemetry.stoppedSeconds,
        distanciaKm: telemetry.distanceKm
      },
      { persistRemote: true }
    );
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

    // Garante que a aula de teste criada tenha horário de término no futuro (para aparecer nas aulas elegíveis)
    const now = new Date();
    const candidateDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    let targetHour = now.getHours();
    if (now.getMinutes() >= 45 || targetHour < 6) {
      targetHour = now.getMinutes() >= 45 ? targetHour + 1 : 8;
    }
    if (targetHour > 23) {
      candidateDate.setDate(candidateDate.getDate() + 1);
      targetHour = 8;
    }

    const instrutorId =
      targetStudent.instrutorId ||
      allUsers.find((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG')?.id ||
      currentUser.id;
    const veiculoId = vehicles[0]?.id || 'veh_simulado_01';

    let createdLesson: Lesson | null = null;
    for (let attempt = 0; attempt < 16; attempt++) {
      const h = targetHour + attempt;
      if (h > 23) break;
      const dateStr = `${candidateDate.getFullYear()}-${String(candidateDate.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(candidateDate.getDate()).padStart(2, '0')}`;
      const horaInicio = `${String(h).padStart(2, '0')}:00`;
      const horaFim = `${String(h).padStart(2, '0')}:50`;

      const testLesson: Lesson = {
        id: `lsn_val_${Date.now()}_${attempt}`,
        organizacaoId: orgId,
        alunoId: targetStudent.id,
        instrutorId,
        veiculoId,
        data: dateStr,
        horaInicio,
        horaFim,
        topico: 'Validação Master — Circuito GPS, Tempo em Movimento e Paradas',
        status: 'AGENDADA',
        criadoEm: new Date().toISOString()
      };

      const res = db.createLesson(testLesson, currentUser.id);
      if (res.success) {
        createdLesson = testLesson;
        break;
      }
    }

    if (createdLesson) {
      setSelectedLessonId(createdLesson.id);
      setStatusFeedback({
        text: `Aula de teste criada para ${targetStudent.nome} em ${formatDateBR(createdLesson.data)} às ${createdLesson.horaInicio}. Clique em "Iniciar Check-in da Aula" para testar.`,
        type: 'success'
      });
    } else {
      setStatusFeedback({
        text: 'Já existem aulas futuras disponíveis na lista acima para iniciar o Check-in.',
        type: 'info'
      });
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

  // Only open a report record/map when user explicitly clicks a row / "Abrir Percurso"
  const openedReportRecord = useMemo(
    () =>
      openedReportCheckinId
        ? filteredReportCheckins.find((c) => c.id === openedReportCheckinId) || null
        : null,
    [filteredReportCheckins, openedReportCheckinId]
  );

  const handleOpenReportRecord = (checkinId: string) => {
    setOpenedReportCheckinId(checkinId);
    setTimeout(() => {
      reportDetailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

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
              Controle de início e término de aula com medidor de tempo em deslocamento/parada, rastreamento contínuo no celular, registro individual por aluno e verificação anti-falha de hardware.
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
              onClick={() => {
                void handleSyncNow();
              }}
              disabled={isSyncing}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Sincronizar registros com a nuvem"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Feedback de operação */}
      {statusFeedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            statusFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : statusFeedback.type === 'error'
              ? 'bg-rose-50 border-rose-300 text-rose-900'
              : 'bg-blue-50 border-blue-300 text-blue-900'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{statusFeedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            aria-label="Fechar aviso"
            className="p-1 rounded-lg hover:bg-black/5 shrink-0 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
                  Teste o fluxo completo de Check-in, Telemetria GPS e Fallback de Hardware e gerencie a liberação nos pacotes de assinatura dos instrutores e alunos.
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
                  onClick={() => handleChangeViewDisplayMode('AMBOS')}
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
                  onClick={() => handleChangeViewDisplayMode('TEMPO')}
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
                  onClick={() => handleChangeViewDisplayMode('MAPA')}
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
                  Selecione a Aula Agendada (Próximas Aulas) para Iniciar o Check-in:
                </label>
                {candidateLessons.length === 0 ? (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-600">
                    Nenhuma aula futura agendada disponível para check-in. Aulas cujo horário já encerrou ficam registradas na aba{' '}
                    <strong>Relatório de Percursos</strong> (e continuam sendo computadas automaticamente na Agenda).
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
                    <span
                      className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-bold flex items-center gap-1"
                      title="Proteção ativa contra suspensão de tela e perda de GPS no celular"
                    >
                      <Radio className="w-3.5 h-3.5 text-blue-600" />
                      <span>{keepAliveStatus.detail}</span>
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
                  previewPoint={previewGpsPoint}
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
      {/* ABA 2: RELATÓRIO INDIVIDUAL DE PERCURSOS EM GRID + ABERTURA SOB DEMANDA   */}
      {/* ========================================================================= */}
      {activeTab === 'RELATORIO' && (
        <div className="space-y-5 min-w-0">
          {/* Filtros do Relatório + Botão Sincronizar Relatório */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col lg:flex-row lg:items-end justify-between gap-3">
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

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <div className="text-xs text-slate-600 font-semibold bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                Total listado: <strong className="text-slate-900">{filteredReportCheckins.length}</strong> registro(s)
              </div>
              <button
                type="button"
                onClick={() => {
                  void handleSyncNow();
                }}
                disabled={isSyncing}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title={
                  lastSyncedAt
                    ? `Último sincronismo às ${lastSyncedAt}. Clique para atualizar relatório de percursos.`
                    : 'Sincronizar relatório de percursos com o banco'
                }
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar Relatório'}</span>
              </button>
            </div>
          </div>

          {filteredReportCheckins.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
              Nenhum registro de Check-in GPS encontrado para os filtros selecionados.
            </div>
          ) : (
            <>
              {/* Grid Responsivo de Percursos Registrados (Carrega dados/mapa ao selecionar) */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-slate-800">
                    Grade de Aulas & Percursos Registrados
                  </span>
                  <span className="text-slate-500">
                    Selecione uma linha ou clique em <strong>Abrir Percurso</strong> para carregar os dados e o mapa completo.
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 whitespace-nowrap">Data / Horário</th>
                        <th className="py-2.5 px-3">Aluno</th>
                        <th className="py-2.5 px-3">Instrutor</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Tempo Total</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Deslocamento / Parada</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Distância</th>
                        <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                        <th className="py-2.5 px-3 text-right whitespace-nowrap">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredReportCheckins.map((rec) => {
                        const isOpened = openedReportCheckinId === rec.id;
                        return (
                          <tr
                            key={rec.id}
                            onClick={() => handleOpenReportRecord(rec.id)}
                            className={`cursor-pointer transition-colors ${
                              isOpened
                                ? 'bg-blue-50/90 font-medium'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="py-3 px-3 whitespace-nowrap font-mono">
                              <span className="font-bold text-slate-900 block">
                                {formatDateBR(rec.dataAgendamento)}
                              </span>
                              <span className="text-[11px] text-slate-500">
                                {rec.horaInicioAgendamento} - {rec.horaFimAgendamento}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900 min-w-[150px]">
                              {rec.alunoNome}
                            </td>
                            <td className="py-3 px-3 text-slate-600 min-w-[150px]">
                              {rec.instrutorNome}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono font-bold text-slate-900">
                              {formatDurationHMS(rec.tempoTotalSegundos)}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono text-[11px]">
                              <span className="text-blue-700 font-semibold block">
                                Mov: {formatDurationHMS(rec.tempoDeslocamentoSegundos)}
                              </span>
                              <span className="text-amber-700 font-semibold block">
                                Par: {formatDurationHMS(rec.tempoParadaSegundos)}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap font-mono font-extrabold text-emerald-700">
                              {rec.distanciaKm.toFixed(2)} km
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                                  rec.status === 'FINALIZADO'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {rec.status === 'FINALIZADO' ? 'FINALIZADA' : 'EM ANDAMENTO'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isOpened) {
                                    setOpenedReportCheckinId(null);
                                  } else {
                                    handleOpenReportRecord(rec.id);
                                  }
                                }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                  isOpened
                                    ? 'bg-slate-800 text-white'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isOpened ? 'Fechar Percurso' : 'Abrir Percurso'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Painel Sob Demanda: Carrega Informações Detalhadas & Mapa Apenas Ao Selecionar */}
              {openedReportRecord && (
                <div
                  ref={reportDetailRef}
                  className="bg-white rounded-2xl border-2 border-blue-200 p-4 sm:p-5 shadow-md space-y-4 animate-in fade-in"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-extrabold uppercase">
                        Detalhes e Trajeto do Percurso
                      </span>
                      <h3 className="text-base sm:text-lg font-extrabold text-slate-900">
                        {openedReportRecord.alunoNome}
                      </h3>
                      <p className="text-xs text-slate-600">
                        Instrutor: <strong>{openedReportRecord.instrutorNome}</strong> · Agendamento:{' '}
                        <strong className="font-mono">
                          {formatDateBR(openedReportRecord.dataAgendamento)} às{' '}
                          {openedReportRecord.horaInicioAgendamento} - {openedReportRecord.horaFimAgendamento}
                        </strong>
                      </p>
                      {openedReportRecord.topicoAula && (
                        <p className="text-xs text-slate-500">
                          Conteúdo: <strong>{openedReportRecord.topicoAula}</strong>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:items-end gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenedReportCheckinId(null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold cursor-pointer self-start sm:self-end"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Fechar Percurso</span>
                      </button>
                      <div className="text-xs font-mono sm:text-right">
                        <span className="block text-slate-500">
                          Check-in: {new Date(openedReportRecord.checkinEm).toLocaleTimeString('pt-BR')}
                        </span>
                        {openedReportRecord.checkoutEm && (
                          <span className="block text-emerald-700 font-bold">
                            Check-out: {new Date(openedReportRecord.checkoutEm).toLocaleTimeString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Resumo Numérico do Percurso */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-slate-500 block">Tempo Total</span>
                      <strong className="font-mono text-sm text-slate-900">
                        {formatDurationHMS(openedReportRecord.tempoTotalSegundos)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                      <span className="text-blue-700 block">Em Deslocamento</span>
                      <strong className="font-mono text-sm text-blue-900">
                        {formatDurationHMS(openedReportRecord.tempoDeslocamentoSegundos)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="text-amber-700 block">Tempo de Parada</span>
                      <strong className="font-mono text-sm text-amber-900">
                        {formatDurationHMS(openedReportRecord.tempoParadaSegundos)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                      <span className="text-emerald-700 block">Distância & Pontos</span>
                      <strong className="font-mono text-sm text-emerald-900">
                        {openedReportRecord.distanciaKm.toFixed(2)} km ({(openedReportRecord.coordenadas || []).length} pts)
                      </strong>
                    </div>
                  </div>

                  <LessonRouteMap
                    points={openedReportRecord.coordenadas || []}
                    title={`Trajeto do Dia ${formatDateBR(openedReportRecord.dataAgendamento)} (${openedReportRecord.distanciaKm.toFixed(
                      2
                    )} km)`}
                    heightClass="h-72 sm:h-96"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
