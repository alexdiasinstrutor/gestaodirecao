import React, { useState } from 'react';
import {
  Car,
  Calendar,
  Clock,
  Award,
  CreditCard,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  User,
  Phone,
  ShieldCheck,
  X
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generatePixCopiaECola } from '../../lib/whatsapp';
import {
  Student,
  User as UserType,
  Organization,
  Lesson,
  AvailableSlot,
  AccountReceivable
} from '../../types';

interface StudentPortalProps {
  currentUser: UserType;
  currentOrg: Organization;
}

export const StudentPortal: React.FC<StudentPortalProps> = ({ currentUser, currentOrg }) => {
  const orgId = currentOrg.id;

  // Find student entity matching this user (by email or id)
  const students = db.getStudents(orgId);
  const student = students.find((s) => s.email.toLowerCase() === currentUser.email.toLowerCase()) || students[0];

  const instructor = db.getUsers(orgId).find((u) => u.id === student?.instrutorId) || db.getUsers(orgId)[1];
  const vehicles = db.getVehicles(orgId);
  const lessons = db.getLessonsByStudent(student?.id || '');
  const accounts = db.getAccountsReceivable(orgId).filter((a) => a.alunoId === student?.id);

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

  // Available slots for selected date
  const allSlots = db.getSlots(orgId);
  const allOrgLessons = db.getLessons(orgId);

  const availableSlotsOnDate = allSlots.filter((slot) => {
    if (slot.data !== scheduleDate) return false;
    if (slot.bloqueado) return false;

    // Check if slot already has an active lesson booked by anyone
    const isBooked = allOrgLessons.some(
      (l) => l.data === scheduleDate && l.horaInicio === slot.horaInicio && l.status !== 'CANCELADA'
    );
    return !isBooked;
  });

  const progressPercent = student
    ? Math.min(100, Math.round((student.aulasCumpridas / student.totalAulasContratadas) * 100))
    : 0;

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
    setScheduleSuccess(`Aula prática agendada com sucesso para ${formatDateBR(scheduleDate)} às ${selectedSlot}!`);
    setTimeout(() => setScheduleSuccess(''), 4000);
  };

  const handleOpenPixModal = (acc: AccountReceivable) => {
    setSelectedAccountForPix(acc);
    setShowPixModal(true);
    setPixCopied(false);
  };

  const handleCopyPixCode = () => {
    if (!selectedAccountForPix) return;
    const payload = selectedAccountForPix.pixPayload || generatePixCopiaECola('financeiro@direcaosegura.com.br', currentOrg.nome, selectedAccountForPix.saldoDevedorCentavos, `REC${selectedAccountForPix.id}`);
    navigator.clipboard.writeText(payload);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
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
            <span className="text-[11px] text-emerald-300 font-medium block">Carga Horária Obrigatória</span>
            <span className="text-xl sm:text-2xl font-extrabold font-mono text-white">
              {student.aulasCumpridas} / {student.totalAulasContratadas} Aulas
            </span>
            <span className="text-[11px] text-slate-300 block">{progressPercent}% do curso prático concluído</span>
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

      {/* Main Grid: Book a Lesson & Skills Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION: AGENDAR NOVA AULA PRÁTICA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Agendar Nova Aula Prática
            </h2>
            <span className="text-xs text-slate-500">
              Apenas horários liberados e sem conflitos
            </span>
          </div>

          {scheduleError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{scheduleError}</span>
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
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 font-bold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block font-semibold text-slate-700">
                  Horários Liberados pelo Instrutor para {formatDateBR(scheduleDate)}:
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  Faixa disponível: 06h às 00h
                </span>
              </div>
              {availableSlotsOnDate.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p>Nenhum horário livre ou liberado pelo instrutor para esta data.</p>
                  <p className="text-[11px] mt-0.5 text-slate-500">Experimente selecionar outro dia no calendário acima.</p>
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
                            className={`py-2 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                              isSelected
                                ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                                : isNight
                                ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900 hover:border-indigo-400'
                                : isMorning
                                ? 'bg-amber-50/50 border-amber-200 text-amber-900 hover:border-amber-400'
                                : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-blue-400 hover:bg-blue-50'
                            }`}
                          >
                            <span className="font-mono text-xs">{slot.horaInicio}</span>
                            <span className="text-[9px] font-medium opacity-80">
                              {isNight ? '🌙 Noturno' : isMorning ? '☀️ Manhã' : '🌤️ Tarde'}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                  <p className="text-[10px] text-slate-400 text-right">
                    * Aulas no período noturno (a partir das 19h até 00h) contam para a exigência de prática noturna do Detran.
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
                placeholder="Ex: Baliza de 3 pontos e estacionamento em 45 graus"
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

        {/* SECTION: MEU PROGRESSO & 8 COMPETÊNCIAS */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-500" />
              Minhas Notas & Domínio Prático
            </h2>
            <span className="text-xs text-blue-600 font-bold">
              Avaliação Oficial Detran
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
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-slate-700">{skill.label}</span>
                  <span className="font-bold font-mono text-slate-900">{skill.score.toFixed(1)} / 10</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      skill.score >= 8 ? 'bg-emerald-500' : skill.score >= 6 ? 'bg-blue-500' : 'bg-amber-500'
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
      </div>

      {/* Two Column: Upcoming Scheduled Lessons & Invoices/Payments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Minhas Aulas Agendadas */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Minhas Aulas de Direção ({lessons.length})
          </h2>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {lessons.map((lsn) => (
              <div
                key={lsn.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">
                    {formatDateBR(lsn.data)} às {lsn.horaInicio} - {lsn.horaFim}
                  </p>
                  <p className="text-slate-500 text-[11px]">{lsn.topico}</p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                    lsn.status === 'CONCLUIDA'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}
                >
                  {lsn.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Faturas & Pagamento PIX */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            Minhas Mensalidades & Pagamentos PIX
          </h2>

          <div className="space-y-2.5">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{acc.descricao}</p>
                  <p className="text-[11px] text-slate-500">
                    Vencimento: {formatDateBR(acc.dataVencimento)} · Saldo: <strong className="text-slate-900 font-mono">{formatCurrencyBRL(acc.saldoDevedorCentavos)}</strong>
                  </p>
                </div>

                <div className="w-full sm:w-auto">
                  {acc.saldoDevedorCentavos > 0 ? (
                    <button
                      onClick={() => handleOpenPixModal(acc)}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Pagar c/ PIX
                    </button>
                  ) : (
                    <span className="text-emerald-700 font-semibold flex items-center justify-center sm:justify-end gap-1 py-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Quitado
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
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

            {/* Simulated QR Code Visual */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl inline-block mx-auto">
              <div className="w-40 h-40 bg-white border border-slate-300 rounded-xl flex items-center justify-center p-2 relative shadow-xs">
                <QrCode className="w-36 h-36 text-slate-900" />
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-500">{selectedAccountForPix.descricao}</p>
              <p className="text-xl font-extrabold font-mono text-emerald-700 mt-0.5">
                {formatCurrencyBRL(selectedAccountForPix.saldoDevedorCentavos)}
              </p>
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
              <p className="text-[11px] text-slate-400">
                Abra o app do seu banco, escolha <strong>PIX Copia e Cola</strong> e efetue o pagamento. O instrutor receberá a confirmação imediatamente.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
