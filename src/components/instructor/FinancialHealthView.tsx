import React, { useState, useMemo } from 'react';
import {
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Car,
  Sparkles,
  Clock,
  ArrowRight,
  HelpCircle,
  Info,
  FileText,
  Calculator,
  Lightbulb,
  ShieldAlert,
  ArrowUpRight,
  Percent,
  CheckSquare,
  Square,
  Wrench,
  Fuel,
  Receipt
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL } from '../../lib/validation';
import type { Organization, User } from '../../types';

interface FinancialHealthViewProps {
  currentOrg: Organization;
  currentUser: User;
  onNavigateToFinanceTab?: (subTab: string) => void;
  onNavigateTab?: (tab: string) => void;
}

export const FinancialHealthView: React.FC<FinancialHealthViewProps> = ({
  currentOrg,
  currentUser,
  onNavigateToFinanceTab,
  onNavigateTab
}) => {
  const orgId = currentOrg.id;

  // Real data from storage
  const accounts = db.getAccountsReceivable(orgId);
  const payments = db.getPayments(orgId);
  const expenses = db.getExpenses(orgId);
  const investments = db.getInvestments(orgId);
  const vehicles = db.getVehicles(orgId);

  // Financial Diagnostics Calculations
  const totalRecebidoCentavos = payments.reduce((acc, p) => acc + p.valorCentavos, 0);
  const totalDespesasPagasCentavos = expenses
    .filter((e) => e.status === 'PAGA')
    .reduce((acc, e) => acc + e.valorCentavos, 0);

  // Estimativa de despesa mensal média (mínimo de R$ 1.500 para cálculos se base estiver nova)
  const despesaMensalMediaCentavos = Math.max(150000, totalDespesasPagasCentavos || 250000);

  // Total acumulado em investimentos/reservas
  const totalReservasCentavos = investments.reduce((acc, inv) => acc + inv.valorAcumuladoCentavos, 0);

  // Meses de cobertura de reserva de emergência
  const mesesDeReserva = (totalReservasCentavos / despesaMensalMediaCentavos);

  // Contas vencidas
  const hoje = new Date().toISOString().slice(0, 10);
  const contasVencidas = accounts.filter(
    (a) => a.status === 'PENDENTE' && a.dataVencimento < hoje
  );
  const valorVencidoCentavos = contasVencidas.reduce(
    (acc, a) => acc + (a.valorTotalCentavos - a.valorPagoCentavos),
    0
  );

  // Veículos e ano limite
  const anoAtual = new Date().getFullYear();
  const veiculosComAlerta = vehicles.map((v) => {
    const idade = anoAtual - v.ano;
    const limiteDetran = v.tipo === 'MOTO' ? 5 : 8; // 5 anos para moto, 8 para carro
    const anosRestantes = Math.max(0, limiteDetran - idade);
    return {
      ...v,
      idade,
      limiteDetran,
      anosRestantes,
      urgente: anosRestantes <= 2
    };
  });

  // Cálculo da Pontuação de Saúde Financeira (0 a 100)
  const healthScore = useMemo(() => {
    let score = 50; // base neutra

    // 1. Reserva de Emergência (+25 max)
    if (mesesDeReserva >= 6) score += 25;
    else if (mesesDeReserva >= 3) score += 18;
    else if (mesesDeReserva >= 1) score += 10;
    else if (totalReservasCentavos > 0) score += 5;
    else score -= 10;

    // 2. Inadimplência de Alunos (+15 max)
    if (contasVencidas.length === 0) score += 15;
    else if (contasVencidas.length <= 2) score += 5;
    else score -= 10;

    // 3. Lucratividade Operacional (+15 max)
    if (totalRecebidoCentavos > totalDespesasPagasCentavos * 1.5) score += 15;
    else if (totalRecebidoCentavos > totalDespesasPagasCentavos) score += 10;
    else if (totalRecebidoCentavos > 0) score += 2;

    // 4. Frota e planejamento (+10 max)
    const temVeiculoVencendo = veiculosComAlerta.some((v) => v.urgente);
    const temPlanoTroca = investments.some((i) => i.categoria === 'FROTA_NOVO_VEICULO');
    if (temVeiculoVencendo && !temPlanoTroca) score -= 15;
    else if (temPlanoTroca) score += 10;

    return Math.min(100, Math.max(10, score));
  }, [mesesDeReserva, totalReservasCentavos, contasVencidas, totalRecebidoCentavos, totalDespesasPagasCentavos, veiculosComAlerta, investments]);

  const scoreLevel = useMemo(() => {
    if (healthScore >= 80) return { label: 'Excelente · Negócio Blindado', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', barColor: 'bg-emerald-600' };
    if (healthScore >= 60) return { label: 'Bom · Rumo à Estabilidade', color: 'text-blue-700 bg-blue-50 border-blue-200', barColor: 'bg-blue-600' };
    if (healthScore >= 40) return { label: 'Atenção · Riscos Operacionais', color: 'text-amber-700 bg-amber-50 border-amber-200', barColor: 'bg-amber-500' };
    return { label: 'Crítico · Vulnerável a Imprevistos', color: 'text-red-700 bg-red-50 border-red-200', barColor: 'bg-red-600' };
  }, [healthScore]);

  // Simulador de Custo Real por Aula (State)
  const [simPrecoCombustivel, setSimPrecoCombustivel] = useState<number>(5.89);
  const [simConsumoKmLitro, setSimConsumoKmLitro] = useState<number>(8.5);
  const [simKmPorAula, setSimKmPorAula] = useState<number>(14);
  const [simPrecoCobradoAula, setSimPrecoCobradoAula] = useState<number>(85);
  const [simSeguroManutencaoMensal, setSimSeguroManutencaoMensal] = useState<number>(800);
  const [simAulasPorMes, setSimAulasPorMes] = useState<number>(80);

  // Cálculos do simulador
  const custoCombustivelAula = (simKmPorAula / simConsumoKmLitro) * simPrecoCombustivel;
  const custoFixoPorAula = simAulasPorMes > 0 ? simSeguroManutencaoMensal / simAulasPorMes : 0;
  const provisaoDepreciacaoPneuAula = 7.50; // valor médio estimado de desgaste
  const custoTotalAula = custoCombustivelAula + custoFixoPorAula + provisaoDepreciacaoPneuAula;
  const lucroLiquidoAula = simPrecoCobradoAula - custoTotalAula;
  const margemLucroPercent = simPrecoCobradoAula > 0 ? (lucroLiquidoAula / simPrecoCobradoAula) * 100 : 0;
  const faturamentoMensalSim = simAulasPorMes * simPrecoCobradoAula;
  const lucroMensalReal = simAulasPorMes * lucroLiquidoAula;

  // Calculadora da Regra dos 4 Potes (State)
  const [valorPacoteSim, setValorPacoteSim] = useState<number>(1800);

  // Checklist Interativo do Instrutor (Salvo em localStorage)
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>(() => {
    try {
      const saved = localStorage.getItem(`fin_health_check_${orgId}`);
      return saved ? JSON.parse(saved) : {
        item1: true,
        item2: false,
        item3: true,
        item4: false,
        item5: false
      };
    } catch {
      return {};
    }
  });

  const toggleCheck = (key: string) => {
    const updated = { ...checkedItems, [key]: !checkedItems[key] };
    setCheckedItems(updated);
    try {
      localStorage.setItem(`fin_health_check_${orgId}`, JSON.stringify(updated));
    } catch (e) {
      console.warn('Erro ao salvar checklist', e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* CABEÇALHO DO MÓDULO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 rounded-full text-indigo-300 text-xs font-semibold">
              <HeartPulse className="w-3.5 h-3.5 text-pink-400" />
              <span>Educação Financeira & Blindagem do Instrutor</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Saúde Financeira & Gestão Estratégica
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
              Trabalhe com tranquilidade, elimine imprevistos, provisione a troca de veículos exigida pelo DETRAN e construa um negócio lucrativo e sustentável.
            </p>
          </div>

          {/* SCORE CARD */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-5 rounded-2xl flex flex-col items-center justify-center shrink-0 min-w-[240px]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
              Score de Saúde Financeira
            </span>
            <div className="flex items-baseline gap-1 my-1">
              <span className="text-4xl sm:text-5xl font-black font-mono text-white">{healthScore}</span>
              <span className="text-sm font-semibold text-indigo-200">/ 100</span>
            </div>
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${scoreLevel.color}`}>
              {scoreLevel.label}
            </span>
            <div className="w-full bg-white/20 h-2 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full ${scoreLevel.barColor} transition-all duration-700`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3 CARDS DE DIAGNÓSTICO RÁPIDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Reserva de Emergência */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              mesesDeReserva >= 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {mesesDeReserva.toFixed(1)} meses cobertos
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Reserva de Emergência</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Acumulado em metas: <strong>{formatCurrencyBRL(totalReservasCentavos)}</strong>
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            {mesesDeReserva >= 3 ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Parabéns! Sua reserva cobre pelo menos 3 meses de despesas fixas.
              </span>
            ) : (
              <span className="text-amber-800 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Meta recomendada: Guardar 3 a 6 meses de custos para blindar sua operação.
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Frota e Limite DETRAN */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Car className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              {vehicles.length} veículo(s) ativo(s)
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Limite de Idade da Frota (DETRAN)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Carros até 8 anos e motos até 5 anos de fabricação
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            {veiculosComAlerta.length > 0 ? (
              <div className="space-y-1">
                {veiculosComAlerta.map((v) => (
                  <div key={v.id} className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold">{v.modelo} ({v.ano}):</span>
                    <span className={v.urgente ? 'text-red-600 font-bold' : 'text-slate-600'}>
                      {v.anosRestantes === 0 ? 'Prazo Vencido no Detran' : `${v.anosRestantes} ano(s) restante(s)`}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-500">Nenhum veículo cadastrado ainda.</span>
            )}
          </div>
        </div>

        {/* Card 3: Inadimplência & Cobrança */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              contasVencidas.length === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {contasVencidas.length} em atraso
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inadimplência de Alunos</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Valor pendente vencido: <strong>{formatCurrencyBRL(valorVencidoCentavos)}</strong>
            </p>
          </div>
          <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            {contasVencidas.length === 0 ? (
              <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Zero atrasos! Todos os alunos estão em dia.
              </span>
            ) : (
              <span className="text-red-700 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Envie o lembrete com PIX Copia e Cola pelo WhatsApp para recuperar.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 1: OS 4 PILARES DA SAÚDE FINANCEIRA DO INSTRUTOR */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">
            Metodologia Prática de Sucesso
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            Os 4 Pilares da Blindagem Financeira para Autoescola
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            O passo a passo para o instrutor não trabalhar apenas para pagar contas e nunca ser pego de surpresa.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pilar 1: A Regra dos 4 Potes */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-50/50 to-white border border-indigo-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">A Regra dos 4 Potes (Divisão do Faturamento)</h3>
                <p className="text-xs text-slate-500">Nunca misture faturamento bruto com seu salário</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O maior erro do instrutor autônomo é acreditar que todo o dinheiro que entra dos alunos pode ser sacado. Aplique esta proporção em cada pagamento:
            </p>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-50 text-emerald-900 border border-emerald-100">
                <span className="font-semibold">40% · Pró-Labore do Instrutor:</span>
                <span className="font-bold">Seu salário pessoal livre</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-blue-50 text-blue-900 border border-blue-100">
                <span className="font-semibold">25% · Despesas Operacionais:</span>
                <span className="font-bold">Gasolina, seguro, lavagem</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-purple-50 text-purple-900 border border-purple-100">
                <span className="font-semibold">20% · Troca de Veículo (Depreciação):</span>
                <span className="font-bold">Fundo para o próximo carro</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-amber-50 text-amber-900 border border-amber-100">
                <span className="font-semibold">15% · Reserva de Emergência & IRPF:</span>
                <span className="font-bold">Manutenção pesada e Carnê-Leão</span>
              </div>
            </div>

            {/* Simulador rápido de pacote */}
            <div className="pt-3 border-t border-indigo-100/80">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Simule um Pacote de Aulas (R$):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={valorPacoteSim}
                  onChange={(e) => setValorPacoteSim(parseFloat(e.target.value) || 0)}
                  className="w-32 px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
                <span className="text-xs text-slate-500">gera:</span>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded">
                  Salário: {formatCurrencyBRL(Math.round(valorPacoteSim * 0.40 * 100))}
                </span>
                <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded">
                  Novo Carro: {formatCurrencyBRL(Math.round(valorPacoteSim * 0.20 * 100))}
                </span>
              </div>
            </div>
          </div>

          {/* Pilar 2: A Armadilha da Frota Vencida */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/50 to-white border border-blue-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">A Armadilha do Ano do Veículo (DETRAN)</h3>
                <p className="text-xs text-slate-500">Evite ser pego de surpresa na vistoria anual</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O Código de Trânsito Brasileiro e os DETRANs estaduais estabelecem que carros de categoria B só podem ministrar aulas até completarem <strong>8 anos de fabricação</strong> (motos até 5 anos).
            </p>

            <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Não basta comprar o carro:</strong> Você precisará instalar o kit de pedais de duplo comando homologado e pagar laudo de inspeção do <strong>INMETRO (CSV)</strong>, gastando cerca de <strong>R$ 3.000 a R$ 4.500</strong> por veículo.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-slate-700">
                  <strong>Regra de Ouro:</strong> Inicie a poupança do novo veículo pelo menos <strong>24 meses antes</strong> do prazo fatal de vencimento no DETRAN.
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigateToFinanceTab?.('INVESTMENTS')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
              >
                <span>Configurar Meta de Troca de Frota</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Pilar 3: Manutenção Preventiva vs Quebra no Exame */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-50/50 to-white border border-amber-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Manutenção Preventiva vs. Quebra no Exame</h3>
                <p className="text-xs text-slate-500">O custo oculto do carro parado</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Alunos iniciantes seguram na embreagem, passam em buracos e forçam a marcha. O desgaste é 3x mais rápido que em veículos particulares de passeio.
            </p>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="font-bold text-emerald-900 block mb-1">Preventiva Programada</span>
                <p className="text-slate-600 text-[11px]">
                  Troca de pastilhas e óleo a cada 5.000 km. Custo: ~R$ 350. Carro roda 100% confiável.
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-100">
                <span className="font-bold text-red-900 block mb-1">Quebra Inesperada</span>
                <p className="text-slate-600 text-[11px]">
                  Embreagem queima no dia de exame. Custo: Guincho + Peça + 3 dias sem dar aula (~R$ 2.800).
                </p>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => onNavigateToFinanceTab?.('EXPENSES')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
              >
                <span>Lançar Despesa de Manutenção</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Pilar 4: Blindagem Fiscal e IRPF */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/50 to-white border border-purple-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Proteção Fiscal & Carnê-Leão (Receita Federal)</h3>
                <p className="text-xs text-slate-500">Não pague imposto indevido nem caia na malha fina</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              O instrutor autônomo é obrigado a declarar os valores recebidos de pessoas físicas (alunos). Para pagar menos imposto legalmente:
            </p>

            <ul className="text-xs text-slate-700 space-y-1.5 list-disc pl-4">
              <li>
                <strong>Emita sempre o Recibo de Pagamento</strong> do sistema para cada parcela ou pacote com o CPF do aluno;
              </li>
              <li>
                <strong>Deduza no Livro-Caixa</strong> o combustível, a manutenção do carro de instrução e as taxas pagas ao DETRAN;
              </li>
              <li>
                Utilize o relatório de <strong>IRPF / Carnê-Leão</strong> do sistema e envie o arquivo CSV diretamente ao seu contador.
              </li>
            </ul>

            <div className="pt-2">
              <button
                onClick={() => onNavigateToFinanceTab?.('IRPF')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 transition-colors cursor-pointer"
              >
                <span>Acessar Relatório Fiscal IRPF</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: CALCULADORA INTERATIVA DE CUSTO REAL POR AULA */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 uppercase tracking-wider">
              <Calculator className="w-4 h-4" />
              <span>Simulador de Lucratividade Unitária</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              Calculadora do Custo Real da Aula Prática (50 min)
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Descubra exatamente quanto custa cada volta no quarteirão e quanto sobra líquido no seu bolso.
            </p>
          </div>
          <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-3 py-1.5 rounded-xl border border-blue-100 shrink-0 self-start sm:self-auto">
            Ajuste os valores para o seu veículo
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Parâmetros do Veículo */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-2xl border border-slate-200/80 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Preço do Litro do Combustível (R$)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={simPrecoCombustivel}
                  onChange={(e) => setSimPrecoCombustivel(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Consumo Médio em Instrução Urbana (km/l)
              </label>
              <input
                type="number"
                step="0.1"
                value={simConsumoKmLitro}
                onChange={(e) => setSimConsumoKmLitro(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Ex: 8.0 a 9.5 km/l em 1ª e 2ª marcha</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Quilometragem Média por Aula de 50 min (km)
              </label>
              <input
                type="number"
                value={simKmPorAula}
                onChange={(e) => setSimKmPorAula(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Geralmente entre 12 km e 16 km</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Preço Cobrado por Aula Prática (R$) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-slate-400 font-mono">R$</span>
                <input
                  type="number"
                  value={simPrecoCobradoAula}
                  onChange={(e) => setSimPrecoCobradoAula(parseFloat(e.target.value) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-white border border-blue-400 rounded-xl font-mono font-bold text-blue-900"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Seguro, IPVA e Manutenção Fixa Mensal (R$)
              </label>
              <input
                type="number"
                value={simSeguroManutencaoMensal}
                onChange={(e) => setSimSeguroManutencaoMensal(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Média de Aulas Ministradas no Mês
              </label>
              <input
                type="number"
                value={simAulasPorMes}
                onChange={(e) => setSimAulasPorMes(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Ex: 80 aulas (4 por dia x 20 dias)</span>
            </div>
          </div>

          {/* Resultado da Aula */}
          <div className="bg-gradient-to-b from-slate-900 to-indigo-950 text-white p-6 rounded-2xl flex flex-col justify-between space-y-4 shadow-lg">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Resultado Econômico Unitário
              </span>
              <div className="mt-2 space-y-2">
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/10">
                  <span className="text-slate-300">Combustível por aula:</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(Math.round(custoCombustivelAula * 100))}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/10">
                  <span className="text-slate-300">Rateio fixo (seguro/IPVA):</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(Math.round(custoFixoPorAula * 100))}</span>
                </div>
                <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/10">
                  <span className="text-slate-300">Desgaste de pneus/óleo:</span>
                  <span className="font-mono font-bold">{formatCurrencyBRL(Math.round(provisaoDepreciacaoPneuAula * 100))}</span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-1 text-amber-300">
                  <span>CUSTO TOTAL DA AULA:</span>
                  <span className="font-mono text-sm">{formatCurrencyBRL(Math.round(custoTotalAula * 100))}</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/20 space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-emerald-300 font-semibold">LUCRO LÍQUIDO / AULA:</span>
                <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                  {formatCurrencyBRL(Math.round(lucroLiquidoAula * 100))}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-slate-300">
                <span>Margem Líquida Real:</span>
                <span className="font-bold text-white font-mono">{margemLucroPercent.toFixed(1)}%</span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl text-[11px] text-slate-200 mt-2">
                Em {simAulasPorMes} aulas/mês, seu <strong>ganho limpo</strong> estimado é de{' '}
                <span className="text-emerald-300 font-bold">{formatCurrencyBRL(Math.round(lucroMensalReal * 100))}</span>.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: CHECKLIST INTERATIVO DE BLINDAGEM */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Checklist de Blindagem Financeira para este Mês
          </h2>
        </div>
        <p className="text-xs text-slate-500">
          Marque os itens conforme for aplicando no dia a dia para manter sua operação segura e transparente:
        </p>

        <div className="divide-y divide-slate-100 text-xs">
          {[
            {
              id: 'item1',
              title: 'Emitir Recibo Oficial para Todos os Alunos Pagantes',
              desc: 'Gera comprovante com via única para o aluno e protege sua prestação de contas no IRPF.',
              linkText: 'Ver Recebíveis',
              subTab: 'RECEIVABLES'
            },
            {
              id: 'item2',
              title: 'Alimentar as Despesas Semanais de Combustível e Oficina',
              desc: 'Permite acompanhar o consumo real do veículo e deduzir custos operacionais no Livro-Caixa.',
              linkText: 'Lançar Despesa',
              subTab: 'EXPENSES'
            },
            {
              id: 'item3',
              title: 'Possuir pelo Menos 1 Meta de Reserva Cadastrada',
              desc: 'Garante que imprevistos com o carro de instrução não paralisem suas aulas.',
              linkText: 'Ver Metas',
              subTab: 'INVESTMENTS'
            },
            {
              id: 'item4',
              title: 'Checar se a Frota Está Dentro do Limite de 8 Anos do DETRAN',
              desc: 'Evite ser pego de surpresa na renovação do credenciamento anual do CFC.',
              linkText: 'Ver Frota',
              tab: 'DASHBOARD'
            },
            {
              id: 'item5',
              title: 'Disparar Lembretes WhatsApp para Alunos com Parcela a Vencer',
              desc: 'Reduz a taxa de inadimplência em mais de 70% usando mensagem com chave PIX.',
              linkText: 'Abrir WhatsApp',
              tab: 'WHATSAPP'
            }
          ].map((item) => {
            const isChecked = !!checkedItems[item.id];
            return (
              <div key={item.id} className="py-3 flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => toggleCheck(item.id)}
                  className="flex items-start gap-3 text-left cursor-pointer group flex-1"
                >
                  <div className="mt-0.5 shrink-0">
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                    )}
                  </div>
                  <div>
                    <h4 className={`font-semibold ${isChecked ? 'line-through text-slate-400' : 'text-slate-900'}`}>
                      {item.title}
                    </h4>
                    <p className="text-slate-500 text-[11px] mt-0.5">{item.desc}</p>
                  </div>
                </button>
                {item.subTab && onNavigateToFinanceTab && (
                  <button
                    onClick={() => onNavigateToFinanceTab(item.subTab!)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0 cursor-pointer"
                  >
                    {item.linkText} →
                  </button>
                )}
                {item.tab && onNavigateTab && !item.subTab && (
                  <button
                    onClick={() => onNavigateTab(item.tab!)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 shrink-0 cursor-pointer"
                  >
                    {item.linkText} →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
