import React from 'react';
import {
  X,
  Building,
  Users,
  Car,
  Key,
  Calendar,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Lock,
  DollarSign,
  GraduationCap
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { getPlanDetails } from '../../lib/saasPlans';
import type { Organization, User, Student, Vehicle } from '../../types';

interface OrganizationDetailsModalProps {
  organization: Organization;
  onClose: () => void;
  onOpenEdit: (org: Organization) => void;
  onOpenKeyModal: (org: Organization) => void;
  onOpenResetPass: (user: User) => void;
}

export const OrganizationDetailsModal: React.FC<OrganizationDetailsModalProps> = ({
  organization,
  onClose,
  onOpenEdit,
  onOpenKeyModal,
  onOpenResetPass
}) => {
  const users = db.getUsers(organization.id);
  const students = db.getStudents(organization.id);
  const vehicles = db.getVehicles(organization.id);
  const payments = db.getPayments(organization.id);

  const totalFaturamentoCentavos = payments.reduce((acc, p) => acc + p.valorCentavos, 0);
  const planInfo = getPlanDetails(organization.plano);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-slate-900 via-purple-950 to-slate-900 text-white p-5 sm:p-6 flex items-start justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-white/10 text-purple-300">
                <Building className="w-5 h-5" />
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${planInfo.corBadge}`}>
                PLANO {organization.plano}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                organization.status === 'ATIVO' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
              }`}>
                {organization.status}
              </span>
            </div>
            <h2 className="text-xl font-bold text-white">{organization.nome}</h2>
            <p className="text-xs text-slate-300 font-mono">{organization.cnpjCpf} · {organization.cidade}/{organization.estado}</p>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* Card Resumo da Assinatura SaaS */}
          <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Plano Ativo</span>
              <span className="text-sm font-bold text-purple-900">{planInfo.nome}</span>
              <span className="text-[11px] text-purple-700 block">
                {organization.valorMensalidadeCentavos
                  ? formatCurrencyBRL(organization.valorMensalidadeCentavos) + ' / mês'
                  : 'R$ 0,00'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Vigência da Assinatura</span>
              <span className="text-sm font-bold text-slate-900">
                {organization.dataVencimentoPlano ? formatDateBR(organization.dataVencimentoPlano) : 'Indeterminada'}
              </span>
              <span className="text-[11px] text-slate-500 block">Status: {organization.status}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase font-bold">Chave de Acesso</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-mono font-bold text-xs bg-white px-2 py-0.5 rounded border border-purple-200 text-purple-900">
                  {organization.chaveAcesso || 'Não gerada'}
                </span>
                <button
                  onClick={() => onOpenKeyModal(organization)}
                  className="text-purple-700 hover:text-purple-900 text-[10px] font-bold underline cursor-pointer"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>

          {/* Dados de Contato e Faturamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-900 block text-xs">Informações de Contato</span>
              <div className="space-y-1.5 text-slate-600">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{organization.telefone || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{organization.email || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{organization.cidade} - {organization.estado}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <span className="font-bold text-slate-900 block text-xs">Métricas na Plataforma</span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Instrutores</span>
                  <span className="text-sm font-bold text-slate-900">{users.filter(u => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG').length}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Alunos</span>
                  <span className="text-sm font-bold text-slate-900">{students.length}</span>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">Veículos</span>
                  <span className="text-sm font-bold text-slate-900">{vehicles.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de Instrutores / Gestores com Ação de Reset de Senha */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-purple-600" />
                <span>Instrutores & Usuários Administrativos ({users.length})</span>
              </h3>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
              {users.map((u) => (
                <div key={u.id} className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{u.nome}</span>
                      <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                        {u.papel}
                      </span>
                      {u.senhaTemporaria && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[9px] font-mono">
                          Senha Temp: {u.senhaTemporaria}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-500 text-[11px] font-mono">
                      {u.email} · Tel: {u.telefone || 'S/N'} · CPF: {u.cpfMascarado || '***'}
                    </span>
                  </div>

                  <button
                    onClick={() => onOpenResetPass(u)}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0"
                    title="Resetar senha deste usuário e gerar nova senha temporária"
                  >
                    <Lock className="w-3 h-3 text-amber-700" />
                    <span>Resetar Senha</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Alunos Cadastrados */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>Alunos Vinculados ({students.length})</span>
            </h3>

            {students.length === 0 ? (
              <p className="text-slate-400 text-xs italic">Nenhum aluno matriculado nesta instituição ainda.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {students.map((s) => (
                  <div key={s.id} className="p-2.5 flex items-center justify-between text-[11px] hover:bg-slate-50">
                    <div>
                      <span className="font-semibold text-slate-900">{s.nome}</span>
                      <span className="text-slate-500 font-mono ml-2">CNH {s.categoriaCnh} · {s.cpfMascarado}</span>
                    </div>
                    <span className="text-slate-600 font-mono font-bold">
                      {s.aulasCumpridas}/{s.totalAulasContratadas} aulas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-500">
            Criada em: {formatDateBR(organization.criadoEm)}
          </span>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => onOpenKeyModal(organization)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl cursor-pointer text-xs flex items-center justify-center gap-1"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Gerenciar Chave</span>
            </button>
            <button
              onClick={() => onOpenEdit(organization)}
              className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl cursor-pointer text-xs"
            >
              Editar Instituição & Módulos
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
