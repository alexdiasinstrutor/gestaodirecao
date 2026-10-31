import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Car,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Sliders,
  Check,
  X
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatDateBR } from '../../lib/validation';
import {
  Organization,
  User,
  Lesson,
  AvailableSlot,
  Vehicle,
  Student
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

export const ScheduleView: React.FC<ScheduleViewProps> = ({ currentOrg, currentUser }) => {
  const orgId = currentOrg.id;

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  // Instructor Schedule Limits configuration
  const [startLimitHour, setStartLimitHour] = useState<string>('06:00');
  const [endLimitHour, setEndLimitHour] = useState<string>('00:00');
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

  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedSlotForSchedule, setSelectedSlotForSchedule] = useState<string>('09:00');

  const [showReleaseSlotsModal, setShowReleaseSlotsModal] = useState<boolean>(false);
  const [releaseSlotsDate, setReleaseSlotsDate] = useState<string>(selectedDate);

  const [showSingleSlotModal, setShowSingleSlotModal] = useState<boolean>(false);
  const [singleSlotTime, setSingleSlotTime] = useState<string>('06:00');

  const [showCompleteLessonModal, setShowCompleteLessonModal] = useState<boolean>(false);
  const [lessonToComplete, setLessonToComplete] = useState<Lesson | null>(null);
  const [completionGrade, setCompletionGrade] = useState<number>(9);
  const [completionNote, setCompletionNote] = useState<string>('');

  const [scheduleError, setScheduleError] = useState<string>('');
  const [scheduleSuccess, setScheduleSuccess] = useState<string>('');

  // Data
  const slots = db.getSlots(orgId);
  const lessons = db.getLessons(orgId);
  const students = db.getStudents(orgId);
  const vehicles = db.getVehicles(orgId);

  // Filter for selected date
  const dateSlots = slots
    .filter((s) => s.data === selectedDate)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  const dateLessons = lessons.filter((l) => l.data === selectedDate && l.status !== 'CANCELADA');

  // Form for new lesson
  const [lessonForm, setLessonForm] = useState({
    alunoId: students[0]?.id || '',
    veiculoId: vehicles[0]?.id || '',
    topico: 'Treino de Baliza e Ponto de Embreagem',
    horaInicio: '09:00',
    horaFim: '09:50'
  });

  const handleDateChange = (daysOffset: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + daysOffset);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const handleToggleBlock = (slotId: string, currentBlocked: boolean) => {
    const motivo = currentBlocked ? undefined : 'Bloqueado pelo Instrutor (Indisponível)';
    db.toggleSlotBlock(slotId, motivo);
    setSelectedDate(selectedDate);
  };

  // Quick preset handlers for instructor release limits
  const handleSelectPreset = (preset: 'FULL' | 'MORNING' | 'AFTERNOON' | 'NIGHT') => {
    if (preset === 'FULL') {
      setSelectedReleaseHours([...ALL_PERMITTED_HOURS]);
    } else if (preset === 'MORNING') {
      setSelectedReleaseHours(ALL_PERMITTED_HOURS.filter((h) => {
        const hour = parseInt(h.split(':')[0], 10);
        return hour >= 6 && hour <= 12;
      }));
    } else if (preset === 'AFTERNOON') {
      setSelectedReleaseHours(ALL_PERMITTED_HOURS.filter((h) => {
        const hour = parseInt(h.split(':')[0], 10);
        return hour >= 13 && hour <= 18;
      }));
    } else if (preset === 'NIGHT') {
      setSelectedReleaseHours(ALL_PERMITTED_HOURS.filter((h) => {
        const hour = parseInt(h.split(':')[0], 10);
        return (hour >= 18 && hour <= 23) || h === '00:00';
      }));
    }
  };

  const toggleHourCheckbox = (hour: string) => {
    if (selectedReleaseHours.includes(hour)) {
      setSelectedReleaseHours(selectedReleaseHours.filter((h) => h !== hour));
    } else {
      setSelectedReleaseHours([...selectedReleaseHours, hour]);
    }
  };

  const handleReleaseConfiguredSlots = () => {
    selectedReleaseHours.forEach((startTime) => {
      let endTime = '';
      if (startTime === '00:00') {
        endTime = '00:50';
      } else {
        const parts = startTime.split(':');
        const hour = parseInt(parts[0], 10);
        endTime = `${String(hour).padStart(2, '0')}:50`;
      }

      const slotId = `slt_${releaseSlotsDate}_${startTime.replace(':', '')}`;
      const existing = slots.find((s) => s.data === releaseSlotsDate && s.horaInicio === startTime);
      if (!existing) {
        db.saveSlot({
          id: slotId,
          organizacaoId: orgId,
          instrutorId: currentUser.id,
          data: releaseSlotsDate,
          horaInicio: startTime,
          horaFim: endTime,
          bloqueado: false
        });
      }
    });

    setShowReleaseSlotsModal(false);
    setSelectedDate(releaseSlotsDate);
    setScheduleSuccess(`Grade das 06h às 00h liberada com sucesso para ${formatDateBR(releaseSlotsDate)}!`);
    setTimeout(() => setScheduleSuccess(''), 3500);
  };

  const handleAddSingleCustomSlot = (e: React.FormEvent) => {
    e.preventDefault();
    let endTime = '';
    if (singleSlotTime === '00:00') {
      endTime = '00:50';
    } else {
      const parts = singleSlotTime.split(':');
      const hour = parseInt(parts[0], 10);
      endTime = `${String(hour).padStart(2, '0')}:50`;
    }

    const slotId = `slt_${selectedDate}_${singleSlotTime.replace(':', '')}`;
    const existing = slots.find((s) => s.data === selectedDate && s.horaInicio === singleSlotTime);
    if (existing) {
      setScheduleError(`O horário ${singleSlotTime} já existe na agenda deste dia.`);
      return;
    }

    db.saveSlot({
      id: slotId,
      organizacaoId: orgId,
      instrutorId: currentUser.id,
      data: selectedDate,
      horaInicio: singleSlotTime,
      horaFim: endTime,
      bloqueado: false
    });

    setShowSingleSlotModal(false);
    setScheduleSuccess(`Horário ${singleSlotTime} adicionado com sucesso para ${formatDateBR(selectedDate)}!`);
    setTimeout(() => setScheduleSuccess(''), 3000);
  };

  const handleOpenScheduleForSlot = (time: string) => {
    let endTime = '';
    if (time === '00:00') {
      endTime = '00:50';
    } else {
      const parts = time.split(':');
      const hour = parseInt(parts[0], 10);
      endTime = `${String(hour).padStart(2, '0')}:50`;
    }

    setSelectedSlotForSchedule(time);
    setLessonForm({
      ...lessonForm,
      horaInicio: time,
      horaFim: endTime
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
    setScheduleSuccess(`Aula prática agendada com sucesso para ${formatDateBR(selectedDate)} às ${lessonForm.horaInicio}!`);
    setTimeout(() => setScheduleSuccess(''), 3000);
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
    setScheduleSuccess('Aula concluída e carga horária do aluno creditada com sucesso!');
    setTimeout(() => setScheduleSuccess(''), 3000);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Agenda Prática & Gestão de Horários
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-[11px] font-bold border border-indigo-200">
              Faixa: 06h às 00h
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            O instrutor define o limite dos horários liberados para agendamento, com suporte completo a aulas matutinas e noturnas obrigatórias do Detran.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowSingleSlotModal(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition-colors cursor-pointer w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 text-blue-600 shrink-0" />
            <span>+ Horário Avulso</span>
          </button>
          <button
            onClick={() => {
              setReleaseSlotsDate(selectedDate);
              setShowReleaseSlotsModal(true);
            }}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer touch-target w-full sm:w-auto"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>Liberar Grade (06h às 00h)</span>
          </button>
        </div>
      </div>

      {scheduleSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{scheduleSuccess}</span>
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
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 font-medium px-1">
        <div className="flex items-center gap-3">
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
          {dateLessons.length} aula(s) agendada(s) · {dateSlots.filter((s) => !s.bloqueado).length} horário(s) liberado(s)
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
              Como instrutor, você pode liberar toda a grade do dia (das 06h às 00h) ou turnos específicos para permitir o agendamento dos alunos.
            </p>
          </div>
          <button
            onClick={() => {
              setReleaseSlotsDate(selectedDate);
              setShowReleaseSlotsModal(true);
            }}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs inline-flex items-center gap-1.5"
          >
            <Sliders className="w-4 h-4" />
            Configurar e Liberar Horários (06h às 00h)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {dateSlots.map((slot) => {
            const activeLesson = dateLessons.find((l) => l.horaInicio === slot.horaInicio);
            const student = activeLesson ? students.find((s) => s.id === activeLesson.alunoId) : null;
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
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border flex items-center gap-1 ${badge.color}`}>
                      <BadgeIcon className="w-3 h-3 shrink-0" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {activeLesson ? (
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                        activeLesson.status === 'CONCLUIDA'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-blue-600 text-white'
                      }`}
                    >
                      {activeLesson.status === 'CONCLUIDA' ? '✓ Concluída' : 'Agendada'}
                    </span>
                  ) : slot.bloqueado ? (
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 shrink-0">
                      <Lock className="w-3 h-3" />
                      Bloqueado
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold shrink-0">
                      Livre p/ Aluno
                    </span>
                  )}
                </div>

                {/* Slot Details */}
                {activeLesson ? (
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-slate-900 text-sm">{student?.nome || 'Aluno'}</p>
                    <p className="text-slate-600">{activeLesson.topico}</p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      🚗 {vehicle?.modelo.split(' ')[0]} ({vehicle?.placa})
                    </p>
                    {activeLesson.status === 'CONCLUIDA' && activeLesson.notaAula && (
                      <p className="text-[11px] text-emerald-700 font-semibold">
                        Nota atribuída: {activeLesson.notaAula}/10
                      </p>
                    )}
                  </div>
                ) : slot.bloqueado ? (
                  <div className="text-xs text-slate-500 italic">
                    {slot.motivoBloqueio || 'Horário bloqueado na agenda do instrutor'}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400">
                    Disponível para agendamento dos alunos no portal (06h-00h).
                  </div>
                )}

                {/* Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                  {activeLesson ? (
                    activeLesson.status !== 'CONCLUIDA' ? (
                      <button
                        onClick={() => {
                          setLessonToComplete(activeLesson);
                          setShowCompleteLessonModal(true);
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                      >
                        Concluir Aula & Avaliar
                      </button>
                    ) : (
                      <span className="text-emerald-700 font-semibold text-[11px]">
                        Aula finalizada com sucesso
                      </span>
                    )
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenScheduleForSlot(slot.horaInicio)}
                        disabled={slot.bloqueado}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold rounded-lg text-xs cursor-pointer shadow-xs"
                      >
                        Agendar Aula
                      </button>
                      <button
                        onClick={() => handleToggleBlock(slot.id, slot.bloqueado)}
                        className="text-slate-500 hover:text-slate-800 text-[11px] underline cursor-pointer"
                      >
                        {slot.bloqueado ? 'Desbloquear' : 'Bloquear'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEFINIR LIMITES DO HORÁRIO E LIBERAR GRADE (06h às 00h)            */}
      {/* ========================================================================= */}
      {showReleaseSlotsModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Definição de Limites & Liberação da Agenda
                </h3>
                <p className="text-xs text-slate-500">
                  O instrutor define os limites de atendimento da sua agenda (06h às 00h).
                </p>
              </div>
              <button onClick={() => setShowReleaseSlotsModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1 pr-0.5">
              {/* Data da Liberação */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Data para Liberação</label>
                <input
                  type="date"
                  value={releaseSlotsDate}
                  onChange={(e) => setReleaseSlotsDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                />
              </div>

              {/* Botões Rápidos de Seleção de Turno */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Seleção Rápida de Turnos:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('FULL')}
                    className="p-2 border border-indigo-200 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-bold text-[11px] cursor-pointer text-center"
                  >
                    Integral (06h-00h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('MORNING')}
                    className="p-2 border border-amber-200 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-[11px] cursor-pointer text-center"
                  >
                    Manhã (06h-12h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('AFTERNOON')}
                    className="p-2 border border-blue-200 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-[11px] cursor-pointer text-center"
                  >
                    Tarde (13h-18h)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPreset('NIGHT')}
                    className="p-2 border border-purple-200 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-[11px] cursor-pointer text-center"
                  >
                    Noturno (18h-00h)
                  </button>
                </div>
              </div>

              {/* Grade de Horários Clicáveis (06h às 00h) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700">
                    Horários que serão liberados ({selectedReleaseHours.length} selecionados):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Clique para alternar
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
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

              <div className="p-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl text-[11px] space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5" />
                  Regulamentação de Aulas Noturnas:
                </p>
                <p className="text-slate-600">
                  Ao liberar horários das 18h até 00h, os alunos poderão cumprir a carga horária noturna obrigatória exigida pelo Detran/Contran diretamente pelo sistema.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowReleaseSlotsModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl font-semibold cursor-pointer w-full sm:w-auto"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={selectedReleaseHours.length === 0}
                  onClick={handleReleaseConfiguredSlots}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer shadow-xs w-full sm:w-auto"
                >
                  Liberar {selectedReleaseHours.length} Horários
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
              <button onClick={() => setShowSingleSlotModal(false)} className="text-slate-400 hover:text-slate-700 p-1">
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer w-full sm:w-auto"
                >
                  Adicionar à Agenda
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
                  {students.find((s) => s.id === lessonToComplete.alunoId)?.nome}
                </p>
                <p className="text-slate-500">{lessonToComplete.topico}</p>
                <p className="text-[11px] font-mono text-indigo-700 mt-0.5">
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

              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-[11px]">
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
