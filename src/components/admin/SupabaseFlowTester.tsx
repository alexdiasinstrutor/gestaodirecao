import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  GitBranch,
  Lock,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Table2,
  UploadCloud,
  XCircle
} from 'lucide-react';
import { supabase, supabaseUrl, testSupabaseClientConnection } from '../../lib/supabaseClient';
import { getPendingWrites } from '../../lib/cloudOutbox';
import { db, syncFromSupabase } from '../../lib/storage';

type NodeStatus = 'IDLE' | 'RUNNING' | 'OK' | 'RLS' | 'WARNING' | 'ERROR';

interface TableProbeSpec {
  table: string;
  label: string;
  category: 'CORE' | 'OPERACAO' | 'FINANCEIRO' | 'SISTEMA' | 'JURIDICO';
  localKey?: string;
  isLegal?: boolean;
}

interface TableProbeState extends TableProbeSpec {
  status: NodeStatus;
  latencyMs?: number;
  remoteCount?: number | null;
  localCount?: number | null;
  message?: string;
}

interface CoreNodeState {
  status: NodeStatus;
  latencyMs?: number;
  detail: string;
  metric?: string;
}

const TABLE_SPECS: TableProbeSpec[] = [
  { table: 'organizations', label: 'Organizações / CFCs', category: 'CORE', localKey: 'agd_organizations' },
  { table: 'users', label: 'Usuários & Instrutores', category: 'CORE', localKey: 'agd_users' },
  { table: 'students', label: 'Alunos', category: 'CORE', localKey: 'agd_students' },
  { table: 'vehicles', label: 'Veículos', category: 'CORE', localKey: 'agd_vehicles' },
  { table: 'lessons', label: 'Aulas Agendadas', category: 'OPERACAO', localKey: 'agd_lessons' },
  { table: 'lesson_checkins', label: 'Check-in / GPS Percursos', category: 'OPERACAO', localKey: 'agd_lesson_checkins' },
  { table: 'available_slots', label: 'Horários Disponíveis', category: 'OPERACAO', localKey: 'agd_slots' },
  { table: 'student_transfers', label: 'Transferências de Alunos', category: 'OPERACAO' },
  { table: 'accounts_receivable', label: 'Contas a Receber', category: 'FINANCEIRO', localKey: 'agd_accounts' },
  { table: 'payment_records', label: 'Pagamentos Recebidos', category: 'FINANCEIRO', localKey: 'agd_payments' },
  { table: 'expenses', label: 'Despesas & Manutenção', category: 'FINANCEIRO', localKey: 'agd_expenses' },
  { table: 'investments', label: 'Investimentos', category: 'FINANCEIRO', localKey: 'agd_investments' },
  { table: 'package_offers', label: 'Pacotes de Aulas', category: 'FINANCEIRO', localKey: 'agd_packages' },
  { table: 'discount_coupons', label: 'Cupons de Desconto', category: 'FINANCEIRO' },
  { table: 'coupon_redemptions', label: 'Resgates de Cupons', category: 'FINANCEIRO' },
  { table: 'audit_logs', label: 'Logs de Auditoria', category: 'SISTEMA', localKey: 'agd_audit' },
  { table: 'whatsapp_logs', label: 'Logs de WhatsApp', category: 'SISTEMA', localKey: 'agd_whatsapp_logs' },
  { table: 'legal_templates', label: 'Templates de Contratos', category: 'JURIDICO', isLegal: true },
  { table: 'legal_contract_versions', label: 'Versões de Contratos', category: 'JURIDICO', isLegal: true },
  { table: 'legal_acceptances', label: 'Aceites Jurídicos', category: 'JURIDICO', isLegal: true }
];

function getLocalListCount(localKey?: string): number | null {
  if (!localKey || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(localKey);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

function getStatusClasses(status: NodeStatus): {
  border: string;
  badge: string;
  dot: string;
  label: string;
} {
  switch (status) {
    case 'RUNNING':
      return {
        border: 'border-cyan-400/80 shadow-cyan-500/20 shadow-md',
        badge: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
        dot: 'bg-cyan-400 animate-ping',
        label: 'TESTANDO...'
      };
    case 'OK':
      return {
        border: 'border-emerald-500/60 shadow-emerald-500/10 shadow-sm',
        badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/35',
        dot: 'bg-emerald-400',
        label: 'CONECTADA'
      };
    case 'RLS':
      return {
        border: 'border-amber-400/60',
        badge: 'bg-amber-500/15 text-amber-200 border-amber-400/35',
        dot: 'bg-amber-400',
        label: 'RLS PROTEGIDO'
      };
    case 'WARNING':
      return {
        border: 'border-amber-400/70',
        badge: 'bg-amber-500/15 text-amber-200 border-amber-400/40',
        dot: 'bg-amber-400',
        label: 'ATENÇÃO'
      };
    case 'ERROR':
      return {
        border: 'border-red-500/80 shadow-red-500/15 shadow-sm',
        badge: 'bg-red-500/20 text-red-200 border-red-500/45',
        dot: 'bg-red-400',
        label: 'ERRO / AUSENTE'
      };
    default:
      return {
        border: 'border-slate-700/80',
        badge: 'bg-slate-800 text-slate-400 border-slate-700',
        dot: 'bg-slate-500',
        label: 'AGUARDANDO'
      };
  }
}

interface SupabaseFlowTesterProps {
  autoRun?: boolean;
  onSyncComplete?: () => void;
}

export const SupabaseFlowTester: React.FC<SupabaseFlowTesterProps> = ({
  autoRun = false,
  onSyncComplete
}) => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'ALL' | 'ISSUES'>('ALL');
  const hasAutoRunRef = useRef<boolean>(false);

  const [gatewayNode, setGatewayNode] = useState<CoreNodeState>({
    status: 'IDLE',
    detail: 'Pronto para validar endpoint REST do Supabase'
  });
  const [syncNode, setSyncNode] = useState<CoreNodeState>({
    status: 'IDLE',
    detail: 'Aguardando verificação da fila Outbox e sincronismo'
  });
  const [integrityNode, setIntegrityNode] = useState<CoreNodeState>({
    status: 'IDLE',
    detail: 'Aguardando varredura de integridade relacional'
  });

  const [tableNodes, setTableNodes] = useState<TableProbeState[]>(() =>
    TABLE_SPECS.map((spec) => ({
      ...spec,
      status: 'IDLE',
      localCount: getLocalListCount(spec.localKey)
    }))
  );

  const runFullFlow = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true);

    // Reset visual state
    setGatewayNode({ status: 'RUNNING', detail: 'Testando conectividade HTTP/REST...' });
    setSyncNode({ status: 'IDLE', detail: 'Aguardando estágio anterior...' });
    setIntegrityNode({ status: 'IDLE', detail: 'Aguardando estágio anterior...' });
    setTableNodes(
      TABLE_SPECS.map((spec) => ({
        ...spec,
        status: 'IDLE',
        latencyMs: undefined,
        remoteCount: null,
        localCount: getLocalListCount(spec.localKey),
        message: undefined
      }))
    );

    // 1. Gateway Supabase REST
    const conn = await testSupabaseClientConnection();
    setGatewayNode({
      status: conn.connected ? 'OK' : 'ERROR',
      latencyMs: conn.latencyMs,
      detail: conn.message,
      metric: conn.latencyMs !== undefined ? `${conn.latencyMs}ms` : 'offline'
    });

    // 2. Sincronismo & Outbox
    setSyncNode({ status: 'RUNNING', detail: 'Sincronizando base com Supabase e checando Outbox...' });
    const syncStart = performance.now();
    try {
      await syncFromSupabase();
      const syncLatency = Math.round(performance.now() - syncStart);
      const pending = getPendingWrites().length;
      setSyncNode({
        status: pending > 0 ? 'WARNING' : 'OK',
        latencyMs: syncLatency,
        detail:
          pending > 0
            ? `Sincronismo concluído com ${pending} pendência(s) na fila local (Outbox).`
            : 'Sincronismo bidirecional em dia · Fila Outbox zerada.',
        metric: `${pending} pendente(s)`
      });
    } catch (err: any) {
      const syncLatency = Math.round(performance.now() - syncStart);
      setSyncNode({
        status: 'ERROR',
        latencyMs: syncLatency,
        detail: `Falha no sincronismo: ${err?.message || 'Erro desconhecido'}`,
        metric: 'falha'
      });
    }

    // 3. Integridade da Base
    setIntegrityNode({ status: 'RUNNING', detail: 'Auditando vínculos de alunos, aulas e contas...' });
    const integrityStart = performance.now();
    const report = db.verifyCadastrosIntegrity();
    const integrityLatency = Math.round(performance.now() - integrityStart);
    const totalIssues =
      report.orphanStudents.length +
      report.orphanLessons.length +
      report.orphanAccounts.length +
      report.duplicateStudentCPFs.length +
      report.scheduleConflicts.length;
    setIntegrityNode({
      status: report.isAllConsistent ? 'OK' : 'WARNING',
      latencyMs: integrityLatency,
      detail: report.isAllConsistent
        ? `${report.totalStudents} aluno(s), ${report.totalInstructors} instrutor(es) e ${report.totalLessons} aula(s) sem inconsistências.`
        : `${totalIssues} inconsistência(s) encontrada(s) na varredura.`,
      metric: `${report.score}%`
    });

    if (onSyncComplete) {
      onSyncComplete();
    }

    // 4. Grid de 20 tabelas (em ondas de 4 para efeito visual estilo n8n)
    const batchSize = 4;
    for (let i = 0; i < TABLE_SPECS.length; i += batchSize) {
      const batch = TABLE_SPECS.slice(i, i + batchSize);
      const batchTables = new Set(batch.map((b) => b.table));

      setTableNodes((prev) =>
        prev.map((node) =>
          batchTables.has(node.table) ? { ...node, status: 'RUNNING', message: 'Consultando tabela...' } : node
        )
      );

      const results = await Promise.all(
        batch.map(async (spec): Promise<TableProbeState> => {
          const start = performance.now();
          const localCount = getLocalListCount(spec.localKey);
          try {
            const { count, error } = await supabase
              .from(spec.table)
              .select('id', { count: 'exact', head: true });
            const latencyMs = Math.round(performance.now() - start);

            if (error) {
              const rawMsg = error.message || error.code || 'Erro ao consultar tabela';
              const lower = rawMsg.toLowerCase();
              const isRls =
                error.code === '42501' ||
                lower.includes('row-level security') ||
                lower.includes('permission denied') ||
                lower.includes('jwt');
              return {
                ...spec,
                status: isRls ? 'RLS' : 'ERROR',
                latencyMs,
                remoteCount: null,
                localCount,
                message: isRls
                  ? spec.isLegal
                    ? 'Protegida por RLS (requer sessão Auth para leitura direta)'
                    : `Política RLS ativa: ${rawMsg}`
                  : rawMsg
              };
            }

            return {
              ...spec,
              status: 'OK',
              latencyMs,
              remoteCount: typeof count === 'number' ? count : 0,
              localCount,
              message: 'Leitura REST validada com sucesso'
            };
          } catch (err: any) {
            const latencyMs = Math.round(performance.now() - start);
            return {
              ...spec,
              status: 'ERROR',
              latencyMs,
              remoteCount: null,
              localCount,
              message: err?.message || 'Erro de rede ao consultar tabela'
            };
          }
        })
      );

      const resultMap = new Map(results.map((r) => [r.table, r]));
      setTableNodes((prev) => prev.map((node) => resultMap.get(node.table) || node));
    }

    setLastRunAt(new Date().toLocaleTimeString('pt-BR'));
    setIsRunning(false);
  }, [isRunning, onSyncComplete]);

  useEffect(() => {
    if (autoRun && !hasAutoRunRef.current) {
      hasAutoRunRef.current = true;
      runFullFlow();
    }
  }, [autoRun, runFullFlow]);

  const summary = useMemo(() => {
    const okCount = tableNodes.filter((n) => n.status === 'OK').length;
    const rlsCount = tableNodes.filter((n) => n.status === 'RLS').length;
    const errorCount = tableNodes.filter((n) => n.status === 'ERROR').length;
    const latencies = tableNodes
      .map((n) => n.latencyMs)
      .filter((v): v is number => typeof v === 'number');
    const avgLatency =
      latencies.length > 0 ? Math.round(latencies.reduce((acc, v) => acc + v, 0) / latencies.length) : null;
    return { okCount, rlsCount, errorCount, avgLatency };
  }, [tableNodes]);

  const visibleTables = useMemo(() => {
    if (filterMode === 'ISSUES') {
      return tableNodes.filter((n) => n.status === 'ERROR' || n.status === 'RLS' || n.status === 'WARNING');
    }
    return tableNodes;
  }, [tableNodes, filterMode]);

  const gatewayStyle = getStatusClasses(gatewayNode.status);
  const syncStyle = getStatusClasses(syncNode.status);
  const integrityStyle = getStatusClasses(integrityNode.status);

  return (
    <div
      className="rounded-2xl border border-slate-800 bg-slate-950 text-white shadow-xl overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.16) 1px, transparent 1px)',
        backgroundSize: '20px 20px'
      }}
    >
      {/* Header do Canvas estilo n8n */}
      <div className="px-4 sm:px-5 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-black tracking-tight text-white">
                Fluxo de Validação de Conexões & Tabelas (estilo n8n)
              </h4>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                20 Tabelas · Live Pipeline
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Valida Gateway REST, Sincronismo/Outbox, Integridade Relacional e cada tabela PostgreSQL individualmente.
              {lastRunAt && <span className="text-slate-300 font-mono ml-2">Último teste: {lastRunAt}</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-800/90 border border-slate-700 rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode('ALL')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                filterMode === 'ALL' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Todas ({tableNodes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('ISSUES')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                filterMode === 'ISSUES' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Filter className="w-3 h-3" />
              <span>Alertas ({summary.errorCount + summary.rlsCount})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={runFullFlow}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{isRunning ? 'Validando Pipeline...' : 'Executar Fluxo Completo'}</span>
          </button>
        </div>
      </div>

      {/* KPIs rápidos do Pipeline */}
      <div className="px-4 sm:px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center gap-4 text-xs font-mono">
        <span className="flex items-center gap-1.5 text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <strong>{summary.okCount}/{tableNodes.length}</strong> tabelas conectadas
        </span>
        {summary.rlsCount > 0 && (
          <span className="flex items-center gap-1.5 text-amber-300">
            <Lock className="w-3.5 h-3.5" />
            <strong>{summary.rlsCount}</strong> RLS protegido(s)
          </span>
        )}
        <span className={`flex items-center gap-1.5 ${summary.errorCount > 0 ? 'text-red-300' : 'text-slate-400'}`}>
          <XCircle className="w-3.5 h-3.5" />
          <strong>{summary.errorCount}</strong> erro(s)
        </span>
        {summary.avgLatency !== null && (
          <span className="flex items-center gap-1.5 text-cyan-300">
            <Clock className="w-3.5 h-3.5" />
            Latência média: <strong>{summary.avgLatency}ms</strong>
          </span>
        )}
      </div>

      {/* Corpo do Canvas: Pipeline de Estágios + Grid de Tabelas */}
      <div className="p-4 sm:p-6 space-y-6">
        {/* ESTÁGIOS 1 & 2: Fluxo Horizontal de Nós Principais */}
        <div className="grid grid-cols-1 lg:grid-cols-11 gap-3 items-center">
          {/* Trigger Node */}
          <div className="lg:col-span-2 relative rounded-xl bg-slate-900/95 border border-purple-500/50 p-3.5 shadow-md">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-300">
                1. Trigger
              </span>
              <Activity className={`w-3.5 h-3.5 text-purple-400 ${isRunning ? 'animate-pulse' : ''}`} />
            </div>
            <p className="text-xs font-bold text-white">App Frontend</p>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate" title={supabaseUrl}>
              Client → REST API
            </p>
            <span className="hidden lg:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-purple-400 border-2 border-slate-950" />
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${gatewayNode.status === 'OK' ? 'bg-emerald-500' : isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
              <ArrowRight className={`w-4 h-4 -ml-1 ${gatewayNode.status === 'OK' ? 'text-emerald-400' : 'text-slate-600'}`} />
            </div>
          </div>

          {/* Gateway Node */}
          <div className={`lg:col-span-2 relative rounded-xl bg-slate-900/95 border p-3.5 transition-all ${gatewayStyle.border}`}>
            <span className="hidden lg:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-950" />
            <span className="hidden lg:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <Server className="w-3 h-3 text-cyan-400" />
                2. Gateway
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${gatewayStyle.badge}`}>
                {gatewayNode.metric || gatewayStyle.label}
              </span>
            </div>
            <p className="text-xs font-bold text-white">Supabase REST</p>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2" title={gatewayNode.detail}>
              {gatewayNode.detail}
            </p>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${syncNode.status === 'OK' ? 'bg-emerald-500' : syncNode.status === 'RUNNING' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
              <ArrowRight className={`w-4 h-4 -ml-1 ${syncNode.status === 'OK' ? 'text-emerald-400' : 'text-slate-600'}`} />
            </div>
          </div>

          {/* Sync & Outbox Node */}
          <div className={`lg:col-span-2 relative rounded-xl bg-slate-900/95 border p-3.5 transition-all ${syncStyle.border}`}>
            <span className="hidden lg:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-950" />
            <span className="hidden lg:block absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950" />
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <UploadCloud className="w-3 h-3 text-purple-400" />
                3. Sincronismo
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${syncStyle.badge}`}>
                {syncNode.metric || syncStyle.label}
              </span>
            </div>
            <p className="text-xs font-bold text-white">Sync & Outbox</p>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2" title={syncNode.detail}>
              {syncNode.detail}
            </p>
          </div>

          <div className="hidden lg:flex lg:col-span-1 justify-center">
            <div className="flex items-center w-full">
              <div className={`h-0.5 flex-1 ${integrityNode.status === 'OK' ? 'bg-emerald-500' : integrityNode.status === 'RUNNING' ? 'bg-cyan-400 animate-pulse' : 'bg-slate-700'}`} />
              <ArrowRight className={`w-4 h-4 -ml-1 ${integrityNode.status === 'OK' ? 'text-emerald-400' : 'text-slate-600'}`} />
            </div>
          </div>

          {/* Integrity Node */}
          <div className={`lg:col-span-2 relative rounded-xl bg-slate-900/95 border p-3.5 transition-all ${integrityStyle.border}`}>
            <span className="hidden lg:block absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-slate-950" />
            <div className="flex items-center justify-between gap-1 mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                4. Integridade
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${integrityStyle.badge}`}>
                {integrityNode.metric || integrityStyle.label}
              </span>
            </div>
            <p className="text-xs font-bold text-white">Auditoria Base</p>
            <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2" title={integrityNode.detail}>
              {integrityNode.detail}
            </p>
          </div>
        </div>

        {/* Conector vertical para o Grid de Tabelas */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-800" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300">
            <Table2 className="w-3.5 h-3.5 text-cyan-400" />
            <span>5. Grid de Conexão das Tabelas PostgreSQL ({visibleTables.length})</span>
          </span>
          <div className="h-px flex-1 bg-slate-800" />
        </div>

        {/* ESTÁGIO 3: Grid de Nós das 20 Tabelas */}
        {visibleTables.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-slate-800 bg-slate-900/60 text-xs text-slate-400">
            Nenhum alerta ou erro encontrado nas 20 tabelas monitoradas.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleTables.map((node) => {
              const st = getStatusClasses(node.status);
              return (
                <div
                  key={node.table}
                  className={`relative rounded-xl bg-slate-900/95 border p-3 transition-all ${st.border}`}
                >
                  {/* Porta de entrada estilo n8n */}
                  <span
                    className={`absolute -left-1.5 top-5 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                      node.status === 'OK'
                        ? 'bg-emerald-400'
                        : node.status === 'ERROR'
                        ? 'bg-red-400'
                        : node.status === 'RLS'
                        ? 'bg-amber-400'
                        : node.status === 'RUNNING'
                        ? 'bg-cyan-400'
                        : 'bg-slate-600'
                    }`}
                  />

                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                        {node.category}
                      </span>
                      <p className="text-xs font-bold text-white truncate" title={node.label}>
                        {node.label}
                      </p>
                      <p className="text-[10px] font-mono text-cyan-300/90 truncate" title={node.table}>
                        public.{node.table}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${st.badge}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-800/90 flex items-center justify-between text-[11px] font-mono text-slate-300">
                    <span className="flex items-center gap-1">
                      <Database className="w-3 h-3 text-slate-500" />
                      <span>
                        Nuvem:{' '}
                        <strong className="text-white">
                          {node.remoteCount !== null && node.remoteCount !== undefined ? node.remoteCount : '—'}
                        </strong>
                      </span>
                    </span>
                    {node.localCount !== null && node.localCount !== undefined && (
                      <span className="text-slate-400">
                        Local: <strong className="text-slate-200">{node.localCount}</strong>
                      </span>
                    )}
                    {node.latencyMs !== undefined && (
                      <span className="text-cyan-300">{node.latencyMs}ms</span>
                    )}
                  </div>

                  {node.message && (node.status === 'ERROR' || node.status === 'RLS') && (
                    <p
                      className={`mt-1.5 text-[10px] leading-snug rounded-lg px-2 py-1 border ${
                        node.status === 'ERROR'
                          ? 'bg-red-950/60 border-red-900/70 text-red-200'
                          : 'bg-amber-950/50 border-amber-900/60 text-amber-200'
                      }`}
                      title={node.message}
                    >
                      {node.status === 'ERROR' ? (
                        <AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />
                      ) : (
                        <Lock className="w-3 h-3 inline mr-1 -mt-0.5" />
                      )}
                      {node.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
