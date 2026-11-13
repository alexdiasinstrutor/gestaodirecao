import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Car,
  Calendar,
  Clock,
  Award,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  BellRing,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  User,
  Phone,
  ShieldCheck,
  X,
  LayoutGrid,
  Ticket,
  Tag,
  Sparkles,
  CalendarClock,
  MessageCircle
} from 'lucide-react';
import { db, syncFromSupabase } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generatePixCopiaECola, getPixQrCodeImageUrl, buildWhatsAppLink } from '../../lib/whatsapp';
import {
  Student,
  User as UserType,
  Organization,
  Lesson,
  AvailableSlot,
  AccountReceivable,
  StudentNotification
} from '../../types';
import type { CouponValidationContext } from '../../lib/coupons';

interface StudentPortalProps {
  currentUser: UserType;
  currentOrg: Organization;
  isSimplified?: boolean;
  onSwitchToFullMode?: () => void;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({
  currentUser,
  currentOrg,
  isSimplified = false,
  onSwitchToFullMode
}) => {
  const orgId = currentOrg.id;
  const [studentMobileTab, setStudentMobileTab] = useState<'BOOK' | 'PIX' | 'PROGRESS'>('BOOK');
  const [portalVersion, setPortalVersion] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const bookingSectionRef = useRef<HTMLDivElement | null>(null);

  // Sincronização automática em tempo real para receber atualizações da agenda e notificações do instrutor
  useEffect(() => {
    const refreshFromCloud = () => {
      syncFromSupabase()
        .then(() => setPortalVersion((v) => v + 1))
        .catch(() => { });
    };

    refreshFromCloud();

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshFromCloud();
      }
    }, 8000);

    const handleLocalUpdate = () => setPortalVersion((v) => v + 1);

    window.addEventListener('agd:data-synced', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);
    window.addEventListener('focus', refreshFromCloud);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('agd:data-synced', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      window.removeEventListener('focus', refreshFromCloud);
    };
  }, []);

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await syncFromSupabase();
      setPortalVersion((v) => v + 1);
    } finally {
      setTimeout(() => setIsSyncing(false), 400);
    }
  };

  // Find student entity matching this user (by email or id)
  const students = useMemo(() => db.getStudents(orgId), [orgId, portalVersion]);
  const student = useMemo(
    () =>
      students.find((s) => s.email.toLowerCase() === currentUser.email.toLowerCase()) ||
      students.find((s) => s.id === currentUser.id) ||
      students[0],
    [students, currentUser.email, currentUser.id]
  );

  const instructor = useMemo(
    () => db.getUsers(orgId).find((u) => u.id === student?.instrutorId) || db.getUsers(orgId)[1],
    [orgId, student?.instrutorId, portalVersion]
  );
  const pixConfig = db.getEffectivePixConfig(currentOrg, instructor);
  const vehicles = useMemo(() => db.getVehicles(orgId), [orgId, portalVersion]);
  const lessons = useMemo(
    () => db.getLessonsByStudent(student?.id || ''),
    [student?.id, portalVersion]
  );
  const accounts = useMemo(() => {
    return db.getAccountsReceivable(orgId).filter((a) => a.alunoId === student?.id);
  }, [orgId, student?.id, portalVersion]);

  // Notificações de aulas desmarcadas pelo instrutor
  const studentNotifications = useMemo(
    () => (student ? db.getStudentNotifications(student.id) : []),
    [student?.id, portalVersion]
  );
  const unreadNotifications = useMemo(
    () => studentNotifications.filter((n) => !n.lida),
    [studentNotifications]
  );

  // Coupon states for Student
  const [couponCodeInput, setCouponCodeInput] = useState<string>('');
  const [couponTargetAccId, setCouponTargetAccId] = useState<string | null>(null);
  const [couponFeedback, setCouponFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState<boolean>(false);

  // Scheduling states
  const [scheduleDate, setScheduleDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingTopic, setBookingTopic] = useState<string>('Treino de Baliza e Circuito de Exame');
  const [scheduleSuccess, setScheduleSuccess] = useState<string>('');
  const [scheduleError, setScheduleError] = useState<string>('');

  // PIX Payment Modal State
  const [showPixModal, setShowPixModal] = useState<boolean>(false);
  const [selectedAccountForPix, setSelectedAccountForPix] = useState<AccountReceivable | null>(null);
  const [pixCopied, setPixCopied] = useState<boolean>(false);
  const [chaveCopied, setChaveCopied] = useState<boolean>(false);

  // Available slots for selected date (filtrados estritamente pelo instrutor vinculado ao aluno)
  const allSlots = useMemo(
    () => db.getSlots(orgId, student?.instrutorId),
    [orgId, student?.instrutorId, portalVersion]
  );
  const allOrgLessons = useMemo(
    () => db.getLessons(orgId),
    [orgId, portalVersion]
  );

  const availableSlotsOnDate = useMemo(
    () =>
      allSlots.filter((slot) => {
        if (slot.data !== scheduleDate) return false;
        if (slot.bloqueado) return false;

        // Verifica se já existe aula ativa agendada para este instrutor neste horário
        const isBooked = allOrgLessons.some(
          (l) =>
            l.data === scheduleDate &&
            l.horaInicio === slot.horaInicio &&
            l.status !== 'CANCELADA' &&
            (!l.instrutorId || !student?.instrutorId || l.instrutorId === student.instrutorId)
        );
        return !isBooked;
      }),
    [allSlots, allOrgLessons, scheduleDate, student?.instrutorId]
  );

  // Próximas datas com horários livres liberados pelo instrutor (para facilitar o reagendamento)
  const upcomingDatesWithFreeSlots = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const dateCounts = new Map<string, number>();

    for (const slot of allSlots) {
      if (slot.data < todayStr || slot.bloqueado) continue;
      const isBooked = allOrgLessons.some(
        (l) =>
          l.data === slot.data &&
          l.horaInicio === slot.horaInicio &&
          l.status !== 'CANCELADA' &&
          (!l.instrutorId || !student?.instrutorId || l.instrutorId === student.instrutorId)
      );
      if (!isBooked) {
        dateCounts.set(slot.data, (dateCounts.get(slot.data) || 0) + 1);
      }
    }

    return Array.from(dateCounts.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([dt, count]) => ({ date: dt, count }));
  }, [allSlots, allOrgLessons, student?.instrutorId]);

  const handleMarkNotificationRead = async (notifId: string) => {
    await db.markStudentNotificationReadAsync(notifId);
    setPortalVersion((v) => v + 1);
  };

  const handleRescheduleFromNotification = async (notif: StudentNotification) => {
    setStudentMobileTab('BOOK');
    if (upcomingDatesWithFreeSlots.length > 0) {
      setScheduleDate(upcomingDatesWithFreeSlots[0].date);
    }
    setSelectedSlot(null);
    await db.markStudentNotificationReadAsync(notif.id);
    setPortalVersion((v) => v + 1);
    setTimeout(() => {
      bookingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const progressPercent = student && (student.totalAulasContratadas || 0) > 0
    ? Math.min(100, Math.round(((student.aulasCumpridas || 0) / (student.totalAulasContratadas || 20)) * 100))
    : 0;

  // Registro automático das aulas já finalizadas (mesma regra do instrutor, idempotente)
  useEffect(() => {
    if (!student?.id) return;
    const run = () => {
      try {
        const count = db.autoCompleteElapsedLessons({ alunoId: student.id, actorId: currentUser.id });
        if (count > 0) setPortalVersion((v) => v + 1);
      } catch (err) {
        console.error('Falha no registro automático de aulas:', err);
      }
    };
    run();
    const id = setInterval(run, 60000);
    return () => clearInterval(id);
  }, [student?.id, currentUser.id]);

  // Registro de aulas realizadas do aluno (numeradas conforme o plano)
  const completedLessonsRegistry = useMemo(() => {
    const done = lessons
      .filter((l) => l.status === 'CONCLUIDA')
      .sort((a, b) => `${a.data}_${a.horaInicio}`.localeCompare(`${b.data}_${b.horaInicio}`));
    const offset = Math.max(0, (Number(student?.aulasCumpridas) || 0) - done.length);
    return done.map((l, i) => ({ lesson: l, numero: offset + i + 1 })).reverse();
  }, [lessons, student?.aulasCumpridas]);

  const handleBookLesson = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError('');
    setScheduleSuccess('');

    if (!selectedSlot) {
      setScheduleError('Selecione um horário disponível para agendar sua aula.');
      return;
    }

    const parts = selectedSlot.split(':');
    const hour = parseInt(parts[0], 10);
    const endTime = `${String(hour).padStart(2, '0')}:50`;

    const vehicleId = vehicles[0]?.id || 'veh_onix_01';

    const newLesson: Lesson = {
      id: `lsn_${Date.now()}`,
      organizacaoId: orgId,
      alunoId: student.id,
      instrutorId: student.instrutorId,
      veiculoId: vehicleId,
      data: scheduleDate,
      horaInicio: selectedSlot,
      horaFim: endTime,
      topico: bookingTopic.trim() || 'Aula Prática de Direção',
      status: 'AGENDADA',
      criadoEm: new Date().toISOString()
    };

    const res = db.createLesson(newLesson, currentUser.id);
    if (!res.success) {
      setScheduleError(res.error || 'Não foi possível agendar esta aula.');
      return;
    }

    setSelectedSlot(null);
    setPortalVersion((v) => v + 1);
    setScheduleSuccess(`Aula prática agendada com sucesso para ${formatDateBR(scheduleDate)} às ${selectedSlot}!`);
    setTimeout(() => setScheduleSuccess(''), 4000);
  };

  const handleOpenPixModal = (acc: AccountReceivable) => {
    setSelectedAccountForPix(acc);
    setShowPixModal(true);
    setPixCopied(false);
    setChaveCopied(false);
    setCouponFeedback(null);
    setCouponCodeInput('');
  };

  const handleApplyStudentCoupon = (targetAccount: AccountReceivable, codeToUse: string) => {
    setCouponFeedback(null);
    const cleanCode = codeToUse.trim().toUpperCase();
    if (!cleanCode) {
      setCouponFeedback({ text: 'Por favor, digite o código do cupom fornecido pelo seu instrutor.', type: 'error' });
      return;
    }

    const ctx: CouponValidationContext = {
      escopo: 'ALUNO',
      referenciaId: targetAccount.pacoteId,
      instrutorId: student?.instrutorId,
      organizacaoId: orgId
    };

    const preview = db.previewCoupon(cleanCode, ctx, targetAccount.saldoDevedorCentavos);

    if (!preview.valid || !preview.result || !preview.coupon) {
      setCouponFeedback({ text: preview.error || 'Cupom inválido ou não aplicável a esta fatura.', type: 'error' });
      return;
    }

    setIsApplyingCoupon(true);
    try {
      const redeemRes = db.redeemCoupon(
        preview.coupon.codigo,
        ctx,
        targetAccount.saldoDevedorCentavos,
        {
          organizacaoId: orgId,
          alunoId: student?.id
        },
        currentUser.id
      );

      if (!redeemRes.valid || !redeemRes.result) {
        setCouponFeedback({ text: redeemRes.error || 'Não foi possível resgatar este cupom.', type: 'error' });
        setIsApplyingCoupon(false);
        return;
      }

      const novoSaldo = redeemRes.result.valorFinalCentavos;
      const descText = ` · Cupom [${preview.coupon.codigo}]: -${formatCurrencyBRL(redeemRes.result.valorDescontoCentavos)}`;
      const updatedAcc: AccountReceivable = {
        ...targetAccount,
        saldoDevedorCentavos: novoSaldo,
        descricao: `${targetAccount.descricao}${descText}`,
        status: novoSaldo <= 0 ? 'PAGO' : targetAccount.status
      };

      db.updateAccountReceivable(updatedAcc, currentUser.id);

      setPortalVersion((v) => v + 1);
      if (selectedAccountForPix && selectedAccountForPix.id === targetAccount.id) {
        setSelectedAccountForPix(updatedAcc);
      }

      setCouponFeedback({
        text: `🎉 Parabéns! Cupom ${preview.coupon.codigo} aplicado com sucesso! Economia de ${formatCurrencyBRL(redeemRes.result.valorDescontoCentavos)}.`,
        type: 'success'
      });
      setCouponCodeInput('');
      setCouponTargetAccId(null);
    } catch (err: any) {
      setCouponFeedback({ text: err.message || 'Erro ao processar cupom.', type: 'error' });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const getStudentPixPayload = (acc: AccountReceivable) => {
    return generatePixCopiaECola(
      pixConfig.chavePix,
      pixConfig.beneficiarioPix,
      acc.saldoDevedorCentavos,
      acc.id,
      pixConfig.cidadePix
    );
  };

  const handleCopyPixCode = () => {
    if (!selectedAccountForPix) return;
    const payload = getStudentPixPayload(selectedAccountForPix);
    navigator.clipboard.writeText(payload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(pixConfig.chavePix);
    setChaveCopied(true);
    setTimeout(() => setChaveCopied(false), 3000);
  };

  // Estados para cancelamento e remarcação pelo aluno (Regra de 24h)
  const [blocked24hLesson, setBlocked24hLesson] = useState<{
    lesson: Lesson;
    action: 'REMARCAR' | 'CANCELAR';
    hoursRemainingText: string;
  } | null>(null);
  const [lessonToStudentCancel, setLessonToStudentCancel] = useState<Lesson | null>(null);
  const [studentCancelReason, setStudentCancelReason] = useState<string>('');
  const [lessonToStudentReschedule, setLessonToStudentReschedule] = useState<Lesson | null>(null);
  const [studentRescheduleDate, setStudentRescheduleDate] = useState<string>('');
  const [studentRescheduleSlot, setStudentRescheduleSlot] = useState<string>('');
  const [studentRescheduleReason, setStudentRescheduleReason] = useState<string>('');
  const [studentRescheduleError, setStudentRescheduleError] = useState<string>('');
  const [isProcessingAction, setIsProcessingAction] = useState<boolean>(false);

  const handleInitiateCancel = (lsn: Lesson) => {
    const windowCheck = db.checkLessonCancellationWindow(lsn.data, lsn.horaInicio);
    if (!windowCheck.canStudentChange) {
      setBlocked24hLesson({ lesson: lsn, action: 'CANCELAR', hoursRemainingText: windowCheck.hoursRemainingText });
      return;
    }
    setLessonToStudentCancel(lsn);
    setStudentCancelReason('');
  };

  const handleInitiateReschedule = (lsn: Lesson) => {
    const windowCheck = db.checkLessonCancellationWindow(lsn.data, lsn.horaInicio);
    if (!windowCheck.canStudentChange) {
      setBlocked24hLesson({ lesson: lsn, action: 'REMARCAR', hoursRemainingText: windowCheck.hoursRemainingText });
      return;
    }
    setLessonToStudentReschedule(lsn);
    setStudentRescheduleDate('');
    setStudentRescheduleSlot('');
    setStudentRescheduleReason('');
    setStudentRescheduleError('');
  };

  const handleConfirmStudentCancel = async () => {
    if (!lessonToStudentCancel) return;
    try {
      setIsProcessingAction(true);
      const res = await db.cancelLessonByStudentAsync(lessonToStudentCancel.id, currentUser, studentCancelReason);
      if (!res.success) {
        alert(res.error || 'Erro ao cancelar aula.');
        return;
      }
      setLessonToStudentCancel(null);
      setPortalVersion((v) => v + 1);
    } catch (err: any) {
      alert('Erro ao cancelar aula: ' + (err.message || 'Falha de comunicação.'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleConfirmStudentReschedule = async () => {
    if (!lessonToStudentReschedule) return;
    if (!studentRescheduleDate || !studentRescheduleSlot) {
      setStudentRescheduleError('Selecione uma data e um horário disponível.');
      return;
    }
    try {
      setIsProcessingAction(true);
      setStudentRescheduleError('');
      const res = await db.rescheduleLessonAsync({
        aulaId: lessonToStudentReschedule.id,
        novaData: studentRescheduleDate,
        novaHoraInicio: studentRescheduleSlot,
        motivo: studentRescheduleReason.trim() || 'Remarcação realizada pelo aluno no portal (>24h)',
        actor: currentUser
      });
      if (!res.success) {
        setStudentRescheduleError(res.error || 'Erro ao remarcar aula.');
        return;
      }
      setLessonToStudentReschedule(null);
      setPortalVersion((v) => v + 1);
    } catch (err: any) {
      setStudentRescheduleError('Erro ao remarcar aula: ' + (err.message || 'Falha de comunicação.'));
    } finally {
      setIsProcessingAction(false);
    }
  };

  if (!student) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
        <p className="text-sm font-bold text-slate-800">Perfil de Aluno não localizado para este usuário.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Student Welcome Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Car className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                Portal do Aluno · CNH {student.categoriaCnh}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Bem-vindo(a), {student.nome}! 🚗💨
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Instrutor Responsável: <strong className="text-white">{instructor?.nome || 'Carlos Eduardo'}</strong> ({instructor?.telefone || '(11) 98765-4321'}).
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 sm:px-5 py-3 rounded-2xl border border-white/10 text-left md:text-right">
            <span className="text-xs text-emerald-300 font-semibold block">Carga Horária Obrigatória</span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-white">
              {student.aulasCumpridas} / {student.totalAulasContratadas} Aulas
            </span>
            <span className="text-xs text-slate-200 font-medium block mt-0.5">{progressPercent}% do curso prático concluído</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5 w-full bg-slate-700/60 rounded-full h-3 overflow-hidden">
          <div
            className="bg-emerald-500 h-3 rounded-full transition-all duration-500 shadow-sm"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {scheduleSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{scheduleSuccess}</span>
        </div>
      )}

      {/* PAINEL DE NOTIFICAÇÕES DE AULAS DESMARCADAS PELO INSTRUTOR */}
      {unreadNotifications.length > 0 && (
        <div className="p-4 sm:p-5 bg-rose-50 border-2 border-rose-300 rounded-2xl shadow-sm space-y-3 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-600 text-white shrink-0">
                <BellRing className="w-5 h-5" />
              </div>
              <div>
                <span className="px-2 py-0.5 rounded bg-rose-200 text-rose-950 font-extrabold text-[10px] uppercase tracking-wider">
                  Aviso Importante do Instrutor
                </span>
                <h3 className="text-sm sm:text-base font-extrabold text-rose-950 mt-0.5">
                  Horário de Aula Desmarcado — Solicitação de Reagendamento ({unreadNotifications.length})
                </h3>
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            {unreadNotifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3.5 bg-white rounded-xl border border-rose-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-900 font-mono font-bold">
                      📅 Data: {formatDateBR(notif.dataAula)} às {notif.horaAula}
                    </span>
                    <span className="text-slate-500 font-medium">
                      Instrutor: <strong className="text-slate-800">{notif.instrutorNome}</strong>
                    </span>
                  </div>
                  <p className="text-slate-800 font-medium leading-relaxed">
                    O horário das <strong>{notif.horaAula}</strong> da data <strong>{formatDateBR(notif.dataAula)}</strong> foi desmarcado pelo instrutor{' '}
                    <strong>{notif.instrutorNome}</strong>. Por favor, escolha e remarque para uma nova data e horário disponível na agenda abaixo.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRescheduleFromNotification(notif)}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs cursor-pointer shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>Remarcar na Agenda</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMarkNotificationRead(notif.id)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer transition-colors"
                    title="Confirmar leitura deste aviso"
                  >
                    Ciente
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Barra de Navegação Simplificada do Aluno (Modo Mobile Simplificado) */}
      {isSimplified && (
        <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setStudentMobileTab('BOOK')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer touch-target ${studentMobileTab === 'BOOK'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Calendar className="w-4 h-4 shrink-0" />
            <span>Agendar Aula</span>
          </button>

          <button
            type="button"
            onClick={() => setStudentMobileTab('PIX')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer touch-target ${studentMobileTab === 'PIX'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <QrCode className="w-4 h-4 shrink-0" />
            <span>Pagar PIX</span>
          </button>

          <button
            type="button"
            onClick={() => setStudentMobileTab('PROGRESS')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer touch-target ${studentMobileTab === 'PROGRESS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
              }`}
          >
            <Award className="w-4 h-4 shrink-0" />
            <span>Aulas & Notas</span>
          </button>

          {onSwitchToFullMode && (
            <button
              type="button"
              onClick={onSwitchToFullMode}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap bg-slate-900 text-white hover:bg-slate-800 transition-all cursor-pointer touch-target shrink-0"
              title="Exibir todas as seções simultaneamente no Modo Normal"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Modo Normal</span>
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Book a Lesson & Skills Radar */}
      <div className={`grid grid-cols-1 ${isSimplified ? '' : 'lg:grid-cols-2'} gap-5 sm:gap-6`}>
        {/* SECTION: AGENDAR NOVA AULA PRÁTICA */}
        {(!isSimplified || studentMobileTab === 'BOOK') && (
          <div
            ref={bookingSectionRef}
            className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Agendar Nova Aula Prática</span>
              </h2>
              <button
                type="button"
                onClick={handleManualSync}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                title="Sincronizar horários liberados pelo instrutor"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Sincronizando...' : 'Atualizar Agenda'}</span>
              </button>
            </div>

            {scheduleError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span>{scheduleError}</span>
              </div>
            )}

            {/* Atalho rápido de próximas datas com horários liberados pelo instrutor */}
            {upcomingDatesWithFreeSlots.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-700 block">
                  Próximas Datas Liberadas pelo Instrutor:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {upcomingDatesWithFreeSlots.map((item) => {
                    const active = item.date === scheduleDate;
                    return (
                      <button
                        key={item.date}
                        type="button"
                        onClick={() => {
                          setScheduleDate(item.date);
                          setSelectedSlot(null);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${active
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-indigo-50 hover:border-indigo-300'
                          }`}
                      >
                        <span>{formatDateBR(item.date)}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${active ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                            }`}
                        >
                          {item.count} vaga(s)
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <form onSubmit={handleBookLesson} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Escolha a Data da Aula:
                </label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => {
                    setScheduleDate(e.target.value);
                    setSelectedSlot(null);
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:border-blue-600 font-bold"
                />
              </div>

              <div>
                <div className="flex flex-wrap items-center justify-between gap-1 mb-1.5">
                  <label className="block font-semibold text-slate-700">
                    Horários Liberados para {formatDateBR(scheduleDate)}:
                  </label>
                  <span className="text-xs text-slate-600 font-medium">
                    Faixa: 06h às 00h
                  </span>
                </div>
                {availableSlotsOnDate.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-600">
                    <Clock className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                    <p className="font-medium">Nenhum horário livre ou liberado pelo instrutor para esta data.</p>
                    <p className="text-xs mt-0.5 text-slate-500 font-medium">Experimente selecionar outro dia no calendário acima.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {availableSlotsOnDate
                        .slice()
                        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
                        .map((slot) => {
                          const isSelected = selectedSlot === slot.horaInicio;
                          const hour = parseInt(slot.horaInicio.split(':')[0], 10);
                          const isNight = hour >= 19 || slot.horaInicio === '00:00';
                          const isMorning = hour >= 6 && hour < 12;

                          return (
                            <button
                              key={slot.id}
                              type="button"
                              onClick={() => setSelectedSlot(slot.horaInicio)}
                              className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                  : isNight
                                    ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 hover:border-indigo-400'
                                    : isMorning
                                      ? 'bg-amber-50/50 border-amber-200 text-amber-900 hover:border-amber-400'
                                      : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-400 hover:bg-blue-50'
                                }`}
                            >
                              <span className="font-mono text-xs">{slot.horaInicio}</span>
                              <span className="text-xs font-semibold opacity-90">
                                {isNight ? '🌙 Noturno' : isMorning ? '☀️ Manhã' : '🌤️ Tarde'}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                    <p className="text-xs text-slate-600 font-medium text-right">
                      * Aulas a partir das 19h contam como prática noturna.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  O que você gostaria de treinar nesta aula?
                </label>
                <input
                  type="text"
                  value={bookingTopic}
                  onChange={(e) => setBookingTopic(e.target.value)}
                  placeholder="Ex: Baliza de 3 pontos e estacionamento"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedSlot}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-xl text-xs shadow-xs transition-colors cursor-pointer touch-target"
              >
                Confirmar Agendamento da Aula
              </button>
            </form>
          </div>
        )}

        {/* SECTION: MEU PROGRESSO & 8 COMPETÊNCIAS */}
        {(!isSimplified || studentMobileTab === 'PROGRESS') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Minhas Notas & Domínio Prático</span>
              </h2>
              <span className="text-xs text-blue-600 font-bold">
                Avaliação Detran
              </span>
            </div>

            {/* 8 Skills progression */}
            <div className="space-y-2.5 text-xs">
              {[
                { key: 'baliza', label: 'Baliza / Estacionamento', score: student.habilidades.baliza },
                { key: 'controleEmbreagem', label: 'Controle de Embreagem (Rampa)', score: student.habilidades.controleEmbreagem },
                { key: 'transitoPesado', label: 'Trânsito Pesado & Fluidez', score: student.habilidades.transitoPesado },
                { key: 'conversoesCruzamentos', label: 'Conversões & Cruzamentos', score: student.habilidades.conversoesCruzamentos },
                { key: 'rodoviaVelocidade', label: 'Rodovia & Velocidade', score: student.habilidades.rodoviaVelocidade },
                { key: 'sinalizacaoPreferencia', label: 'Sinalização & Preferência', score: student.habilidades.sinalizacaoPreferencia },
                { key: 'posturaDefensiva', label: 'Postura Defensiva', score: student.habilidades.posturaDefensiva },
                { key: 'simuladoExame', label: 'Simulado de Exame Prático', score: student.habilidades.simuladoExame }
              ].map((skill) => (
                <div key={skill.key} className="space-y-1">
                  <div className="flex justify-between items-center text-xs gap-2">
                    <span className="font-medium text-slate-700 truncate">{skill.label}</span>
                    <span className="font-bold font-mono text-slate-900 shrink-0">{skill.score.toFixed(1)} / 10</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${skill.score >= 8 ? 'bg-emerald-500' : skill.score >= 6 ? 'bg-blue-500' : 'bg-amber-500'
                        }`}
                      style={{ width: `${(skill.score / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Instructor Notes */}
            {student.observacoesInstrutor && (
              <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs space-y-1">
                <span className="font-bold text-blue-900 block">Parecer do Instrutor:</span>
                <p className="text-slate-700 italic">"{student.observacoesInstrutor}"</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Two Column: Upcoming Scheduled Lessons & Invoices/Payments */}
      <div className={`grid grid-cols-1 ${isSimplified ? '' : 'lg:grid-cols-2'} gap-5 sm:gap-6`}>
        {/* Minhas Aulas Agendadas */}
        {(!isSimplified || studentMobileTab === 'PROGRESS' || studentMobileTab === 'BOOK') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Minhas Aulas de Direção ({lessons.length})</span>
            </h2>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lessons.map((lsn) => {
                const isCancelled = lsn.status === 'CANCELADA';
                const isScheduled = lsn.status === 'AGENDADA';
                const windowCheck = isScheduled
                  ? db.checkLessonCancellationWindow(lsn.data, lsn.horaInicio)
                  : null;

                return (
                  <div
                    key={lsn.id}
                    className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
                      isCancelled
                        ? 'border-rose-200 bg-rose-50/70'
                        : 'border-slate-100 bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <p className={`font-bold truncate ${isCancelled ? 'text-rose-900 line-through' : 'text-slate-900'}`}>
                        {formatDateBR(lsn.data)} às {lsn.horaInicio} - {lsn.horaFim}
                      </p>
                      <p className="text-slate-600 text-xs font-medium truncate">{lsn.topico}</p>
                      {isCancelled && (
                        <p className="text-rose-700 font-semibold text-[11px]">
                          Horário desmarcado pelo instrutor — escolha uma nova data e horário disponível na agenda.
                        </p>
                      )}
                      {(lsn.historicoRemarcacoes?.length || 0) > 0 && (
                        <p className="text-amber-700 font-semibold text-[11px]">
                          Remarcada (antes: {formatDateBR(lsn.historicoRemarcacoes![lsn.historicoRemarcacoes!.length - 1].dataAnterior)} às{' '}
                          {lsn.historicoRemarcacoes![lsn.historicoRemarcacoes!.length - 1].horaInicioAnterior})
                        </p>
                      )}
                      {lsn.recorrenciaTipo && lsn.recorrenciaTipo !== 'UNICA' && (
                        <p className="text-indigo-700 font-semibold text-[11px]">
                          Agendamento {lsn.recorrenciaTipo === 'SEMANAL' ? 'semanal' : 'mensal'}
                        </p>
                      )}
                      {isScheduled && windowCheck && !windowCheck.canStudentChange && (
                        <p className="text-amber-700 font-semibold text-[11px] flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                          <span>Menos de 24h para o início ({windowCheck.hoursRemainingText}) — alteração requer contato com instrutor.</span>
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-center">
                      {isScheduled && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleInitiateReschedule(lsn)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer flex items-center gap-1"
                            title={
                              windowCheck?.canStudentChange
                                ? 'Remarcar data/horário da aula (>24h)'
                                : 'Menos de 24h — alteração requer contato com o instrutor'
                            }
                          >
                            <CalendarClock className="w-3.5 h-3.5" />
                            <span>Remarcar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInitiateCancel(lsn)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1"
                            title={
                              windowCheck?.canStudentChange
                                ? 'Cancelar aula com antecedência (>24h)'
                                : 'Menos de 24h — cancelamento requer contato com o instrutor'
                            }
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        </>
                      )}

                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
                          lsn.status === 'CONCLUIDA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCancelled
                            ? 'bg-rose-600 text-white'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {isCancelled
                          ? 'DESMARCADA'
                          : lsn.status === 'CONCLUIDA'
                          ? 'REALIZADA'
                          : lsn.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Registro de Aulas Realizadas — mesmo registro visível ao instrutor */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Registro de Aulas Realizadas ({student.aulasCumpridas || 0} de {student.totalAulasContratadas || 0})
                </span>
              </h3>
              {completedLessonsRegistry.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">
                  Suas aulas serão registradas aqui automaticamente ao término de cada horário agendado.
                </p>
              ) : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {completedLessonsRegistry.map(({ lesson: l, numero }) => (
                    <div
                      key={l.id}
                      className="p-2.5 rounded-xl border border-emerald-100 bg-emerald-50/50 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">
                          Aula {numero}
                          {student.totalAulasContratadas ? ` de ${student.totalAulasContratadas}` : ''} ·{' '}
                          {formatDateBR(l.data)} às {l.horaInicio}
                        </p>
                        <p className="text-slate-600 truncate">{l.topico}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold shrink-0">
                        {l.concluidaAutomaticamente ? '✓ Registrada' : `✓ Avaliada${l.notaAula ? ` ${l.notaAula}` : ''}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Faturas & Pagamento PIX */}
        {(!isSimplified || studentMobileTab === 'PIX') && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs space-y-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Minhas Mensalidades & Pagamentos PIX</span>
            </h2>

            <div className="space-y-2.5">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 text-xs shadow-xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 break-words">{acc.descricao}</p>
                      <p className="text-xs text-slate-600 font-medium mt-0.5">
                        Vencimento: {formatDateBR(acc.dataVencimento)} · Saldo:{' '}
                        <strong className="text-slate-900 font-mono font-bold">{formatCurrencyBRL(acc.saldoDevedorCentavos)}</strong>
                      </p>
                    </div>

                    <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
                      {acc.saldoDevedorCentavos > 0 ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCouponTargetAccId(couponTargetAccId === acc.id ? null : acc.id);
                              setCouponFeedback(null);
                            }}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-3 py-2 sm:py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                            title="Usar cupom de desconto fornecido pelo instrutor"
                          >
                            <Ticket className="w-3.5 h-3.5 text-purple-600" />
                            <span>Usar Cupom</span>
                          </button>
                          <button
                            onClick={() => handleOpenPixModal(acc)}
                            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs transition-colors cursor-pointer touch-target"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Pagar c/ PIX</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-emerald-700 font-semibold flex items-center justify-center sm:justify-end gap-1 py-1">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Quitado</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Formulário Retrátil de Cupom para esta fatura */}
                  {couponTargetAccId === acc.id && acc.saldoDevedorCentavos > 0 && (
                    <div className="pt-2 border-t border-purple-100 bg-purple-50/70 p-3 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-purple-900 font-bold text-xs">
                        <Tag className="w-3.5 h-3.5 text-purple-600" />
                        <span>Informe o código do cupom de desconto recebido:</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCodeInput}
                          onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                          placeholder="Ex: PROMO50, ALUNO10"
                          className="flex-1 px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                        <button
                          type="button"
                          disabled={!couponCodeInput.trim() || isApplyingCoupon}
                          onClick={() => handleApplyStudentCoupon(acc, couponCodeInput)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                        >
                          {isApplyingCoupon ? 'Aplicando...' : 'Aplicar'}
                        </button>
                      </div>

                      {couponFeedback && (
                        <div
                          className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${couponFeedback.type === 'success'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                            }`}
                        >
                          {couponFeedback.type === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{couponFeedback.text}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PIX MODAL FOR STUDENT PAYMENT */}
      {showPixModal && selectedAccountForPix && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center space-y-4 max-h-[92vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Pagamento Instantâneo PIX</h3>
              <button onClick={() => setShowPixModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Real Scannable QR Code */}
            <div className="p-3 bg-white border-2 border-emerald-500/30 rounded-2xl inline-block mx-auto shadow-sm">
              <img
                src={getPixQrCodeImageUrl(getStudentPixPayload(selectedAccountForPix), 240)}
                alt="QR Code PIX Escaneável"
                className="w-44 h-44 mx-auto rounded-xl"
              />
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Aponte a câmera do app do seu banco
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-600 font-medium break-words">{selectedAccountForPix.descricao}</p>
              <p className="text-xl font-extrabold font-mono text-emerald-700 mt-0.5">
                {formatCurrencyBRL(selectedAccountForPix.saldoDevedorCentavos)}
              </p>
            </div>

            {/* Inserir Cupom de Desconto dentro do Modal PIX */}
            {selectedAccountForPix.saldoDevedorCentavos > 0 && (
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl text-left space-y-2">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1">
                  <Ticket className="w-3.5 h-3.5 text-purple-600" />
                  <span>Tem cupom de desconto do seu instrutor?</span>
                </span>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    placeholder="Código do cupom"
                    className="flex-1 px-2.5 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    disabled={!couponCodeInput.trim() || isApplyingCoupon}
                    onClick={() => handleApplyStudentCoupon(selectedAccountForPix, couponCodeInput)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer shrink-0"
                  >
                    {isApplyingCoupon ? '...' : 'Aplicar'}
                  </button>
                </div>

                {couponFeedback && (
                  <div
                    className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 ${couponFeedback.type === 'success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                      }`}
                  >
                    {couponFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{couponFeedback.text}</span>
                  </div>
                )}
              </div>
            )}

            {/* Chave e Beneficiário Info */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-800 font-semibold">Beneficiário:</span>
                <span className="text-xs text-emerald-950 font-bold truncate max-w-[180px]">
                  {pixConfig.beneficiarioPix}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-800 font-semibold">Chave PIX:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-xs text-emerald-950 font-extrabold truncate max-w-[150px]">
                    {pixConfig.chavePix}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="p-1 rounded bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs cursor-pointer"
                    title="Copiar Chave PIX"
                  >
                    {chaveCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Copia e Cola */}
            <div className="space-y-2">
              <button
                onClick={handleCopyPixCode}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {pixCopied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    Código PIX Copiado com Sucesso!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copiar Código PIX (Copia e Cola)
                  </>
                )}
              </button>
              <p className="text-xs text-slate-600 font-medium">
                Abra o app do seu banco, escolha <strong>PIX Copia e Cola</strong> e efetue o pagamento. O instrutor receberá a confirmação imediatamente.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BLOQUEIO DE 24H COM CONTATO DIRETO VIA WHATSAPP AO INSTRUTOR */}
      {blocked24hLesson && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-3 rounded-2xl bg-amber-100 text-amber-700 shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-extrabold text-slate-900">
                  Prazo Limite de 24 Horas
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Regra de antecedência mínima para alterações pelo aluno
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBlocked24hLesson(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1.5 leading-relaxed">
              <p>
                A <strong>{blocked24hLesson.action === 'REMARCAR' ? 'remarcação' : 'desmarcação / cancelamento'}</strong> de aula pelo aluno no sistema só pode ser realizada com no mínimo <strong>24 horas de antecedência</strong> do horário previsto.
              </p>
              <p className="font-semibold text-amber-800">
                Para esta aula ({blocked24hLesson.hoursRemainingText}), somente o instrutor tem autorização para realizar a alteração no sistema.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="text-slate-500 font-semibold">Aula selecionada:</p>
              <p className="font-bold text-slate-900">
                {formatDateBR(blocked24hLesson.lesson.data)} às {blocked24hLesson.lesson.horaInicio} - {blocked24hLesson.lesson.horaFim}
              </p>
              <p className="text-slate-600">{blocked24hLesson.lesson.topico}</p>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs space-y-1">
              <p className="font-bold text-blue-900">Instrutor Responsável:</p>
              <p className="text-slate-700">
                <strong>{instructor?.nome || 'Alexsandro Dias da Silva'}</strong>
                <br />
                Telefone: {instructor?.telefone || '(11) 98765-4321'}
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              {(() => {
                const actionText = blocked24hLesson.action === 'REMARCAR' ? 'remarcação' : 'cancelamento';
                const msg = `Olá ${instructor?.nome || 'Instrutor'}, gostaria de solicitar o(a) ${actionText} da minha aula de direção do dia ${formatDateBR(blocked24hLesson.lesson.data)} às ${blocked24hLesson.lesson.horaInicio}. Aluno: ${currentUser.nome}.`;
                const waLink = buildWhatsAppLink(instructor?.telefone, msg);
                return waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Falar no WhatsApp</span>
                  </a>
                ) : (
                  <div className="flex-1 text-center py-2 text-xs text-slate-500 italic">
                    Telefone do instrutor não configurado para WhatsApp
                  </div>
                );
              })()}
              <button
                type="button"
                onClick={() => setBlocked24hLesson(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CANCELAMENTO PELO ALUNO (ANTECEDÊNCIA >= 24H) */}
      {lessonToStudentCancel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 shrink-0">
                  <X className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Cancelar Aula Agendada
                  </h3>
                  <p className="text-xs text-slate-500">
                    Antecedência superior a 24 horas confirmada
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLessonToStudentCancel(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-slate-900">
                {formatDateBR(lessonToStudentCancel.data)} às {lessonToStudentCancel.horaInicio} - {lessonToStudentCancel.horaFim}
              </p>
              <p className="text-slate-600">{lessonToStudentCancel.topico}</p>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 leading-relaxed">
              <p>
                ✓ Você está realizando o cancelamento com <strong>mais de 24 horas de antecedência</strong>. O horário será liberado na agenda e você poderá agendar outra aula normalmente.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Motivo do cancelamento (opcional):
              </label>
              <textarea
                value={studentCancelReason}
                onChange={(e) => setStudentCancelReason(e.target.value)}
                placeholder="Ex: Imprevisto de trabalho, compromisso médico..."
                rows={2}
                className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLessonToStudentCancel(null)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmStudentCancel}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <X className="w-4 h-4" />
                <span>{isProcessingAction ? 'Cancelando...' : 'Confirmar Cancelamento'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REMARCAÇÃO PELO ALUNO (ANTECEDÊNCIA >= 24H) */}
      {lessonToStudentReschedule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 shrink-0">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Remarcar Aula de Direção
                  </h3>
                  <p className="text-xs text-slate-500">
                    Escolha uma nova data e horário disponível
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLessonToStudentReschedule(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <p className="text-slate-500 text-[11px] font-semibold">Horário atual agendado:</p>
              <p className="font-bold text-slate-900">
                {formatDateBR(lessonToStudentReschedule.data)} às {lessonToStudentReschedule.horaInicio} - {lessonToStudentReschedule.horaFim}
              </p>
              <p className="text-slate-600">{lessonToStudentReschedule.topico}</p>
            </div>

            {studentRescheduleError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{studentRescheduleError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">Nova Data:</label>
                <input
                  type="date"
                  min={new Date().toISOString().slice(0, 10)}
                  value={studentRescheduleDate}
                  onChange={(e) => {
                    setStudentRescheduleDate(e.target.value);
                    setStudentRescheduleSlot('');
                  }}
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {studentRescheduleDate && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 block">Novo Horário Disponível:</label>
                  {(() => {
                    const freeSlots = allSlots.filter((slot) => {
                      if (slot.data !== studentRescheduleDate) return false;
                      if (slot.bloqueado) return false;
                      const isBooked = allOrgLessons.some(
                        (l) =>
                          l.id !== lessonToStudentReschedule.id &&
                          l.data === studentRescheduleDate &&
                          l.horaInicio === slot.horaInicio &&
                          l.status !== 'CANCELADA' &&
                          (!l.instrutorId || !student?.instrutorId || l.instrutorId === student.instrutorId)
                      );
                      return !isBooked;
                    });

                    if (freeSlots.length === 0) {
                      return (
                        <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                          Nenhum horário livre encontrado nesta data na agenda do instrutor. Escolha outra data.
                        </p>
                      );
                    }

                    return (
                      <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1">
                        {freeSlots.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setStudentRescheduleSlot(s.horaInicio)}
                            className={`p-2 rounded-xl border text-xs font-bold text-center transition-all cursor-pointer ${
                              studentRescheduleSlot === s.horaInicio
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {s.horaInicio} - {s.horaFim}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Motivo da alteração (opcional):
                </label>
                <input
                  type="text"
                  value={studentRescheduleReason}
                  onChange={(e) => setStudentRescheduleReason(e.target.value)}
                  placeholder="Ex: Ajuste de escala ou compromisso"
                  className="w-full p-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLessonToStudentReschedule(null)}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmStudentReschedule}
                disabled={isProcessingAction || !studentRescheduleDate || !studentRescheduleSlot}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>{isProcessingAction ? 'Remarcando...' : 'Confirmar Remarcação'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
