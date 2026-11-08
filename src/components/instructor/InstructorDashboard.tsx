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
  Package,
  QrCode,
  LayoutGrid,
  Ticket,
  ShieldCheck,
  Sparkles,
  MapPin,
  Bell
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { getPlanDetails } from '../../lib/saasPlans';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { User, Organization } from '../../types';

interface InstructorDashboardProps {
  currentUser: User;
  currentOrg: Organization;
  onNavigate: (tab: string) => void;
  onOpenInvite: () => void;
  onOpenNewStudent: () => void;
  onOpenPixConfig?: () => void;
  isSimplified?: boolean;
  onSwitchToFullMode?: () => void;
}

export const InstructorDashboard: React.FC<InstructorDashboardProps> = ({
  currentUser,
  currentOrg,
  onNavigate,
  onOpenInvite,
  onOpenNewStudent,
  onOpenPixConfig,
  isSimplified = false,
  onSwitchToFullMode
}) => {
  const orgId = currentOrg.id;

  const students = db.getStudents(orgId, currentUser.id);
  const lessons = db.getLessons(orgId);
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);
  const expenses = db.getExpenses(orgId);
  const investments = db.getInvestments(orgId);
  const vehicles = db.getVehicles(orgId);
  const studentLeads = db.getStudentLeads();
  const savedCoverage = db.getInstructorCoverage(currentUser.id);

  // SaaS Plan & Coupons Information
  const planDetails = getPlanDetails(currentOrg.plano);
  const instructorCoupons = db.getCoupons({ escopo: 'ALUNO', instrutorId: currentUser.id });
  const activeCouponsCount = instructorCoupons.filter((c) => c.ativo).length;
  const totalCouponsUsed = instructorCoupons.reduce((sum, c) => sum + (c.usosRealizados || 0), 0);

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
    <div className="space-y-4 sm:space-y-6">
      {/* Top Banner / Actions */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div>
            <span className="text-xs font-bold text-blue-300 tracking-wider uppercase">
              {isSimplified ? 'Operação Rápida do Instrutor' : 'Painel de Gestão & Indicadores'}
            </span>
            <h1 className="text-lg sm:text-2xl font-extrabold text-white mt-0.5">
              Olá, {currentUser.nome.split(' ')[0]}! 🚗
            </h1>
            {!isSimplified && (
              <p className="text-xs sm:text-sm text-slate-200 mt-1 max-w-xl">
                Organização: <strong className="text-white">{currentOrg.nome}</strong>. Acompanhe seus recebíveis, aulas práticas agendadas e controle financeiro.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onOpenNewStudent}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target shadow-sm"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Novo Aluno</span>
            </button>
            <button
              onClick={() => onNavigate('FINANCE')}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target shadow-sm"
              title="Gerar cupons de desconto para os alunos"
            >
              <Ticket className="w-4 h-4 shrink-0" />
              <span>Gerar Cupom</span>
            </button>
            {onOpenPixConfig && (
              <button
                onClick={onOpenPixConfig}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target shadow-sm"
              >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Chave PIX</span>
              </button>
            )}
            {!isSimplified && (
              <button
                onClick={() => onNavigate('FINANCE')}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target border border-slate-700"
              >
                <Package className="w-4 h-4 text-purple-400 shrink-0" />
                <span>Pacotes de Aulas</span>
              </button>
            )}
            <button
              onClick={() => onNavigate('VEHICLES')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target border border-slate-700"
            >
              <Car className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Meus Veículos ({vehicles.length})</span>
            </button>
            <button
              onClick={onOpenInvite}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer touch-target border border-slate-600"
            >
              <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Convidar Aluno</span>
            </button>
          </div>
        </div>
      </div>

      {/* SaaS Plan & Coupons Quick Status Card */}
      <div className="bg-gradient-to-r from-purple-900/10 via-indigo-900/5 to-blue-900/10 border border-purple-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900">Seu Plano:</span>
                <span className={`px-2 py-0.5 rounded-full border text-xs font-extrabold ${planDetails.corBadge}`}>
                  {planDetails.nome}
                </span>
                {currentOrg.status === 'TESTE' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold">
                    Período de Teste
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-700 font-medium mt-1">
                {currentOrg.dataVencimentoPlano ? (
                  <>
                    Próxima Cobrança / Validade: <strong className="text-slate-900 font-mono font-bold">{formatDateBR(currentOrg.dataVencimentoPlano)}</strong>
                    {currentOrg.valorMensalidadeCentavos !== undefined && currentOrg.valorMensalidadeCentavos > 0 && (
                      <span> · Mensalidade: <strong className="text-slate-900 font-mono font-bold">{formatCurrencyBRL(currentOrg.valorMensalidadeCentavos)}</strong></span>
                    )}
                  </>
                ) : (
                  'Validade da Assinatura: Contínua / Indeterminada'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-purple-100 shrink-0">
            <div className="text-left sm:text-right">
              <span className="text-xs uppercase font-extrabold text-purple-800 block">Cupons de Alunos</span>
              <span className="text-sm font-extrabold text-slate-900">
                {instructorCoupons.length} gerado(s) <span className="text-xs font-medium text-slate-600">({activeCouponsCount} ativos · {totalCouponsUsed} resgates)</span>
              </span>
            </div>
            <button
              onClick={() => onNavigate('FINANCE')}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Gerenciar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Card de Acesso Rápido: Mapa de Alunos, Área de Atendimento (5–40 km) & Mensagens/Notificações */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-blue-950 text-white rounded-2xl p-4 border border-emerald-800/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-extrabold text-white">
                Mapa de Alunos, Cidades Atendidas ({savedCoverage?.raioAtendimentoKm || 20} km) & Notificações
              </span>
              {studentLeads.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-extrabold flex items-center gap-1">
                  <Bell className="w-3 h-3" />
                  <span>{studentLeads.length} aluno(s) procurando instrutor!</span>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Veja no mapa quantos alunos e instrutores existem por cidade e bairro, configure seu raio de 5 a 40 km e atenda novos alunos via WhatsApp.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('GEO_DEMAND')}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <MapPin className="w-4 h-4" />
          <span>Abrir Mapa & Notificações</span>
        </button>
      </div>

      {/* Essential Mobile Quick-Action Grid (Shown in Simplified Mode) */}
      {isSimplified && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('SCHEDULE')}
            className="p-3.5 bg-white hover:bg-blue-50/60 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">Agenda Hoje</p>
              <p className="text-xs text-blue-700 font-bold">{todayLessons.length} aula(s)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('STUDENTS')}
            className="p-3.5 bg-white hover:bg-indigo-50/60 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">Meus Alunos</p>
              <p className="text-xs text-indigo-700 font-bold">{students.length} ativo(s)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('VEHICLES')}
            className="p-3.5 bg-white hover:bg-sky-50/60 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-sky-600 text-white shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">Meus Veículos</p>
              <p className="text-xs text-sky-700 font-bold">{vehicles.length} cadastrado(s)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('WHATSAPP')}
            className="p-3.5 bg-white hover:bg-emerald-50/60 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">Cobrar / PIX</p>
              <p className="text-xs text-emerald-800 font-bold">{overdueAccounts.length} pendente(s)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('FINANCE')}
            className="p-3.5 bg-white hover:bg-purple-50/60 rounded-2xl border border-purple-200 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer"
          >
            <div className="p-2.5 rounded-xl bg-purple-600 text-white shrink-0">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-slate-900 truncate">Gerar Cupom</p>
              <p className="text-xs text-purple-800 font-bold">{instructorCoupons.length} gerado(s)</p>
            </div>
          </button>

          <button
            type="button"
            onClick={onSwitchToFullMode}
            className="p-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl border border-slate-800 shadow-xs flex items-center gap-3 text-left transition-all cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="p-2.5 rounded-xl bg-white/15 text-sky-300 shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-extrabold text-white truncate">Modo Normal</p>
              <p className="text-xs text-sky-200 font-bold">Todos os Menus</p>
            </div>
          </button>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className={`grid grid-cols-2 ${isSimplified ? 'lg:grid-cols-2' : 'lg:grid-cols-4'} gap-3 sm:gap-4`}>
        {/* Recebido */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-600">Recebido Total</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-base sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
              {formatCurrencyBRL(totalRecebidoCentavos)}
            </p>
            <p className="text-xs text-emerald-800 font-semibold flex items-center gap-1 mt-0.5">
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Entradas confirmadas</span>
            </p>
          </div>
        </div>

        {/* Em Aberto / Pendente */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold text-slate-600">A Receber</span>
            <div className="p-1.5 sm:p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-base sm:text-xl font-extrabold text-blue-700 tracking-tight truncate">
              {formatCurrencyBRL(totalPendenteCentavos)}
            </p>
            <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">Parcelas a vencer</p>
          </div>
        </div>

        {!isSimplified && (
          <>
            {/* Inadimplência / Vencido */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-red-200 bg-red-50/20 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-red-700">Atrasados / Vencidos</span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-red-100 text-red-700 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className="text-base sm:text-xl font-extrabold text-red-600 tracking-tight truncate">
                  {formatCurrencyBRL(totalVencidoCentavos)}
                </p>
                <button
                  onClick={() => onNavigate('WHATSAPP')}
                  className="text-xs text-red-700 font-bold hover:underline flex items-center gap-1 mt-0.5 cursor-pointer"
                >
                  <span>{overdueAccounts.length} cobrança(s)</span>
                  <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </div>
            </div>

            {/* Saldo Líquido Operacional */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between gap-1">
                <span className="text-xs font-semibold text-slate-600">Saldo Líquido</span>
                <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 text-slate-800 shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2">
                <p className={`text-base sm:text-xl font-extrabold tracking-tight truncate ${saldoLiquidoCentavos >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                  {formatCurrencyBRL(saldoLiquidoCentavos)}
                </p>
                <p className="text-xs text-slate-600 font-medium mt-0.5 truncate">
                  Receitas (-) Despesas
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Secondary Quick Metrics (Full Mode only) */}
      {!isSimplified && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600 truncate">Alunos Ativos</p>
              <p className="text-base font-bold text-slate-900">{students.length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600 truncate">Aulas Hoje</p>
              <p className="text-base font-bold text-slate-900">{todayLessons.length}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
              <Fuel className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600 truncate">Despesas Pagas</p>
              <p className="text-base font-bold text-slate-900 truncate">{formatCurrencyBRL(totalDespesasPagasCentavos)}</p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-600 truncate">Investimentos</p>
              <p className="text-base font-bold text-slate-900 truncate">{formatCurrencyBRL(totalInvestimentosCentavos)}</p>
            </div>
          </div>
        </div>
      )}

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
            <div className="p-6 text-center text-slate-600 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs font-medium">Nenhuma aula agendada para hoje até o momento.</p>
              <button
                onClick={() => onNavigate('SCHEDULE')}
                className="mt-2 text-xs text-blue-700 font-bold hover:underline cursor-pointer"
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
                        <p className="text-xs text-slate-600 font-medium truncate">
                          {lesson.topico} · {vehicle?.modelo.split(' ')[0] || 'Carro'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-end shrink-0">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${lesson.status === 'CONCLUIDA'
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

        {/* Meus Alunos Cadastrados (Visível e Otimizado no Modo Mobile e Normal) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Meus Alunos Cadastrados ({students.length})</span>
            </h2>
            <button
              onClick={() => onNavigate('STUDENTS')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              Ver Detalhes →
            </button>
          </div>

          {students.length === 0 ? (
            <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
              <Users className="w-8 h-8 mx-auto text-slate-400" />
              <p className="text-xs font-semibold text-slate-700">Nenhum aluno cadastrado no momento.</p>
              <p className="text-xs text-slate-500">
                Envie seu link de indicação ou cadastre novos alunos para iniciar o treinamento.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={onOpenInvite}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Compartilhar Link
                </button>
                <button
                  type="button"
                  onClick={onOpenNewStudent}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Novo Aluno
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-0.5">
              {students.map((student) => {
                const studentLessons = lessons.filter((l) => l.alunoId === student.id && l.status === 'CONCLUIDA');
                const whatsappUrl = buildWhatsAppLink(student.telefone, `Olá ${student.nome}, sou seu instrutor!`) || null;

                return (
                  <div
                    key={student.id}
                    className="p-3 bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 rounded-xl transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs truncate">{student.nome}</span>
                          <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white font-mono text-[10px] shrink-0">
                            CNH {student.categoriaCnh}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                            student.status === 'CONCLUIDO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {student.status === 'CONCLUIDO' ? 'Formado' : 'Em Treinamento'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          CPF: {student.cpfMascarado || student.cpfFingerprint}
                        </p>
                      </div>

                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shrink-0 shadow-xs transition-colors"
                          title="Falar no WhatsApp com o aluno"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 border-t border-slate-200/60 pt-1.5">
                      <span className="truncate font-medium text-slate-700">
                        📦 {student.pacoteNome || `Pacote CNH ${student.categoriaCnh}`}
                      </span>
                      <span className="font-bold text-slate-900 shrink-0 ml-2">
                        {studentLessons.length}/{student.totalAulasContratadas || 20} aulas
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo de Despesas Recentes (Modo Normal) ou Card de Expansão (Modo Simplificado) */}
        {!isSimplified ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Fuel className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Despesas e Gastos Operacionais</span>
              </h2>
              <button
                onClick={() => onNavigate('FINANCE')}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 cursor-pointer self-start sm:self-auto"
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
                    <p className="text-xs text-slate-600 flex flex-wrap items-center gap-1 mt-0.5">
                      <span className="font-semibold text-slate-700">{exp.categoria.replace(/_/g, ' ')}</span>
                      <span className="text-slate-400">·</span>
                      <span>Vencimento: {formatDateBR(exp.dataVencimento)}</span>
                    </p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-200/60 shrink-0">
                    <p className="font-bold text-slate-900 font-mono text-sm">
                      {formatCurrencyBRL(exp.valorCentavos)}
                    </p>
                    <span
                      className={`inline-block text-xs font-bold px-2.5 py-1 rounded-lg ${exp.status === 'PAGA'
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
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-sky-600 shrink-0" />
                <span>Recursos Avançados (Finanças, DRE & Relatórios)</span>
              </h2>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Você está no <strong>Modo Mobile Simplificado</strong> com foco nas aulas e cobranças rápidas do dia.
                Para acessar o controle de despesas, saúde financeira, pacotes, relatórios IRPF e todos os menus, ative o <strong>Modo Normal</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={onSwitchToFullMode}
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer touch-target shadow-xs"
            >
              <LayoutGrid className="w-4 h-4 text-sky-400" />
              <span>Abrir Modo Normal (Todos os Menus)</span>
            </button>
          </div>
        )}
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
