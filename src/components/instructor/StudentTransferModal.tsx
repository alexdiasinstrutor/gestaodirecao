import React, { useState } from 'react';
import {
  X,
  ArrowRightLeft,
  UserCheck,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Clock,
  Car,
  FileText,
  HelpCircle
} from 'lucide-react';
import { db } from '../../lib/storage';
import { Student, User, Organization } from '../../types';
import { formatDateBR } from '../../lib/validation';

interface StudentTransferModalProps {
  student: Student;
  currentOrg: Organization;
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedStudent: Student) => void;
}

export const StudentTransferModal: React.FC<StudentTransferModalProps> = ({
  student,
  currentOrg,
  currentUser,
  onClose,
  onSuccess
}) => {
  const orgId = currentOrg.id;
  const allInstructors = db
    .getUsers(orgId)
    .filter((u) => (u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG') && u.id !== student.instrutorId);

  const currentInstructor = db.getUsers(orgId).find((u) => u.id === student.instrutorId);

  const [selectedTargetInstructorId, setSelectedTargetInstructorId] = useState<string>(
    allInstructors[0]?.id || ''
  );
  const [transferReason, setTransferReason] = useState<string>('Incompatibilidade de horários do aluno');
  const [customReasonDetails, setCustomReasonDetails] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const presetReasons = [
    'Incompatibilidade de horários do aluno',
    'Solicitação expressa do aluno condutor',
    'Reorganização da escala / frota da instituição',
    'Mudança de rota / bairro de treinamento',
    'Adaptação pedagógica de direção'
  ];

  const handleConfirmTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedTargetInstructorId) {
      setError('Por favor, selecione o instrutor destinatário da transferência.');
      return;
    }

    const fullReason = customReasonDetails.trim()
      ? `${transferReason} - ${customReasonDetails.trim()}`
      : transferReason;

    if (!fullReason.trim()) {
      setError('Informe o motivo formal da transferência para fins de registro e auditoria.');
      return;
    }

    setLoading(true);

    try {
      const res = db.transferStudent({
        alunoId: student.id,
        instrutorDestinoId: selectedTargetInstructorId,
        motivo: fullReason,
        actorId: currentUser.id,
        actorNome: currentUser.nome
      });

      if (!res.success) {
        setError(res.error || 'Não foi possível efetuar a transferência do aluno.');
        setLoading(false);
        return;
      }

      const refreshedStudent = db.getStudentById(student.id);
      if (refreshedStudent) {
        onSuccess(refreshedStudent);
      } else {
        onClose();
      }
    } catch (err: any) {
      setError('Erro ao processar transferência: ' + (err?.message || 'Tente novamente.'));
      setLoading(false);
    }
  };

  const targetInstructor = allInstructors.find((i) => i.id === selectedTargetInstructorId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Transferência Oficial de Instrutor</h2>
              <p className="text-xs text-slate-300">Vínculo individual e trilha de auditoria permanente</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleConfirmTransfer} className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Business rule callout */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Regra de Vínculo: 1 Aluno (CPF) acondicionado a 1 Instrutor</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              O aluno é condicionado exclusivamente a apenas um instrutor ativo por vez. Ao transferir, o novo instrutor assumirá a gestão da agenda e o progresso prático. <strong>Todo o histórico anterior de aulas, notas, pagamentos e pareceres será 100% preservado</strong> para auditoria.
            </p>
          </div>

          {/* Student summary card */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Aluno Selecionado</span>
                <p className="text-sm font-extrabold text-slate-900">{student.nome}</p>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-200 font-mono text-[11px] font-bold text-slate-700">
                {student.cpfMascarado}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-500 block">Instrutor Atual:</span>
                <span className="font-bold text-slate-800">{currentInstructor?.nome || 'Instrutor Atual'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Progresso de Aulas:</span>
                <span className="font-bold text-slate-800 font-mono">
                  {student.aulasCumpridas} de {student.totalAulasContratadas} aulas
                </span>
              </div>
            </div>
          </div>

          {/* Target Instructor Selector */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Novo Instrutor Destinatário *
            </label>
            {allInstructors.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                Nenhum outro instrutor cadastrado nesta organização no momento. Cadastre outro instrutor no sistema para transferir alunos.
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={selectedTargetInstructorId}
                  onChange={(e) => setSelectedTargetInstructorId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white text-xs font-semibold"
                >
                  {allInstructors.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.nome} · Tel: {inst.telefone} (CPF Final {inst.cpfUltimos4})
                    </option>
                  ))}
                </select>

                {targetInstructor && (
                  <p className="text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                    <UserCheck className="w-3.5 h-3.5" />
                    Destinatário homologado: {targetInstructor.nome}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Reason preset buttons */}
          <div>
            <label className="block font-bold text-slate-800 mb-1">
              Motivo Formal da Transferência *
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {presetReasons.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setTransferReason(reason)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                    transferReason === reason
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <textarea
              rows={2}
              value={customReasonDetails}
              onChange={(e) => setCustomReasonDetails(e.target.value)}
              placeholder="Complemento / Justificativa detalhada para o registro de auditoria (opcional)..."
              className="w-full p-2.5 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none text-xs"
            />
          </div>

          {/* Previous transfer history if any */}
          {student.historicoTransferencias && student.historicoTransferencias.length > 0 && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
              <span className="font-bold text-slate-700 text-[10px] uppercase block">
                Histórico de Transferências Anteriores ({student.historicoTransferencias.length})
              </span>
              <div className="space-y-1 text-[11px] text-slate-600 max-h-24 overflow-y-auto">
                {student.historicoTransferencias.map((trf) => (
                  <div key={trf.id} className="p-1.5 bg-white rounded border border-slate-200">
                    <span className="font-semibold text-slate-800">
                      De {trf.instrutorAnteriorNome} para {trf.instrutorNovoNome}
                    </span>
                    <p className="text-[10px] text-slate-500">
                      {formatDateBR(trf.dataTransferencia.slice(0, 10))} · Motivo: {trf.motivo} (Autor: {trf.autorNome})
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-200 flex flex-col-reverse sm:flex-row justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 cursor-pointer w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || allInstructors.length === 0}
              className="flex items-center justify-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl font-bold shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>{loading ? 'Processando...' : 'Confirmar Transferência'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
