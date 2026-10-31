import React from 'react';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  Calendar,
  Fuel,
  ArrowUpRight,
  ArrowDownRight,
  MessageSquare,
  PlusCircle,
  Clock,
  Car,
  CheckCircle2,
  Package
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { User, Organization } from '../../types';

interface InstructorDashboardProps {
  currentUser: User;
  currentOrg: Organization;
  onNavigate: (tab: string) => void;
  onOpenInvite: () => void;
  onOpenNewStudent: () => void;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  currentUser,
  currentOrg,
  onNavigate,
  onOpenInvite,
  onOpenNewStudent
}) => {
  const orgId = currentOrg.id;

  const students = db.getStudents(orgId);
  const lessons = db.getLessons(orgId);
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);
  const expenses = db.getExpenses(orgId);
  const investments = db.getInvestments(orgId);
  const vehicles = db.getVehicles(orgId);

  // Financial calculations
  const totalRecebidoCentavos = payments.reduce((acc, p) => acc + p.valorCentavos, 0);
  const totalPendenteCentavos = accounts
    .filter((a) => a.status === 'PENDENTE' || a.status === 'PARCIAL')
    .reduce((acc, a) => acc + a.saldoDevedorCentavos, 0);
  const totalVencidoCentavos = accounts
    .filter((a) => a.status === 'VENCIDO')
    .reduce((acc, a) => acc + a.saldoDevedorCentavos, 0);

  const totalDespesasPagasCentavos = expenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, e) => acc + e.valorCentavos, 0);

  const saldoLiquidoCentavos = totalRecebidoCentavos - totalDespesasPagasCentavos;

  const totalInvestimentosCentavos = investments.reduce(
    (acc, i) => acc + i.valorAcumuladoCentavos,
    0
  );

  // Lessons today
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLessons = lessons.filter((l) => l.data === todayStr);

  // Overdue accounts for WhatsApp action
  const overdueAccounts = accounts.filter((a) => a.status === 'VENCIDO');

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-blue-400 tracking-wider uppercase">
              Painel de Gestão & Indicadores
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">
              Olá, {currentUser.nome.split(' ')[0]}! 🚗
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Organização: <strong className="text-white">{currentOrg.nome}</strong>. Acompanhe seus recebíveis, aulas práticas agendadas e controle financeiro.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenNewStudent}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target shadow-sm"
            >
              <PlusCircle className="w-4 h-4" />
              Novo Aluno (18+)
            </button>
            <button
              onClick={() => onNavigate('FINANCE')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target border border-slate-700"
            >
              <Package className="w-4 h-4 text-purple-400" />
              Pacotes de Aulas
            </button>
            <button
              onClick={onOpenInvite}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target border border-slate-600"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              Convidar via WhatsApp
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Recebido */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Recebido Total</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
              {formatCurrencyBRL(totalRecebidoCentavos)}
            </p>
            <p className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
              <ArrowUpRight className="w-3 h-3" />
              Entradas comprovadas
            </p>
          </div>
        </div>

        {/* Em Aberto / Pendente */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">A Receber (No Prazo)</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-extrabold text-blue-700 tracking-tight">
              {formatCurrencyBRL(totalPendenteCentavos)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">Parcelas a vencer</p>
          </div>
        </div>

        {/* Inadimplência / Vencido */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-700">Atrasados / Vencidos</span>
            <div className="p-2 rounded-xl bg-red-100 text-red-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-lg sm:text-xl font-extrabold text-red-600 tracking-tight">
              {formatCurrencyBRL(totalVencidoCentavos)}
            </p>
            <button
              onClick={() => onNavigate('WHATSAPP')}
              className="text-[11px] text-red-700 font-semibold hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
            >
              <span>{overdueAccounts.length} cobrança(s) pendente(s)</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Saldo Líquido Operacional */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Saldo Líquido</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-lg sm:text-xl font-extrabold tracking-tight ${saldoLiquidoCentavos >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
              {formatCurrencyBRL(saldoLiquidoCentavos)}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Receitas (-) Despesas Pagas
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Quick Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Alunos Ativos</p>
            <p className="text-base font-bold text-slate-900">{students.length}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Aulas Hoje</p>
            <p className="text-base font-bold text-slate-900">{todayLessons.length}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
            <Fuel className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Despesas Pagas</p>
            <p className="text-base font-bold text-slate-900">{formatCurrencyBRL(totalDespesasPagasCentavos)}</p>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Investimentos</p>
            <p className="text-base font-bold text-slate-900">{formatCurrencyBRL(totalInvestimentosCentavos)}</p>
          </div>
        </div>
      </div>

      {/* Overdue Alert Banner if any */}
      {overdueAccounts.length > 0 && (
        <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white p-4 rounded-2xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold">
                Existem {overdueAccounts.length} aluno(s) com parcelas vencidas aguardando cobrança
              </p>
              <p className="text-xs text-red-100">
                Total em atraso: {formatCurrencyBRL(totalVencidoCentavos)}. Envie um lembrete com PIX copia e cola pelo WhatsApp em 1 clique.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('WHATSAPP')}
            className="px-4 py-2 bg-white text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-colors shadow-xs cursor-pointer shrink-0"
          >
            Cobrar via WhatsApp
          </button>
        </div>
      )}

      {/* Two Column Layout: Today's Schedule & Quick Cash Flow */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Aulas do Dia */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              Aulas Práticas de Hoje ({todayLessons.length})
            </h2>
            <button
              onClick={() => onNavigate('SCHEDULE')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Ver Agenda Completa →
            </button>
          </div>

          {todayLessons.length === 0 ? (
            <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs">Nenhuma aula agendada para hoje até o momento.</p>
              <button
                onClick={() => onNavigate('SCHEDULE')}
                className="mt-2 text-xs text-blue-600 font-semibold hover:underline cursor-pointer"
              >
                Liberar horários na agenda
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayLessons.map((lesson) => {
                const student = students.find((s) => s.id === lesson.alunoId);
                const vehicle = vehicles.find((v) => v.id === lesson.veiculoId);
                return (
                  <div
                    key={lesson.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-mono font-bold text-xs shrink-0">
                        {lesson.horaInicio}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 leading-snug truncate">{student?.nome || 'Aluno'}</p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {lesson.topico} · {vehicle?.modelo.split(' ')[0] || 'Carro'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          lesson.status === 'CONCLUIDA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {lesson.status === 'CONCLUIDA' ? '✓ Concluída' : 'Agendada'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo de Despesas Recentes */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-4">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Fuel className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Despesas e Gastos Operacionais</span>
            </h2>
            <button
              onClick={() => onNavigate('FINANCE')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer self-start sm:self-auto"
            >
              Ver Finanças & DRE →
            </button>
          </div>

          <div className="space-y-2.5">
            {expenses.slice(0, 4).map((exp) => (
              <div
                key={exp.id}
                className="p-3 rounded-xl border border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-slate-900 leading-snug break-words">{exp.descricao}</p>
                  <p className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1 mt-0.5">
                    <span className="font-medium text-slate-600">{exp.categoria.replace(/_/g, ' ')}</span>
                    <span className="text-slate-300">·</span>
                    <span>Vencimento: {formatDateBR(exp.dataVencimento)}</span>
                  </p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 shrink-0">
                  <p className="font-bold text-slate-900 font-mono text-sm">
                    {formatCurrencyBRL(exp.valorCentavos)}
                  </p>
                  <span
                    className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded ${
                      exp.status === 'PAGA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {exp.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
function ArrowRight(props: any) {
  return (
    <svg {...props} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  );
}
