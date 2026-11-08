import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Car,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Sliders,
  Check,
  X,
  Trash2,
  BellRing,
  RefreshCw,
  CalendarRange
} from 'lucide-react';
import { db, syncFromSupabase } from '../../lib/storage';
import { formatDateBR } from '../../lib/validation';
import {
  Organization,
  User,
  Lesson,
  AvailableSlot,
  Vehicle,
  Student,
  SchedulePeriodScope
} from '../../types';

interface ScheduleViewProps {
  currentOrg: Organization;
  currentUser: User;
}

// Horários permitidos abrangendo das 06h às 00h (Conforme solicitação do usuário e normas Detran)
export const ALL_PERMITTED_HOURS = [
  '06:00',
  '07:00',
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
  '21:00',
  '22:00',
  '23:00',
  '00:00'
];

const WEEKDAYS_LIST = [
  { day: 0, short: 'Dom', label: 'Domingo' },
  { day: 1, short: 'Seg', label: 'Segunda' },
  { day: 2, short: 'Ter', label: 'Terça' },
  { day: 3, short: 'Qua', label: 'Quarta' },
  { day: 4, short: 'Qui', label: 'Quinta' },
  { day: 5, short: 'Sex', label: 'Sexta' },
  { day: 6, short: 'Sáb', label: 'Sábado' }
];

const SCOPE_OPTIONS: { value: SchedulePeriodScope; label: string; desc: string }[] = [
  { value: 'DIA', label: 'Apenas no Dia', desc: 'Somente na data selecionada' },
  { value: 'SEMANAL', label: 'Semanal (7 dias)', desc: 'Próximos 7 dias a partir da data' },
  { value: 'MENSAL', label: 'Mensal (30 dias)', desc: 'Próximos 30 dias a partir da data' },
  { value: 'ANUAL', label: 'Anual (12 meses)', desc: 'Próximos 365 dias a partir da data' },
  { value: 'PERIODO', label: 'Período Personalizado', desc: 'Escolha data inicial e data final' }
];

function getScopeDisplayName(scope: SchedulePeriodScope): string {
  switch (scope) {
    case 'DIA':
      return 'somente no dia';
    case 'SEMANAL':
      return 'na semana (7 dias)';
    case 'MENSAL':
      return 'no mês (30 dias)';
    case 'ANUAL':
      return 'no ano (12 meses)';
    case 'PERIODO':
      return 'no período selecionado';
  }
}

function getEndTimeForStart(startTime: string): string {
  if (startTime === '00:00') return '00:50';
  const parts = startTime.split(':');
  const hour = parseInt(parts[0], 10);
  return `${String(hour).padStart(2, '0')}:50`;
}

function addDaysISO(baseDateStr: string, daysToAdd: number): string {
  const dt = new Date(`${baseDateStr}T12:00:00`);
  dt.setDate(dt.getDate() + daysToAdd);
  return dt.toISOString().slice(0, 10);
}

function generateDatesForScope(
  startDateStr: string,
  scope: SchedulePeriodScope,
  customEndDateStr: string,
  allowedWeekdays: number[]
): string[] {
  if (!startDateStr) return [];
  if (scope === 'DIA') {
    return [startDateStr];
  }

  let totalDays = 1;
  if (scope === 'SEMANAL') totalDays = 7;
  else if (scope === 'MENSAL') totalDays = 30;
  else if (scope === 'ANUAL') totalDays = 365;
  else if (scope === 'PERIODO') {
    const startMs = new Date(`${startDateStr}T12:00:00`).getTime();
    const endMs = new Date(`${(customEndDateStr || startDateStr)}T12:00:00`).getTime();
    if (endMs < startMs) return [startDateStr];
    totalDays = Math.min(366, Math.floor((endMs - startMs) / 86400000) + 1);
  }

  const dates: string[] = [];
  const startDt = new Date(`${startDateStr}T12:00:00`);

  for (let i = 0; i < totalDays; i++) {
    const curr = new Date(startDt);
    curr.setDate(startDt.getDate() + i);
    const dayOfWeek = curr.getDay();
    if (allowedWeekdays.includes(dayOfWeek)) {
      dates.push(curr.toISOString().slice(0, 10));
    }
  }

  return dates;
}

export const ScheduleView: React.FC<ScheduleViewProps> = ({ currentOrg, currentUser }) => {
  const orgId = currentOrg.id;

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [syncVersion, setSyncVersion] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Release Modal configuration
  const [showReleaseSlotsModal, setShowReleaseSlotsModal] = useState<boolean>(false);
  const [releaseSlotsDate, setReleaseSlotsDate] = useState<string>(selectedDate);
  const [releaseEndDate, setReleaseEndDate] = useState<string>(() => addDaysISO(selectedDate, 14));
  const [releaseScope, setReleaseScope] = useState<SchedulePeriodScope>('DIA');
  const [releaseWeekdays, setReleaseWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6]); // Seg a Sáb por padrão
  const [selectedReleaseHours, setSelectedReleaseHours] = useState<string[]>([
    '06:00',
    '07:00',
    '08:00',
    '09:00',
    '10:00',
    '11:00',
    '14:00',
    '15:00',
    '16:00',
    '17:00',
    '18:00',
    '19:00',
    '20:00',
    '21:00',
    '22:00',
    '23:00'
  ]);

  // Remove / Indisponibilizar Modal configuration
  const [showRemoveSlotsModal, setShowRemoveSlotsModal] = useState<boolean>(false);
  const [removeBaseDate, setRemoveBaseDate] = useState<string>(selectedDate);
  const [removeEndDate, setRemoveEndDate] = useState<string>(() => addDaysISO(selectedDate, 7));
  const [removeScope, setRemoveScope] = useState<SchedulePeriodScope>('DIA');
  const [removeWeekdays, setRemoveWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [selectedRemoveHours, setSelectedRemoveHours] = useState<string[]>([]);

  // Single Custom Slot Modal
  const [showSingleSlotModal, setShowSingleSlotModal] = useState<boolean>(false);
  const [singleSlotTime, setSingleSlotTime] = useState<string>('06:00');
  const [singleSlotScope, setSingleSlotScope] = useState<SchedulePeriodScope>('DIA');

  // Schedule Lesson Modal
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedSlotForSchedule, setSelectedSlotForSchedule] = useState<string>('09:00');

  // Complete Lesson Modal
  const [showCompleteLessonModal, setShowCompleteLessonModal] = useState<boolean>(false);
  const [lessonToComplete, setLessonToComplete] = useState<Lesson | null>(null);
  const [completionGrade, setCompletionGrade] = useState<number>(9);
  const [completionNote, setCompletionNote] = useState<string>('');

  const [scheduleError, setScheduleError] = useState<string>('');
  const [scheduleSuccess, setScheduleSuccess] = useState<string>('');

  // Sincronização automática em tempo real ao montar e ao receber atualizações
  useEffect(() => {
    syncFromSupabase().then(() => setSyncVersion((v) => v + 1)).catch(() => {});

    const handleDataSynced = () => setSyncVersion((v) => v + 1);
    window.addEventListener('agd:data-synced', handleDataSynced);
    window.addEventListener('storage', handleDataSynced);

    return () => {
      window.removeEventListener('agd:data-synced', handleDataSynced);
      window.removeEventListener('storage', handleDataSynced);
    };
  }, []);

  // Data
  const slots = useMemo(
    () => db.getSlots(orgId, currentUser.id),
    [orgId, currentUser.id, selectedDate, syncVersion]
  );
  const lessons = useMemo(
    () => db.getLessons(orgId),
    [orgId, selectedDate, syncVersion]
  );
  const students = useMemo(
    () => db.getStudents(orgId, currentUser.id),
    [orgId, currentUser.id, syncVersion]
  );
  const allOrgStudents = useMemo(
    () => db.getStudents(orgId),
    [orgId, syncVersion]
  );
  const vehicles = useMemo(
    () => db.getVehicles(orgId),
    [orgId, syncVersion]
  );

  // Filter for selected date
  const dateSlots = useMemo(
    () =>
      slots
        .filter((s) => s.data === selectedDate)
        .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio)),
    [slots, selectedDate]
  );
  const dateLessons = useMemo(
    () =>
      lessons.filter(
        (l) =>
          l.data === selectedDate &&
          l.status !== 'CANCELADA' &&
          (!l.instrutorId || l.instrutorId === currentUser.id)
      ),
    [lessons, selectedDate, currentUser.id]
  );

  // Form for new lesson
  const [lessonForm, setLessonForm] = useState({
    alunoId: students[0]?.id || '',
    veiculoId: vehicles[0]?.id || '',
    topico: 'Treino de Baliza e Ponto de Embreagem',
    horaInicio: '09:00',
    horaFim: '09:50'
  });

  // Preview de datas para Liberação
  const targetReleaseDates = useMemo(
    () => generateDatesForScope(releaseSlotsDate, releaseScope, releaseEndDate, releaseWeekdays),
    [releaseSlotsDate, releaseScope, releaseEndDate, releaseWeekdays]
  );

  // Preview de datas, slots e aulas conflitantes para Remoção / Indisponibilização
  const targetRemoveDates = useMemo(
    () => generateDatesForScope(removeBaseDate, removeScope, removeEndDate, removeWeekdays),
    [removeBaseDate, removeScope, removeEndDate, removeWeekdays]
  );

  const targetRemoveDatesSet = useMemo(() => new Set(targetRemoveDates), [targetRemoveDates]);
  const selectedRemoveHoursSet = useMemo(() => new Set(selectedRemoveHours), [selectedRemoveHours]);

  const slotsMatchingRemoval = useMemo(
    () =>
      slots.filter(
        (s) =>
          targetRemoveDatesSet.has(s.data) &&
          selectedRemoveHoursSet.has(s.horaInicio) &&
          (!s.instrutorId || s.instrutorId === currentUser.id)
      ),
    [slots, targetRemoveDatesSet, selectedRemoveHoursSet, currentUser.id]
  );

  // Aulas agendadas que conflitam com os horários que o instrutor quer remover/indisponibilizar
  const conflictingBookedLessons = useMemo(
    () =>
      lessons
        .filter(
          (l) =>
            (l.status === 'AGENDADA' || l.status === 'EM_ANDAMENTO') &&
            (!l.instrutorId || l.instrutorId === currentUser.id) &&
            targetRemoveDatesSet.has(l.data) &&
            selectedRemoveHoursSet.has(l.horaInicio)
        )
        .sort((a, b) => `${a.data}_${a.horaInicio}`.localeCompare(`${b.data}_${b.horaInicio}`)),
    [lessons, currentUser.id, targetRemoveDatesSet, selectedRemoveHoursSet]
  );

  const handleDateChange = (daysOffset: number) => {
    const nextDate = addDaysISO(selectedDate, daysOffset);
    setSelectedDate(nextDate);
  };

  const handleToggleBlock = (slot: AvailableSlot) => {
    // Se estiver tentando bloquear um horário que possui aula marcada, abre o modal de confirmação com aviso ao aluno
    const hasBookedLesson = dateLessons.some((l) => l.horaInicio === slot.horaInicio);
    if (!slot.bloqueado && hasBookedLesson) {
      openRemoveModalForSingleHour(slot.horaInicio);
      return;
    }
    const motivo = slot.bloqueado ? undefined : 'Bloqueado pelo Instrutor (Indisponível)';
    db.toggleSlotBlock(slot.id, motivo);
    setSyncVersion((v) => v + 1);
  };

  // Quick preset handlers for instructor release limits
  const handleSelectPreset = (preset: 'FULL' | 'MORNING' | 'AFTERNOON' | 'NIGHT') => {
    if (preset === 'FULL') {
      setSelectedReleaseHours([...ALL_PERMITTED_HOURS]);
    } else if (preset === 'MORNING') {
      setSelectedReleaseHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return hour >= 6 && hour <= 12;
        })
      );
    } else if (preset === 'AFTERNOON') {
      setSelectedReleaseHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return hour >= 13 && hour <= 18;
        })
      );
    } else if (preset === 'NIGHT') {
      setSelectedReleaseHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return (hour >= 18 && hour <= 23) || h === '00:00';
        })
      );
    }
  };

  const handleSelectRemovePreset = (preset: 'ALL_DAY_SLOTS' | 'MORNING' | 'AFTERNOON' | 'NIGHT' | 'CLEAR') => {
    if (preset === 'CLEAR') {
      setSelectedRemoveHours([]);
    } else if (preset === 'ALL_DAY_SLOTS') {
      const dayHours = dateSlots.map((s) => s.horaInicio);
      setSelectedRemoveHours(dayHours.length > 0 ? Array.from(new Set(dayHours)) : [...ALL_PERMITTED_HOURS]);
    } else if (preset === 'MORNING') {
      setSelectedRemoveHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return hour >= 6 && hour <= 12;
        })
      );
    } else if (preset === 'AFTERNOON') {
      setSelectedRemoveHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return hour >= 13 && hour <= 18;
        })
      );
    } else if (preset === 'NIGHT') {
      setSelectedRemoveHours(
        ALL_PERMITTED_HOURS.filter((h) => {
          const hour = parseInt(h.split(':')[0], 10);
          return (hour >= 18 && hour <= 23) || h === '00:00';
        })
      );
    }
  };

  const toggleHourCheckbox = (hour: string) => {
    if (selectedReleaseHours.includes(hour)) {
      setSelectedReleaseHours(selectedReleaseHours.filter((h) => h !== hour));
    } else {
      setSelectedReleaseHours([...selectedReleaseHours, hour]);
    }
  };

  const toggleRemoveHourCheckbox = (hour: string) => {
    if (selectedRemoveHours.includes(hour)) {
      setSelectedRemoveHours(selectedRemoveHours.filter((h) => h !== hour));
    } else {
      setSelectedRemoveHours([...selectedRemoveHours, hour]);
    }
  };

  const toggleWeekday = (day: number, current: number[], setter: (days: number[]) => void) => {
    if (current.includes(day)) {
      if (current.length > 1) {
        setter(current.filter((d) => d !== day));
      }
    } else {
      setter([...current, day].sort());
    }
  };

  // Abre modal de confirmação de remoção (individual ou por período: Dia, Semana, Mês, Anual)
  const openRemoveModalForSingleHour = (hourStr: string) => {
    setRemoveBaseDate(selectedDate);
    setRemoveEndDate(addDaysISO(selectedDate, 7));
    setRemoveScope('DIA');
    setRemoveWeekdays([0, 1, 2, 3, 4, 5, 6]);
    setSelectedRemoveHours([hourStr]);
    setScheduleError('');
    setShowRemoveSlotsModal(true);
  };

  const openRemoveModalForPeriod = () => {
    setRemoveBaseDate(selectedDate);
    setRemoveEndDate(addDaysISO(selectedDate, 7));
    setRemoveScope('SEMANAL');
    setRemoveWeekdays([0, 1, 2, 3, 4, 5, 6]);
    const currentHours = dateSlots.map((s) => s.horaInicio);
    setSelectedRemoveHours(currentHours.length > 0 ? Array.from(new Set(currentHours)) : ['08:00', '09:00', '10:00']);
    setScheduleError('');
    setShowRemoveSlotsModal(true);
  };

  // Executa a remoção confirmada pelo instrutor (e notifica alunos caso haja aula agendada)
  const handleConfirmRemoveSlots = async () => {
    if (selectedRemoveHours.length === 0 || targetRemoveDates.length === 0) return;
    setIsProcessing(true);
    setScheduleError('');

    try {
      // 1. Se houver alunos agendados nos horários que estão sendo indisponibilizados,
      // desmarca a aula e envia a notificação diretamente para a tela do aluno
      let notifiedCount = 0;
      if (conflictingBookedLessons.length > 0) {
        for (const lesson of conflictingBookedLessons) {
          const st = allOrgStudents.find((s) => s.id === lesson.alunoId);
          await db.cancelLessonByInstructorWithNotificationAsync(lesson, currentUser, st?.nome);
          notifiedCount++;
        }
      }

      // 2. Remove todos os slots correspondentes em lote (localStorage + Supabase)
      const idsToDelete = slotsMatchingRemoval.map((s) => s.id);
      if (idsToDelete.length > 0) {
        await db.deleteSlotsBatchAsync(idsToDelete, currentUser.id, orgId);
      }

      setShowRemoveSlotsModal(false);
      setSyncVersion((v) => v + 1);

      const scopeText = getScopeDisplayName(removeScope);
      if (notifiedCount > 0) {
        setScheduleSuccess(
          `Horário(s) removido(s) ${scopeText}! ${notifiedCount} aula(s) foi(ram) desmarcada(s) e a notificação para reagendamento foi enviada automaticamente para a tela do(s) aluno(s).`
        );
      } else {
        setScheduleSuccess(
          `${idsToDelete.length} horário(s) removido(s) ${scopeText} e agenda sincronizada com todos os alunos vinculados!`
        );
      }
      setTimeout(() => setScheduleSuccess(''), 6000);
    } catch (err) {
      console.error(err);
      setScheduleError('Erro ao remover horários e sincronizar com o banco.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Liberação da grade (Dia, Período, Semanal, Mensal ou Anual)
  const handleReleaseConfiguredSlots = async () => {
    if (selectedReleaseHours.length === 0 || targetReleaseDates.length === 0) return;
    setIsProcessing(true);
    setScheduleError('');

    try {
      const existingSlotKeys = new Set(
        slots
          .filter((s) => !s.instrutorId || s.instrutorId === currentUser.id)
          .map((s) => `${s.data}_${s.horaInicio}`)
      );

      const slotsToCreate: AvailableSlot[] = [];
      for (const dateStr of targetReleaseDates) {
        for (const startTime of selectedReleaseHours) {
          const key = `${dateStr}_${startTime}`;
          if (!existingSlotKeys.has(key)) {
            slotsToCreate.push({
              id: `slt_${currentUser.id}_${dateStr}_${startTime.replace(':', '')}`,
              organizacaoId: orgId,
              instrutorId: currentUser.id,
              data: dateStr,
              horaInicio: startTime,
              horaFim: getEndTimeForStart(startTime),
              bloqueado: false
            });
          }
        }
      }

      if (slotsToCreate.length > 0) {
        await db.saveSlotsBatchAsync(slotsToCreate, currentUser.id);
      }

      setShowReleaseSlotsModal(false);
      setSelectedDate(releaseSlotsDate);
      setSyncVersion((v) => v + 1);

      const scopeText = getScopeDisplayName(releaseScope);
      setScheduleSuccess(
        `Agenda liberada com sucesso ${scopeText} (${slotsToCreate.length} novos horários em ${targetReleaseDates.length} dia(s))! Sincronizado para todos os seus alunos.`
      );
      setTimeout(() => setScheduleSuccess(''), 5000);
    } catch (err) {
      console.error(err);
      setScheduleError('Erro ao liberar os horários na base de dados.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Adicionar Horário Avulso (com suporte a Dia, Semanal, Mensal ou Anual)
  const handleAddSingleCustomSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setScheduleError('');

    try {
      const dates = generateDatesForScope(
        selectedDate,
        singleSlotScope,
        addDaysISO(selectedDate, 7),
        [0, 1, 2, 3, 4, 5, 6]
      );
      const endTime = getEndTimeForStart(singleSlotTime);

      const slotsToSave: AvailableSlot[] = [];
      for (const dt of dates) {
        const existing = slots.find(
          (s) =>
            s.data === dt &&
            s.horaInicio === singleSlotTime &&
            (!s.instrutorId || s.instrutorId === currentUser.id)
        );
        if (!existing) {
          slotsToSave.push({
            id: `slt_${currentUser.id}_${dt}_${singleSlotTime.replace(':', '')}`,
            organizacaoId: orgId,
            instrutorId: currentUser.id,
            data: dt,
            horaInicio: singleSlotTime,
            horaFim: endTime,
            bloqueado: false
          });
        }
      }

      if (slotsToSave.length === 0) {
        setScheduleError(`O horário ${singleSlotTime} já está liberado nas datas selecionadas.`);
        setIsProcessing(false);
        return;
      }

      await db.saveSlotsBatchAsync(slotsToSave, currentUser.id);

      setShowSingleSlotModal(false);
      setSyncVersion((v) => v + 1);
      setScheduleSuccess(
        `Horário ${singleSlotTime} liberado (${getScopeDisplayName(singleSlotScope)} — ${slotsToSave.length} dia(s)) e sincronizado com os alunos!`
      );
      setTimeout(() => setScheduleSuccess(''), 4000);
    } catch (err) {
      console.error(err);
      setScheduleError('Erro ao adicionar horário.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenScheduleForSlot = (time: string) => {
    setSelectedSlotForSchedule(time);
    setLessonForm({
      ...lessonForm,
      alunoId: lessonForm.alunoId || students[0]?.id || '',
      veiculoId: lessonForm.veiculoId || vehicles[0]?.id || '',
      horaInicio: time,
      horaFim: getEndTimeForStart(time)
    });
    setScheduleError('');
    setShowScheduleModal(true);
  };

  const handleCreateLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleError('');

    if (!lessonForm.alunoId) {
      setScheduleError('Selecione um aluno para agendar a aula.');
      return;
    }

    if (!lessonForm.veiculoId) {
      setScheduleError('Selecione o veículo da aula.');
      return;
    }

    const newLesson: Lesson = {
      id: `lsn_${Date.now()}`,
      organizacaoId: orgId,
      alunoId: lessonForm.alunoId,
      instrutorId: currentUser.id,
      veiculoId: lessonForm.veiculoId,
      data: selectedDate,
      horaInicio: lessonForm.horaInicio,
      horaFim: lessonForm.horaFim,
      topico: lessonForm.topico.trim() || 'Aula Prática de Direção',
      status: 'AGENDADA',
      criadoEm: new Date().toISOString()
    };

    const result = db.createLesson(newLesson, currentUser.id);
    if (!result.success) {
      setScheduleError(result.error || 'Não foi possível agendar esta aula.');
      return;
    }

    setShowScheduleModal(false);
    setSyncVersion((v) => v + 1);
    setScheduleSuccess(`Aula prática agendada com sucesso para ${formatDateBR(selectedDate)} às ${lessonForm.horaInicio}!`);
    setTimeout(() => setScheduleSuccess(''), 3500);
  };

  const handleCompleteLessonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonToComplete) return;

    const updated: Lesson = {
      ...lessonToComplete,
      status: 'CONCLUIDA',
      notaAula: completionGrade,
      observacaoInstrutor: completionNote
    };

    db.updateLesson(updated, currentUser.id);

    // Credit attended hours
    const student = db.getStudentById(lessonToComplete.alunoId);
    if (student) {
      db.saveStudent(
        {
          ...student,
          aulasCumpridas: student.aulasCumpridas + 1
        },
        currentUser.id
      );
    }

    setShowCompleteLessonModal(false);
    setLessonToComplete(null);
    setSyncVersion((v) => v + 1);
    setScheduleSuccess('Aula concluída e carga horária do aluno creditada com sucesso!');
    setTimeout(() => setScheduleSuccess(''), 3500);
  };

  // Helper to determine badge per time of day
  const getTimeBadge = (hourStr: string) => {
    const hour = parseInt(hourStr.split(':')[0], 10);
    if (hour >= 6 && hour < 12) {
      return { label: 'Manhã', color: 'bg-amber-100 text-amber-900 border-amber-200', icon: Sun };
    }
    if (hour >= 12 && hour < 18) {
      return { label: 'Tarde', color: 'bg-blue-100 text-blue-900 border-blue-200', icon: Sunset };
    }
    return { label: 'Noturno Detran', color: 'bg-indigo-100 text-indigo-900 border-indigo-200', icon: Moon };
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Agenda Prática & Gestão de Horários
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold border border-indigo-200">
              Faixa: 06h às 00h
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              Sincronização Automática
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-1">
            Libere ou remova horários por <strong>Dia, Período, Semana, Mês ou Ano</strong>. As alterações sincronizam em tempo real na tela de todos os alunos vinculados.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <button
            onClick={() => setShowSingleSlotModal(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-blue-600 shrink-0" />
            <span>+ Horário Avulso</span>
          </button>

          <button
            onClick={openRemoveModalForPeriod}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Remover / Indisponibilizar Período</span>
          </button>

          <button
            onClick={() => {
              setReleaseSlotsDate(selectedDate);
              setReleaseEndDate(addDaysISO(selectedDate, 14));
              setShowReleaseSlotsModal(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer touch-target"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Liberar Agenda (Dia / Semanal / Mensal / Anual)</span>
          </button>
        </div>
      </div>

      {scheduleSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{scheduleSuccess}</span>
        </div>
      )}

      {scheduleError && (
        <div className="p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{scheduleError}</span>
        </div>
      )}

      {/* Date Navigation Bar */}
      <div className="flex items-center justify-between bg-white p-2.5 sm:p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <button
          onClick={() => handleDateChange(-1)}
          className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
          aria-label="Dia Anterior"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs sm:text-sm font-bold text-slate-900 border-none focus:outline-none cursor-pointer bg-transparent max-w-[130px] sm:max-w-none"
            />
          </div>
          <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-200 shrink-0">
            {formatDateBR(selectedDate)}
          </span>
        </div>

        <button
          onClick={() => handleDateChange(1)}
          className="p-1.5 sm:p-2 rounded-xl hover:bg-slate-100 text-slate-600 cursor-pointer shrink-0"
          aria-label="Próximo Dia"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Schedule Info Summary */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 font-medium px-1 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <Sun className="w-3.5 h-3.5 text-amber-500" /> Manhã (06h-12h)
          </span>
          <span className="flex items-center gap-1 font-semibold text-slate-700">
            <Sunset className="w-3.5 h-3.5 text-blue-500" /> Tarde (13h-18h)
          </span>
          <span className="flex items-center gap-1 font-semibold text-indigo-900">
            <Moon className="w-3.5 h-3.5 text-indigo-600" /> Noturno Detran (19h-00h)
          </span>
        </div>
        <span>
          <strong>{dateLessons.length}</strong> aula(s) agendada(s) neste dia · <strong>{dateSlots.filter((s) => !s.bloqueado).length}</strong> horário(s) liberado(s) no dia · <strong>{slots.length}</strong> horários totais na agenda
        </span>
      </div>

      {/* Time Slots Grid */}
      {dateSlots.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 text-center space-y-3">
          <Clock className="w-10 h-10 mx-auto text-slate-300" />
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Nenhum horário liberado para esta data ({formatDateBR(selectedDate)})
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Você pode liberar a agenda apenas para este dia, ou habilitar de uma só vez para a <strong>Semana, Mês, Ano ou Período Personalizado</strong>.
            </p>
          </div>
          <button
            onClick={() => {
              setReleaseSlotsDate(selectedDate);
              setReleaseEndDate(addDaysISO(selectedDate, 14));
              setShowReleaseSlotsModal(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4" />
            Liberar Agenda (Dia / Semanal / Mensal / Anual)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dateSlots.map((slot) => {
            const activeLesson = dateLessons.find((l) => l.horaInicio === slot.horaInicio);
            const student = activeLesson ? allOrgStudents.find((s) => s.id === activeLesson.alunoId) : null;
            const vehicle = activeLesson ? vehicles.find((v) => v.id === activeLesson.veiculoId) : null;
            const badge = getTimeBadge(slot.horaInicio);
            const BadgeIcon = badge.icon;

            return (
              <div
                key={slot.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between space-y-3 ${
                  activeLesson
                    ? 'bg-blue-50/70 border-blue-200 shadow-xs'
                    : slot.bloqueado
                    ? 'bg-slate-100/70 border-slate-200 opacity-75'
                    : 'bg-white border-slate-200 hover:border-indigo-400 hover:shadow-xs'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-xs">
                      {slot.horaInicio} - {slot.horaFim}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold border flex items-center gap-1 ${badge.color}`}>
                      <BadgeIcon className="w-3 h-3 shrink-0" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {activeLesson ? (
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${
                        activeLesson.status === 'CONCLUIDA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {activeLesson.status === 'CONCLUIDA' ? '✓ Concluída' : 'Aluno Agendado'}
                    </span>
                  ) : slot.bloqueado ? (
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" />
                      Bloqueado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                      Livre p/ Aluno
                    </span>
                  )}
                </div>

                {/* Slot Details */}
                {activeLesson ? (
                  <div className="text-xs space-y-1 bg-white/80 p-2.5 rounded-xl border border-blue-100">
                    <p className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>{student?.nome || 'Aluno Agendado'}</span>
                    </p>
                    <p className="text-slate-600">{activeLesson.topico}</p>
                    {vehicle && (
                      <p className="text-xs text-slate-500 font-mono">
                        🚗 {vehicle.modelo.split(' ')[0]} ({vehicle.placa})
                      </p>
                    )}
                    {activeLesson.status === 'CONCLUIDA' && activeLesson.notaAula && (
                      <p className="text-xs text-emerald-700 font-semibold">
                        Nota atribuída: {activeLesson.notaAula}/10
                      </p>
                    )}
                  </div>
                ) : slot.bloqueado ? (
                  <div className="text-xs text-slate-500 italic">
                    {slot.motivoBloqueio || 'Horário bloqueado na agenda do instrutor'}
                  </div>
                ) : (
                  <div className="text-xs text-slate-600 font-medium">
                    Visível e disponível para agendamento dos seus alunos.
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  {activeLesson ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      {activeLesson.status !== 'CONCLUIDA' ? (
                        <>
                          <button
                            onClick={() => {
                              setLessonToComplete(activeLesson);
                              setShowCompleteLessonModal(true);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                          >
                            Concluir & Avaliar
                          </button>
                          <button
                            type="button"
                            onClick={() => openRemoveModalForSingleHour(slot.horaInicio)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                            title="Indisponibilizar este horário e notificar aluno"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                            <span>Desmarcar / Remover</span>
                          </button>
                        </>
                      ) : (
                        <span className="text-emerald-700 font-semibold text-xs">
                          Aula finalizada com sucesso
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenScheduleForSlot(slot.horaInicio)}
                          disabled={slot.bloqueado}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs transition-colors"
                        >
                          Agendar Aula
                        </button>
                        <button
                          onClick={() => handleToggleBlock(slot)}
                          className="text-slate-600 hover:text-slate-900 text-xs underline cursor-pointer font-medium"
                        >
                          {slot.bloqueado ? 'Desbloquear' : 'Bloquear'}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => openRemoveModalForSingleHour(slot.horaInicio)}
                        title="Remover este horário (Dia, Semana, Mês ou Ano)"
                        className="flex items-center gap-1 px-2 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer font-medium"
                        aria-label={`Excluir horário ${slot.horaInicio}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: LIBERAR AGENDA (DIA, PERÍODO, SEMANAL, MENSAL, ANUAL)              */}
      {/* ========================================================================= */}
      {showReleaseSlotsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarRange className="w-5 h-5 text-indigo-600" />
                  <span>Liberar Agenda de Aulas para os Alunos</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Escolha se deseja liberar a agenda para um dia, período, semanal, mensal ou anual.
                </p>
              </div>
              <button onClick={() => setShowReleaseSlotsModal(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1 pr-1">
              {/* 1. Escolha do Período (Dia, Semanal, Mensal, Anual, Período) */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  1. Período de Habilitação da Agenda:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SCOPE_OPTIONS.map((opt) => {
                    const active = releaseScope === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setReleaseScope(opt.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <p className={`text-[11px] mt-0.5 ${active ? 'text-indigo-100' : 'text-slate-500'}`}>
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Data Inicial (e Data Final se Período Personalizado) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {releaseScope === 'DIA' ? 'Data para Liberação:' : 'Data Inicial:'}
                  </label>
                  <input
                    type="date"
                    value={releaseSlotsDate}
                    onChange={(e) => setReleaseSlotsDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                {releaseScope === 'PERIODO' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Data Final do Período:</label>
                    <input
                      type="date"
                      min={releaseSlotsDate}
                      value={releaseEndDate}
                      onChange={(e) => setReleaseEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 3. Dias da Semana (quando Semanal, Mensal, Anual ou Período) */}
              {releaseScope !== 'DIA' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="font-bold text-slate-800">
                      Dias da Semana a Habilitar:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReleaseWeekdays([1, 2, 3, 4, 5])}
                        className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        Seg a Sex
                      </button>
                      <button
                        type="button"
                        onClick={() => setReleaseWeekdays([1, 2, 3, 4, 5, 6])}
                        className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        Seg a Sáb
                      </button>
                      <button
                        type="button"
                        onClick={() => setReleaseWeekdays([0, 1, 2, 3, 4, 5, 6])}
                        className="px-2 py-0.5 bg-white border border-slate-300 rounded text-[11px] font-semibold hover:bg-slate-100 cursor-pointer"
                      >
                        Todos
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAYS_LIST.map((w) => {
                      const isSelected = releaseWeekdays.includes(w.day);
                      return (
                        <button
                          key={w.day}
                          type="button"
                          onClick={() => toggleWeekday(w.day, releaseWeekdays, setReleaseWeekdays)}
                          className={`py-1.5 rounded-lg font-bold text-xs border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                        >
                          {w.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Seleção Rápida de Turno */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Seleção Rápida de Turnos:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('FULL')}
                    className="p-2 border border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-xs cursor-pointer text-center"
                  >
                    Integral (06h-00h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('MORNING')}
                    className="p-2 border border-amber-200 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs cursor-pointer text-center"
                  >
                    Manhã (06h-12h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('AFTERNOON')}
                    className="p-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs cursor-pointer text-center"
                  >
                    Tarde (13h-18h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('NIGHT')}
                    className="p-2 border border-purple-200 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs cursor-pointer text-center"
                  >
                    Noturno (18h-00h)
                  </button>
                </div>
              </div>

              {/* 5. Grade de Horários Clicáveis (06h às 00h) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Horários que serão liberados ({selectedReleaseHours.length} selecionados):
                  </label>
                  <span className="text-xs text-slate-500">Clique para marcar/desmarcar</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-44 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_PERMITTED_HOURS.map((hour) => {
                    const isSelected = selectedReleaseHours.includes(hour);
                    const isNight = parseInt(hour.split(':')[0], 10) >= 19 || hour === '00:00';
                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => toggleHourCheckbox(hour)}
                        className={`p-2 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? isNight
                              ? 'bg-indigo-700 text-white shadow-xs'
                              : 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span>{hour}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Resumo da Liberação */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-xl text-xs space-y-1">
                <p className="font-bold flex items-center justify-between">
                  <span>Resumo da Liberação ({getScopeDisplayName(releaseScope)}):</span>
                  <span className="font-mono bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                    {targetReleaseDates.length} dia(s) × {selectedReleaseHours.length}h = {targetReleaseDates.length * selectedReleaseHours.length} horários
                  </span>
                </p>
                {targetReleaseDates.length > 1 && (
                  <p className="text-slate-600">
                    De <strong>{formatDateBR(targetReleaseDates[0])}</strong> até{' '}
                    <strong>{formatDateBR(targetReleaseDates[targetReleaseDates.length - 1])}</strong>. Todos os alunos vinculados visualizarão os horários imediatamente.
                  </p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowReleaseSlotsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedReleaseHours.length === 0 || targetReleaseDates.length === 0 || isProcessing}
                  onClick={handleReleaseConfiguredSlots}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer shadow-xs w-full sm:w-auto"
                >
                  {isProcessing
                    ? 'Liberando e Sincronizando...'
                    : `Habilitar Agenda (${targetReleaseDates.length} dia(s))`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONFIRMAR REMOÇÃO / INDISPONIBILIZAÇÃO DE HORÁRIOS E AVISAR ALUNOS */}
      {/* ========================================================================= */}
      {showRemoveSlotsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Remover / Indisponibilizar Horário(s) da Agenda
                  </h3>
                  <p className="text-xs text-slate-500">
                    Confirme se deseja remover somente no dia, na semana, no mês, no ano ou em um período.
                  </p>
                </div>
              </div>
              <button onClick={() => setShowRemoveSlotsModal(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1 pr-1">
              {/* 1. Escolha do Período para Remoção */}
              <div>
                <label className="block font-bold text-slate-800 mb-1.5">
                  1. Deseja remover o(s) horário(s) em qual período?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {SCOPE_OPTIONS.map((opt) => {
                    const active = removeScope === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRemoveScope(opt.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          active
                            ? 'bg-rose-600 border-rose-600 text-white shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-800 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>{opt.label}</span>
                          {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </div>
                        <p className={`text-[11px] mt-0.5 ${active ? 'text-rose-100' : 'text-slate-500'}`}>
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Data de Referência / Período */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {removeScope === 'DIA' ? 'Data do Horário:' : 'A partir da Data:'}
                  </label>
                  <input
                    type="date"
                    value={removeBaseDate}
                    onChange={(e) => setRemoveBaseDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
                {removeScope === 'PERIODO' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Até a Data Final:</label>
                    <input
                      type="date"
                      min={removeBaseDate}
                      value={removeEndDate}
                      onChange={(e) => setRemoveEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                    />
                  </div>
                )}
              </div>

              {/* 3. Horários a Remover */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <label className="font-bold text-slate-800">
                    2. Horário(s) a Indisponibilizar ({selectedRemoveHours.length} selecionado(s)):
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleSelectRemovePreset('MORNING')}
                      className="px-2 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      Manhã
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRemovePreset('AFTERNOON')}
                      className="px-2 py-0.5 bg-blue-50 text-blue-900 border border-blue-200 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      Tarde
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRemovePreset('NIGHT')}
                      className="px-2 py-0.5 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      Noite
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectRemovePreset('ALL_DAY_SLOTS')}
                      className="px-2 py-0.5 bg-rose-50 text-rose-900 border border-rose-200 rounded text-[11px] font-semibold cursor-pointer"
                    >
                      Todos
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {ALL_PERMITTED_HOURS.map((hour) => {
                    const isSelected = selectedRemoveHours.includes(hour);
                    return (
                      <button
                        key={hour}
                        type="button"
                        onClick={() => toggleRemoveHourCheckbox(hour)}
                        className={`p-1.5 rounded-lg font-mono text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 shrink-0" />}
                        <span>{hour}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. ALERTA CRÍTICO SE HOUVER ALUNOS AGENDADOS NO PERÍODO */}
              {conflictingBookedLessons.length > 0 ? (
                <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl space-y-3 animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <h4 className="font-extrabold text-rose-950 text-xs sm:text-sm">
                        Atenção: Existe(m) {conflictingBookedLessons.length} aula(s) marcada(s) por aluno(s) {getScopeDisplayName(removeScope)}!
                      </h4>
                      <p className="text-xs text-rose-800 leading-relaxed">
                        Os seguintes alunos possuem aulas agendadas nos horários que você está querendo indisponibilizar:
                      </p>
                    </div>
                  </div>

                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {conflictingBookedLessons.map((lsn) => {
                      const st = allOrgStudents.find((s) => s.id === lsn.alunoId);
                      return (
                        <div
                          key={lsn.id}
                          className="p-2.5 bg-white rounded-xl border border-rose-200 flex items-center justify-between gap-2 text-xs shadow-2xs"
                        >
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">
                              👤 {st?.nome || 'Aluno'} {st?.categoriaCnh ? `(CNH ${st.categoriaCnh})` : ''}
                            </p>
                            <p className="text-slate-600 text-[11px] truncate">{lsn.topico}</p>
                          </div>
                          <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-900 font-mono font-bold text-xs shrink-0">
                            {formatDateBR(lsn.data)} às {lsn.horaInicio}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-rose-300 text-rose-950 font-bold text-xs flex items-start gap-2">
                    <BellRing className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>
                      Deseja remover o(s) horário(s) mesmo assim e notificar automaticamente o(s) aluno(s) na plataforma para que remarquem para uma nova data e horário disponível na agenda?
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl space-y-1">
                  <p className="font-bold flex items-center justify-between">
                    <span>Confirmação de Remoção ({getScopeDisplayName(removeScope)}):</span>
                    <span className="font-mono bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded font-extrabold">
                      {slotsMatchingRemoval.length} horário(s) encontrado(s)
                    </span>
                  </p>
                  <p className="text-xs text-amber-900">
                    Nenhum aluno possui aula marcada nos horários selecionados {getScopeDisplayName(removeScope)}. Ao confirmar, os horários deixarão de aparecer imediatamente na agenda dos alunos.
                  </p>
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setShowRemoveSlotsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Não, Manter Horário(s)
                </button>
                <button
                  type="button"
                  disabled={
                    selectedRemoveHours.length === 0 ||
                    (slotsMatchingRemoval.length === 0 && conflictingBookedLessons.length === 0) ||
                    isProcessing
                  }
                  onClick={handleConfirmRemoveSlots}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer shadow-xs w-full sm:w-auto flex items-center justify-center gap-1.5"
                >
                  {isProcessing ? (
                    <span>Processando e Sincronizando...</span>
                  ) : conflictingBookedLessons.length > 0 ? (
                    <>
                      <BellRing className="w-4 h-4 shrink-0" />
                      <span>Sim, Remover Horário e Notificar Aluno(s)</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 shrink-0" />
                      <span>Confirmar Remoção ({getScopeDisplayName(removeScope)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR HORÁRIO AVULSO ENTRE 06H E 00H                           */}
      {/* ========================================================================= */}
      {showSingleSlotModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Adicionar Horário Avulso</h3>
              <button onClick={() => setShowSingleSlotModal(false)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleCustomSlot} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Selecione o Horário (Faixa das 06h às 00h):
                </label>
                <select
                  value={singleSlotTime}
                  onChange={(e) => setSingleSlotTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono font-bold text-sm"
                >
                  {ALL_PERMITTED_HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h} {parseInt(h.split(':')[0], 10) >= 19 || h === '00:00' ? '(Noturno Detran)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Aplicar este Horário para:
                </label>
                <select
                  value={singleSlotScope}
                  onChange={(e) => setSingleSlotScope(e.target.value as SchedulePeriodScope)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-semibold"
                >
                  <option value="DIA">Apenas no dia ({formatDateBR(selectedDate)})</option>
                  <option value="SEMANAL">Semanal (Próximos 7 dias)</option>
                  <option value="MENSAL">Mensal (Próximos 30 dias)</option>
                  <option value="ANUAL">Anual (Próximos 365 dias)</option>
                </select>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSingleSlotModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer w-full sm:w-auto"
                >
                  {isProcessing ? 'Salvando...' : 'Adicionar à Agenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: AGENDAR AULA                                                      */}
      {/* ========================================================================= */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Agendar Aula Prática</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateLessonSubmit} className="mt-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-0.5">
              {scheduleError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{scheduleError}</span>
                </div>
              )}

              <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-1 text-slate-700">
                <p>Data: <strong className="text-indigo-900">{formatDateBR(selectedDate)}</strong></p>
                <p>Horário: <strong className="text-indigo-900 font-mono">{lessonForm.horaInicio} até {lessonForm.horaFim}</strong></p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Selecione o Aluno *</label>
                <select
                  value={lessonForm.alunoId}
                  onChange={(e) => setLessonForm({ ...lessonForm, alunoId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white font-medium"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} (CNH {s.categoriaCnh} - {s.aulasCumpridas}/{s.totalAulasContratadas} aulas)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Veículo de Instrução *</label>
                <select
                  value={lessonForm.veiculoId}
                  onChange={(e) => setLessonForm({ ...lessonForm, veiculoId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl bg-white"
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.modelo} (Placa: {v.placa})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tema / Conteúdo da Aula *</label>
                <input
                  type="text"
                  required
                  value={lessonForm.topico}
                  onChange={(e) => setLessonForm({ ...lessonForm, topico: e.target.value })}
                  placeholder="Ex: Treino de Baliza e direção noturna"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold cursor-pointer shadow-xs w-full sm:w-auto"
                >
                  Confirmar Agendamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONCLUIR AULA & AVALIAR                                            */}
      {/* ========================================================================= */}
      {showCompleteLessonModal && lessonToComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Concluir Aula Prática</h3>
              <button onClick={() => setShowCompleteLessonModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteLessonSubmit} className="mt-4 space-y-4 text-xs overflow-y-auto flex-1 pr-0.5">
              <div className="p-3 bg-slate-50 rounded-xl">
                <p className="font-bold text-slate-900 text-sm">
                  {allOrgStudents.find((s) => s.id === lessonToComplete.alunoId)?.nome}
                </p>
                <p className="text-slate-500">{lessonToComplete.topico}</p>
                <p className="text-xs font-mono text-indigo-700 mt-0.5">
                  Horário: {lessonToComplete.horaInicio} - {lessonToComplete.horaFim}
                </p>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">Nota de Desempenho (0 a 10)</label>
                  <span className="font-bold font-mono text-base text-indigo-600">{completionGrade}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={completionGrade}
                  onChange={(e) => setCompletionGrade(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Parecer e Feedback para o Aluno
                </label>
                <textarea
                  rows={3}
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Ex: Executou baliza com precisão e manteve boa direção noturna."
                  className="w-full p-3 border border-slate-300 rounded-xl focus:border-indigo-600 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs">
                ✓ Ao confirmar, +1 aula será somada à carga horária cumprida do aluno no sistema.
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCompleteLessonModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Salvar Conclusão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
