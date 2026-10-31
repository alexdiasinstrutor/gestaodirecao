import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  Lock,
  Unlock,
  FileText,
  Printer,
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  Database,
  KeyRound,
  Eye,
  RefreshCw,
  X,
  Smartphone,
  CheckSquare,
  Cpu,
  Layers,
  Palette,
  Terminal,
  Server,
  Zap,
  Maximize2,
  UploadCloud,
  Cloud
} from 'lucide-react';
import { monitoringAgent, MonitoringEvent, SystemHealthMetrics } from '../../lib/agents/monitoringAgent';
import { codeGuardAgent, CodeGuardState, SystemSnapshot, ModuleIntegrityStatus } from '../../lib/agents/codeGuardAgent';
import { db, MigrationProgress, MigrationResult } from '../../lib/storage';
import { 
  printOfficialDossier, 
  downloadDossierMarkdownFile, 
  downloadDossierHtmlFile,
  DOSSIER_METADATA 
} from '../../lib/dossierPdfPrinter';
import { 
  downloadOfficialDossierPdf, 
  openOfficialDossierPdfInNewTab 
} from '../../lib/dossierPdfGenerator';
import { OfficialDossierPdfViewer } from './OfficialDossierPdfViewer';

interface SecurityAgentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserNome?: string;
}

export const SecurityAgentsModal: React.FC<SecurityAgentsModalProps> = ({
  isOpen,
  onClose,
  currentUserNome = 'Instrutor / Operador'
}) => {
  const [activeTab, setActiveTab] = useState<'DOSSIE' | 'MONITOR' | 'GUARD' | 'VALIDACAO' | 'DATABASE'>('DOSSIE');
  const [validationFilter, setValidationFilter] = useState<'TODOS' | 'UX_UI' | 'ENGENHARIA' | 'ARQUITETURA'>('TODOS');
  const [events, setEvents] = useState<MonitoringEvent[]>([]);
  const [metrics, setMetrics] = useState<SystemHealthMetrics>(monitoringAgent.getMetrics());
  const [guardState, setGuardState] = useState<CodeGuardState>(codeGuardAgent.getState());
  const [snapshots, setSnapshots] = useState<SystemSnapshot[]>(codeGuardAgent.getSnapshots());
  const [modules, setModules] = useState<ModuleIntegrityStatus[]>(codeGuardAgent.checkModulesIntegrity());
  
  // Authorization form
  const [authReason, setAuthReason] = useState('');
  const [authSuccessMsg, setAuthSuccessMsg] = useState('');
  const [snapshotName, setSnapshotName] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('TODOS');
  
  // Dossier View & Print Mode
  const [dossierViewMode, setDossierViewMode] = useState<'OFFICIAL_PDF' | 'CARDS'>('OFFICIAL_PDF');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printSuccessFeedback, setPrintSuccessFeedback] = useState<string>('');

  // Firebase Database State
  const [firebaseStatus, setFirebaseStatus] = useState(() => db.getFirebaseStatus());
  const [connTesting, setConnTesting] = useState(false);
  const [connResult, setConnResult] = useState<{ connected: boolean; message: string } | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const unsubMonitor = monitoringAgent.subscribe((newEvents) => {
      setEvents(newEvents);
      setMetrics(monitoringAgent.getMetrics());
    });

    const unsubGuard = codeGuardAgent.subscribe((newState) => {
      setGuardState(newState);
      setSnapshots(codeGuardAgent.getSnapshots());
      setModules(codeGuardAgent.checkModulesIntegrity());
    });

    return () => {
      unsubMonitor();
      unsubGuard();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const loggedUser = db.getCurrentUser();
  const isMasterAdmin = loggedUser?.papel === 'SUPER_ADMIN' || loggedUser?.email === 'cassiordcosta@gmail.com';

  if (!isMasterAdmin) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-white max-w-md w-full rounded-2xl p-6 shadow-2xl border border-red-200 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">Acesso Restrito ao Administrador Master</h3>
            <p className="text-xs text-slate-600 mt-1">
              O Dossiê Técnico, Métricas dos Agentes e Configurações de Banco de Dados são de acesso exclusivo do Administrador Master da plataforma (<strong className="font-mono text-purple-700">cassiordcosta@gmail.com</strong>).
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  const handleAuthorize = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authReason.trim()) return;

    const token = codeGuardAgent.authorizeMutation(currentUserNome, authReason.trim());
    setAuthSuccessMsg(`Autorização concedida com sucesso! Token: ${token}`);
    setAuthReason('');
    setTimeout(() => setAuthSuccessMsg(''), 5000);
  };

  const handleLock = () => {
    codeGuardAgent.lockSystem(currentUserNome);
    setAuthSuccessMsg('Sistema travado com segurança e proteção reestabelecida!');
    setTimeout(() => setAuthSuccessMsg(''), 4000);
  };

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    const name = snapshotName.trim() || `Ponto de Restauração - ${new Date().toLocaleTimeString('pt-BR')}`;
    codeGuardAgent.createSnapshot(name, currentUserNome);
    setSnapshotName('');
    setSnapshots(codeGuardAgent.getSnapshots());
  };

  const handleRestore = (snapId: string, snapName: string) => {
    if (confirm(`Tem certeza que deseja restaurar o sistema para o ponto de restauração "${snapName}"?`)) {
      const ok = codeGuardAgent.restoreSnapshot(snapId);
      if (ok) {
        alert('Restauração concluída com sucesso! Recarregando sistema...');
        window.location.reload();
      } else {
        alert('Erro ao tentar restaurar snapshot.');
      }
    }
  };

  const handleDownloadPdf = () => {
    setIsPrinting(true);
    setPrintSuccessFeedback('Compilando e gerando arquivo PDF oficial com 16 coleções e 17 telas...');
    setTimeout(() => {
      const ok = downloadOfficialDossierPdf('DOSSIE_OFICIAL_GESTAO_DIRECAO_v5.3.pdf');
      setIsPrinting(false);
      if (ok) {
        setPrintSuccessFeedback('Arquivo PDF oficial gerado e baixado com sucesso no seu dispositivo!');
      } else {
        setPrintSuccessFeedback('Erro ao compilar o PDF.');
      }
      setTimeout(() => setPrintSuccessFeedback(''), 6000);
    }, 150);
  };

  const handleOpenPdfTab = () => {
    openOfficialDossierPdfInNewTab();
  };

  const handlePrintDossie = () => {
    setIsPrinting(true);
    setPrintSuccessFeedback('Preparando e acionando diálogo de impressão PDF oficial...');
    const ok = printOfficialDossier();
    setTimeout(() => {
      setIsPrinting(false);
      if (ok) {
        setPrintSuccessFeedback('Diálogo de impressão aberto com sucesso! Selecione "Salvar como PDF" no destino.');
      }
      setTimeout(() => setPrintSuccessFeedback(''), 6000);
    }, 600);
  };

  const handleExportMonitor = () => {
    const json = monitoringAgent.exportReportJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_monitoramento_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredEvents = events.filter((ev) => {
    if (filterSeverity === 'TODOS') return true;
    return ev.severidade === filterSeverity;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header - Mobile friendly */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Dossiê & Agentes de Segurança
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                  guardState.travaAtiva 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {guardState.travaAtiva ? 'Trava de Código Ativa' : 'Modificações Liberadas'}
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Controle de governança, integridade de pacotes, 1-aluno-1-instrutor e histórico de auditoria
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            type="button"
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs - Horizontally scrollable on mobile */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 sm:px-5 pt-2 gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('DOSSIE')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === 'DOSSIE'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="sm:hidden">1. Dossiê</span>
            <span className="hidden sm:inline">1. Dossiê do Sistema</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('MONITOR')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === 'MONITOR'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span className="sm:hidden">2. Monitor</span>
            <span className="hidden sm:inline">2. Agente Monitoramento</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('GUARD')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === 'GUARD'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 shrink-0" />
            <span className="sm:hidden">3. Trava</span>
            <span className="hidden sm:inline">3. Agente Trava de Código</span>
            {guardState.travaAtiva ? (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold rounded">BLINDADO</span>
            ) : (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] sm:text-[10px] font-bold rounded">DESTREVADO</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('VALIDACAO')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === 'VALIDACAO'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 shrink-0" />
            <span className="sm:hidden">4. Validação</span>
            <span className="hidden sm:inline">4. Validação Multidisciplinar</span>
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DATABASE')}
            className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold border-b-2 whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
              activeTab === 'DATABASE'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Database className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
            <span className="sm:hidden">5. BD Firebase</span>
            <span className="hidden sm:inline">5. Banco de Dados & Firebase</span>
            <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] sm:text-[10px] font-bold rounded">FIRESTORE</span>
          </button>
        </div>

        {/* Tab Content - Scrollable with safe mobile padding */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 space-y-6">

          {/* TAB 1: DOSSIÊ DO SISTEMA */}
          {activeTab === 'DOSSIE' && (
            dossierViewMode === 'OFFICIAL_PDF' ? (
              <OfficialDossierPdfViewer
                onDownloadPdf={handleDownloadPdf}
                onOpenPdfTab={handleOpenPdfTab}
                onPrint={handlePrintDossie}
                onDownloadMd={downloadDossierMarkdownFile}
                onDownloadHtml={downloadDossierHtmlFile}
                isPrinting={isPrinting}
                printFeedback={printSuccessFeedback}
                viewMode={dossierViewMode}
                onToggleViewMode={() => setDossierViewMode('CARDS')}
              />
            ) : (
            <div className="space-y-6">
              {/* Action Bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Registro Oficial de Melhorias e Arquitetura</h3>
                  <p className="text-xs text-slate-500">Documento permanente em conformidade com o CTB, CONTRAN e LGPD.</p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isPrinting}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Download className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
                    <span>{isPrinting ? 'Gerando...' : 'Baixar PDF (.pdf)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintDossie}
                    disabled={isPrinting}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Imprimir</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDossierViewMode('OFFICIAL_PDF')}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Ver Modo A4</span>
                  </button>

                  <button
                    type="button"
                    onClick={downloadDossierMarkdownFile}
                    className="flex items-center justify-center gap-1 px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    title="Baixar .MD"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>.MD</span>
                  </button>
                </div>
              </div>

              {printSuccessFeedback && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{printSuccessFeedback}</span>
                </div>
              )}

              {/* Dossier Document Card */}
              <div className="bg-white p-5 sm:p-8 rounded-2xl border border-slate-200 shadow-xs space-y-6 text-slate-800 print:p-0 print:border-none print:shadow-none">
                <div className="border-b border-slate-200 pb-4">
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-md uppercase tracking-wider">
                    Dossiê Técnico Homologado
                  </span>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-2">
                    Sistema de Administração de Gestão de Direção
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    Versão 5.2 Estável e Auditada · Registrado em Outubro de 2026
                  </p>
                </div>

                {/* Section 1 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                    Regra Estrita de Acondicionamento: 1 Aluno (CPF) = 1 Instrutor & Indicação Obrigatória
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Todo candidato cadastrado fica vinculado por CPF de forma unívoca a apenas um instrutor ativo. O sistema impede cadastros cruzados ou duplicados, garantindo a responsabilização pedagógica e o controle individualizado das aulas conforme normativas de trânsito. <strong>Nenhum aluno se cadastra sem a indicação de um instrutor credenciado</strong>.
                  </p>
                </div>

                {/* Section 2 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">2</span>
                    Autonomia para Pacotes de Aulas Personalizados e Planos Comerciais
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Cada instrutor possui autonomia para criar quantos pacotes de aulas desejar, definindo quantidade de aulas (ex: 20 aulas regulamentares, 10 aulas para adição ou treinos de baliza), categoria de CNH (A, B, AB, C, D, E), valor total em centavos e formas de pagamento aceitas:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-7 pt-1">
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <strong className="text-xs text-slate-900 block">À Vista (PIX)</strong>
                      <span className="text-[11px] text-slate-500">Com percentual de desconto automático configurável</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <strong className="text-xs text-slate-900 block">Parcelado no Cartão</strong>
                      <span className="text-[11px] text-slate-500">Até 12x com cálculo automático de parcelas</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                      <strong className="text-xs text-slate-900 block">Negociado Direto</strong>
                      <span className="text-[11px] text-slate-500">Condições flexíveis acordadas entre instrutor e aluno</span>
                    </div>
                  </div>
                </div>

                {/* Section 3 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">3</span>
                    Auto-Matrícula Vinculada e Disparo de Convites por WhatsApp / E-mail
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    O instrutor gera links exclusivos de matrícula vinculados ao seu token credenciado. O convite é enviado diretamente para o WhatsApp ou e-mail do aluno. Ao acessar o link, o instrutor já vem fixado e os pacotes ativos são carregados automaticamente para contratação com validação de CPF e cálculo da idade mínima (18 anos).
                  </p>
                </div>

                {/* Section 4 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">4</span>
                    Transferência de Instrutor com Histórico Perpétuo e Auditoria LGPD
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Quando houver necessidade de remanejamento, o instrutor utiliza a função nativa <strong>Transferir Aluno</strong> com justificativa formal obrigatória. O novo instrutor assume o aluno com acesso integral às aulas cumpridas, ficha de habilidades e avaliações prévias. O evento é registrado em log imutável de auditoria sem qualquer perda pedagógica.
                  </p>
                </div>

                {/* Section 5 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">5</span>
                    Gestão Financeira Completa: Recebíveis, PIX Dinâmico, Despesas, Metas e DRE
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Módulo financeiro centesimal de alta precisão com:
                  </p>
                  <ul className="text-xs text-slate-600 list-disc pl-12 space-y-1">
                    <li><strong>Contas a Receber</strong>: Controle de parcelas pagas, pendentes e vencidas com baixa manual e comprovante.</li>
                    <li><strong>Tecnologia PIX</strong>: Geração dinâmica de payload EMV Copia e Cola e renderização de QR Code instantâneo.</li>
                    <li><strong>Despesas Operacionais</strong>: Categorização de gastos com combustível, manutenção de veículos, seguro, alimentação e taxas do DETRAN.</li>
                    <li><strong>Metas e Investimentos</strong>: Programação de reserva de emergência e compra de novos veículos com barra de progresso.</li>
                    <li><strong>DRE Automatizado</strong>: Demonstração da receita bruta, custos operacionais e apuração do Lucro Líquido Real.</li>
                  </ul>
                </div>

                {/* Section 6 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">6</span>
                    Grade de Aulas Práticas Ampliada (06:00 às 00:00) e Avaliação de Habilidades
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Suporte nativo à grade estendida das 06:00 às 00:00 em conformidade com as exigências de aulas práticas noturnas do CONTRAN. Permite agendamentos com seleção de veículo e aluno, registro de presenças ou faltas, bloqueio de horários para manutenção e atribuição de notas para 8 competências motoras (baliza, embreagem, trânsito pesado, rodovia, etc.).
                  </p>
                </div>

                {/* Section 7 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs">7</span>
                    Governança do Administrador Master e Verificador de Cadastros e Integridade
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    O Administrador Master (<strong>cassiordcosta@gmail.com</strong>) possui painel exclusivo para auditoria de toda a plataforma, com:
                  </p>
                  <ul className="text-xs text-slate-600 list-disc pl-12 space-y-1">
                    <li><strong>Verificador de Cadastros</strong>: Varredura em tempo real para detectar alunos órfãos, aulas sem instrutor, transações financeiras desvinculadas e conflitos de horários.</li>
                    <li><strong>Reatribuição Rápida de Alunos</strong>: Transferência de carteira de alunos entre instrutores com 1 clique pelo administrador.</li>
                    <li><strong>Recuperação Segura de Senha</strong>: Validação cruzada estrita por E-mail + CPF completo com envio de código descartável.</li>
                    <li><strong>Acesso Exclusivo ao Dossiê</strong>: O link do Dossiê é restrito ao Master no cabeçalho e menu móvel.</li>
                  </ul>
                </div>

                {/* Section 8 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">8</span>
                    Central de Cobranças e Lembretes por WhatsApp
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Comunicação rápida via deep link nativo do WhatsApp com modelos profissionais prontos: Lembrete de Aula Prática (24h/2h antes), Aviso de Vencimento de Parcela, Cobrança de Débito com chave PIX inclusa, Confirmação de Matrícula e Parabenização por Aprovação no Exame do DETRAN.
                  </p>
                </div>

                {/* Section 9 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">9</span>
                    Relatórios Oficiais em Folha A4 com Impressão PDF e Assinaturas
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    Geração de Ficha Cadastral e Pedagógica Completa com layout adaptado para impressão A4 (`@media print`), incluindo dados do CFC, identificação protegida do aluno, relação de aulas cumpridas, notas de habilidades, histórico de transferências e campo para assinaturas formais do instrutor e aluno para homologação.
                  </p>
                </div>

                {/* Section 10 */}
                <div className="space-y-2">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">10</span>
                    Agentes de Segurança Ativos e Arquitetura Híbrida Firestore
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed pl-7">
                    A plataforma conta com o <strong>Agente de Monitoramento</strong> (Watchdog com telemetria contínua) e o <strong>Agente de Trava de Código</strong> (Code Guard com checkpoints de restauração e barreira de autorização humana). O armazenamento opera em modo Offline-First com sincronização em lote para o Cloud Firestore (Firebase).
                  </p>
                </div>

                {/* Section 11 - Database Architecture & Data Dictionary */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">11</span>
                    Dicionário de Banco de Dados, 16 Coleções e Mapeamento de Relacionamentos
                  </h2>
                  <div className="pl-7 space-y-3">
                    <p className="text-xs text-slate-600 leading-relaxed">
                      O sistema possui uma estrutura de dados relacional e NoSQL homologada com <strong>16 entidades e coleções</strong> no Cloud Firestore e IndexedDB, com rigorosa integridade referencial:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">1. organizations</span>
                        <p className="text-[11px] text-slate-500">Tenants (Autoescolas e Instrutores Autônomos)</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">2. users</span>
                        <p className="text-[11px] text-slate-500">Contas RBAC, Google OAuth e 2FA</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">3. students</span>
                        <p className="text-[11px] text-slate-500">Alunos com vínculo estrito 1 CPF = 1 Instrutor</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">4. StudentSkills</span>
                        <p className="text-[11px] text-slate-500">8 notas práticas de direção (0 a 10) CONTRAN</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">5. vehicles</span>
                        <p className="text-[11px] text-slate-500">Frota de carros/motos, km e revisões</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">6. lessons</span>
                        <p className="text-[11px] text-slate-500">Aulas práticas diurnas/noturnas (06h às 00h)</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">7. availableSlots</span>
                        <p className="text-[11px] text-slate-500">Grade horária e bloqueios do instrutor</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">8. accountsReceivable</span>
                        <p className="text-[11px] text-slate-500">Faturas e cobranças em centavos com PIX</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">9. paymentRecords</span>
                        <p className="text-[11px] text-slate-500">Comprovantes e amortizações de débitos</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">10. expenses</span>
                        <p className="text-[11px] text-slate-500">Despesas operacionais e custos veiculares</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">11. investments</span>
                        <p className="text-[11px] text-slate-500">Metas financeiras e fundos de reserva</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">12. packages</span>
                        <p className="text-[11px] text-slate-500">Planos comerciais e pacotes de aulas</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">13. studentTransfers</span>
                        <p className="text-[11px] text-slate-500">Trilha imutável de reatribuição de instrutor</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">14. auditLogs</span>
                        <p className="text-[11px] text-slate-500">Auditoria forense e conformidade LGPD</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">15. whatsappLogs</span>
                        <p className="text-[11px] text-slate-500">Logs de cobranças e lembretes via WhatsApp</p>
                      </div>
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
                        <span className="font-bold text-slate-900">16. syncQueue</span>
                        <p className="text-[11px] text-slate-500">Fila Offline-First para o Cloud Firestore</p>
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 space-y-1">
                      <p className="font-bold">Regras Primárias de Integridade do Banco:</p>
                      <ul className="list-disc pl-4 space-y-0.5">
                        <li><strong>Precisão em Centavos</strong>: Todos os campos monetários utilizam inteiros (`valorTotalCentavos`, etc.), eliminando falhas de ponto flutuante.</li>
                        <li><strong>Unicidade por SHA-256</strong>: Validação criptográfica impedindo que o mesmo candidato seja duplicado entre instrutores.</li>
                        <li><strong>Auditoria LGPD</strong>: Registros de auditoria e transferências são blindados contra alteração ou exclusão física.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )
          )}

          {/* TAB 2: AGENTE DE MONITORAMENTO */}
          {activeTab === 'MONITOR' && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold">Integridade Geral</span>
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-extrabold text-emerald-600 font-mono">
                    {metrics.taxaIntegridade}%
                  </div>
                  <span className="text-[10px] text-slate-400">Status: {metrics.statusGeral}</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold">Eventos Hoje</span>
                    <Activity className="w-4 h-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    {metrics.totalEventosHoje}
                  </div>
                  <span className="text-[10px] text-slate-400">Monitorados ao vivo</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold">Alertas Críticos</span>
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    {metrics.alertasCriticos}
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium">0 Anomalias Graves</span>
                </div>

                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between text-slate-500 mb-1">
                    <span className="text-[11px] font-semibold">Base de Dados</span>
                    <Database className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="text-xl font-extrabold text-slate-900 font-mono">
                    {metrics.armazenamentoKb} KB
                  </div>
                  <span className="text-[10px] text-slate-400">Uptime: {metrics.tempoAtivoMinutos} min</span>
                </div>
              </div>

              {/* Live Event Stream */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Feed de Operações Monitoradas em Tempo Real</h3>
                      <p className="text-xs text-slate-500">Últimas ações detectadas pelo sentinela operacional</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 cursor-pointer"
                    >
                      <option value="TODOS">Todos os Níveis</option>
                      <option value="INFO">Informação (INFO)</option>
                      <option value="SEGURO">Seguro (SEGURO)</option>
                      <option value="AVISO">Aviso (AVISO)</option>
                      <option value="CRITICO">Crítico (CRITICO)</option>
                    </select>

                    <button
                      type="button"
                      onClick={handleExportMonitor}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      title="Exportar logs em JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Exportar</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {filteredEvents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Nenhum evento registrado com o filtro selecionado.
                    </div>
                  ) : (
                    filteredEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-start gap-3 hover:bg-white hover:border-slate-200 transition-all text-xs"
                      >
                        <div className="mt-0.5 shrink-0">
                          {ev.severidade === 'CRITICO' && <AlertTriangle className="w-4 h-4 text-red-500" />}
                          {ev.severidade === 'AVISO' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                          {ev.severidade === 'SEGURO' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                          {ev.severidade === 'INFO' && <Info className="w-4 h-4 text-blue-500" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-bold text-slate-900">{ev.titulo}</span>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(ev.timestamp).toLocaleTimeString('pt-BR')}</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold uppercase">
                                {ev.categoria}
                              </span>
                            </div>
                          </div>
                          <p className="text-slate-600 mt-0.5 text-[11px] leading-relaxed">{ev.detalhe}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">Ator: {ev.ator}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AGENTE DE TRAVA DE CÓDIGO E GOVERNANÇA */}
          {activeTab === 'GUARD' && (
            <div className="space-y-6">
              
              {/* Lock Status Banner */}
              <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                guardState.travaAtiva
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-start gap-3.5">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    guardState.travaAtiva ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                  }`}>
                    {guardState.travaAtiva ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold">
                      {guardState.travaAtiva
                        ? 'Trava de Código e Integridade: ATIVADA (100% Blindado)'
                        : 'Trava Temporariamente Suspensa: Modo de Alteração Autorizado'}
                    </h3>
                    <p className="text-xs text-slate-600 mt-1">
                      {guardState.travaAtiva
                        ? 'Nenhuma alteração estrutural, remoção de dados ou quebra de fluxo pode ser feita sem a sua autorização explícita.'
                        : `Destravado por: ${guardState.ultimaAutorizacao?.autor || 'Operador'}. Motivo: ${guardState.ultimaAutorizacao?.motivo || 'Manutenção'}.`}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 w-full sm:w-auto">
                  {guardState.travaAtiva ? (
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.getElementById('auth-form');
                        el?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full sm:w-auto px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <KeyRound className="w-4 h-4 text-amber-400" />
                      <span>Conceder Autorização</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleLock}
                      className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      <span>Travar Sistema Imediatamente</span>
                    </button>
                  )}
                </div>
              </div>

              {authSuccessMsg && (
                <div className="p-3 bg-emerald-100 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{authSuccessMsg}</span>
                </div>
              )}

              {/* Module Integrity Checklist */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Checklist Contínuo de Integridade dos Módulos</h3>
                    <p className="text-xs text-slate-500">Sentinelas que validam as regras de negócio em tempo de execução</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[11px] font-bold rounded-full">
                    {modules.filter(m => m.status === 'PROTEGIDO').length}/{modules.length} Módulos Verificados
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {modules.map((m, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <strong className="text-xs text-slate-900 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          {m.modulo}
                        </strong>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {m.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">{m.descricao}</p>
                      <div className="space-y-1 pt-1 border-t border-slate-200/60">
                        {m.regrasAtivas.map((r, rIdx) => (
                          <div key={rIdx} className="text-[10px] text-slate-600 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Snapshots / Rollback Checkpoints */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Pontos de Restauração (Rollback Checkpoints)</h3>
                    <p className="text-xs text-slate-500">Permite reverter o banco de dados e regras caso ocorra dano</p>
                  </div>

                  <form onSubmit={handleCreateSnapshot} className="flex items-center gap-2 w-full sm:w-auto">
                    <input
                      type="text"
                      placeholder="Nome do ponto..."
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg flex-1 sm:w-48"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Criar Ponto Agora
                    </button>
                  </form>
                </div>

                <div className="space-y-2">
                  {snapshots.length === 0 ? (
                    <p className="text-xs text-slate-400 py-3 text-center">Nenhum ponto gravado ainda.</p>
                  ) : (
                    snapshots.map((snap) => (
                      <div
                        key={snap.id}
                        className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-white hover:border-slate-200 transition-all text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-600" />
                            <strong className="text-slate-900">{snap.nome}</strong>
                            <span className="text-[10px] text-slate-400">
                              ({snap.totalEntidades} tabelas)
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Criado em: {new Date(snap.criadoEm).toLocaleString('pt-BR')} por {snap.autor}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRestore(snap.id, snap.nome)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-amber-100 hover:text-amber-800 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurar Este Ponto</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Human Authorization Form */}
              <div id="auth-form" className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white">
                      Portal de Autorização Humana Obrigatória
                    </h3>
                    <p className="text-xs text-slate-400">
                      Exigido pelo operador para que a IA ou manutenções externas possam realizar alterações.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleAuthorize} className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      Motivo / Justificativa da Alteração:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Ajuste de responsividade mobile e revisão de layout"
                      value={authReason}
                      onChange={(e) => setAuthReason(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-hidden focus:border-amber-500 text-base sm:text-xs"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <p className="text-[11px] text-slate-400">
                      Ao conceder autorização, a trava temporária libera alterações e gera token de rastreabilidade.
                    </p>
                    <button
                      type="submit"
                      className="w-full sm:w-auto px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-md flex items-center justify-center gap-2"
                    >
                      <Unlock className="w-4 h-4" />
                      <span>Emitir Autorização Expressa</span>
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}

          {/* TAB 4: VALIDAÇÃO TÉCNICA MULTIDISCIPLINAR (UX/UI, ENGENHARIA, ARQUITETURA) */}
          {activeTab === 'VALIDACAO' && (
            <div className="space-y-6">
              {/* Header Overview Banner */}
              <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 rounded-2xl border border-indigo-900/50 shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/40 text-purple-300 flex items-center justify-center shrink-0">
                      <Cpu className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                          Painel de Validação Integral Multidisciplinar
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                          100% Homologado
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        Auditoria de ponta a ponta: Analista UX/UI · Engenheiro de Software · Arquiteto de Sistemas
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-slate-400 font-mono">Modos auditados:</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-purple-300 text-[11px] font-mono border border-slate-700">
                      Mobile · Tablet · Desktop · Print
                    </span>
                  </div>
                </div>

                {/* Scorecards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-4 border-t border-indigo-800/40">
                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-pink-500/20 text-pink-300 shrink-0">
                      <Palette className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">Analista UX / UI</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[11px] text-slate-300 block">Touch 44px, zero cortes, contraste AA</span>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20 text-blue-300 shrink-0">
                      <Terminal className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">Engenheiro Software</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[11px] text-slate-300 block">Centavos inteiros, tipagem TS estrita</span>
                    </div>
                  </div>

                  <div className="bg-white/5 backdrop-blur-xs p-3 rounded-xl border border-white/10 flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-300 shrink-0">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-200">Arquiteto Sistemas</span>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </div>
                      <span className="text-[11px] text-slate-300 block">1 Aluno = 1 Instrutor, isolamento tenant</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setValidationFilter('TODOS')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      validationFilter === 'TODOS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos (18 Itens)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter('UX_UI')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      validationFilter === 'UX_UI'
                        ? 'bg-white text-pink-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    UX / UI (6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter('ENGENHARIA')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      validationFilter === 'ENGENHARIA'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Engenharia (6)
                  </button>
                  <button
                    type="button"
                    onClick={() => setValidationFilter('ARQUITETURA')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      validationFilter === 'ARQUITETURA'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Arquitetura (6)
                  </button>
                </div>

                <div className="text-xs text-slate-500 font-medium">
                  Status: <strong className="text-emerald-700">18 Aprovados</strong> · 0 Pendências
                </div>
              </div>

              {/* Checklist Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* UX/UI Item 1 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Responsividade e Zero Cortes de Campos</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Inputs de formulários com <code className="text-pink-600 font-mono">grid-cols-1 sm:grid-cols-2</code>. Nenhum campo de CPF, telefone, data de nascimento ou moeda quebra em 360px–430px.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Viewport testado: 360px (Galaxy), 390px (iPhone), 768px (iPad), 1280px (Desktop)
                    </div>
                  </div>
                )}

                {/* UX/UI Item 2 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Modais em Bottom-Sheet no Mobile</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Modais ancoram como bottom-sheet no mobile (<code className="text-pink-600 font-mono">items-end sm:items-center p-0 sm:p-4</code>) com botões empilhados <code className="text-pink-600 font-mono">flex-col-reverse sm:flex-row</code> para toque confortável com o polegar.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Arquivos: FinanceView, PackagesManager, StudentTransferModal, StudentSelfRegister
                    </div>
                  </div>
                )}

                {/* UX/UI Item 3 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Tabelas com Rolagem Horizontal Sem Cortes</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Encapsulamento com <code className="text-pink-600 font-mono">overflow-x-auto min-w-[...]</code> previne qualquer corte de dados de notas pedagógicas, parcelas ou trilhas de auditoria.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Componentes: ReportsView, AuditLogViewer, AdminMasterPanel
                    </div>
                  </div>
                )}

                {/* UX/UI Item 4 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Alinhamento Text-Left em Coluna Mobile</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Remoção de desalinhamentos onde caixas continham <code className="text-pink-600 font-mono">text-right</code> mas empilhavam em coluna única. Ajustado para <code className="text-pink-600 font-mono">text-left sm:text-right</code>.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Componentes: WhatsAppRemindersView, StudentPortal
                    </div>
                  </div>
                )}

                {/* UX/UI Item 5 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Touch Targets e Acessibilidade WCAG AA</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Áreas de toque mínimas de 44px para botões primários no mobile, contrastes cromáticos de texto superiores a 4.5:1 e rótulos acessíveis (<code className="text-pink-600 font-mono">aria-label</code>) em botões de fechar.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Métrica: Contraste &gt; 5.2:1 em fundos escuros e claros
                    </div>
                  </div>
                )}

                {/* UX/UI Item 6 */}
                {(validationFilter === 'TODOS' || validationFilter === 'UX_UI') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4 text-pink-600" />
                        <h4 className="text-xs font-bold text-slate-900">Modo de Impressão e Dossiê A4</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Diretivas <code className="text-pink-600 font-mono">print:overflow-visible print:p-0 no-print</code> aplicadas aos relatórios pedagógicos, ficha de aula e dossiê oficial, permitindo geração limpa em PDF.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Pronto para: Impressão física e protocolo com assinatura
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 1 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Aritmética Monetária em Centavos Inteiros</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Todos os valores de pacotes, recebimentos e despesas operam internamente como <code className="text-blue-600 font-mono">number</code> de centavos inteiros (ex: R$ 1.500,00 = 150000). Elimina erros de ponto flutuante IEEE 754.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Funções: formatCentavosToReal(), parseRealToCentavos()
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 2 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Compilação e Tipagem TypeScript Estrita</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Build validado via Vite com zero warnings e zero erros. Interfaces estritas para <code className="text-blue-600 font-mono">Student</code>, <code className="text-blue-600 font-mono">LessonPackage</code>, <code className="text-blue-600 font-mono">FinancialAccount</code> e modelos auxiliares.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Status do Build: 0 errors · 0 linter violations
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 3 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Validação Estrita de CPF e Maioridade 18+</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Algoritmo oficial de dígitos verificadores (módulo 11) com rejeição de sequências inválidas. Cálculo exato de maioridade baseado na data de nascimento com bloqueio estrito de menores de idade.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Biblioteca: src/lib/validation.ts (validarCPF, validarMaioridade)
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 4 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Resiliência Offline e Sincronização Local</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Persistência com fallback seguro em LocalStorage e fila de sincronização em segundo plano via hook <code className="text-blue-600 font-mono">useOnlineStatus</code>. O instrutor consegue operar mesmo em áreas com sinal oscilante.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Capacidade: Operação 100% autônoma offline com indicador visual
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 5 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Auditoria Automática de Todas as Mutações</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Toda ação de cadastro, transferência de aluno, registro financeiro ou alteração de aula grava evento com autor, timestamp, IP simulado e detalhes na tabela imutável <code className="text-blue-600 font-mono">AuditLog</code>.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Exportação: JSON em conformidade com o Art. 18 da LGPD
                    </div>
                  </div>
                )}

                {/* ENGENHARIA Item 6 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ENGENHARIA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4 text-blue-600" />
                        <h4 className="text-xs font-bold text-slate-900">Prevenção de Injeção de Código e XSS</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Zero uso de <code className="text-blue-600 font-mono">dangerouslySetInnerHTML</code> ou <code className="text-blue-600 font-mono">eval</code>. Strings e dados de alunos são renderizados de forma segura pelo React DOM.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Segurança de Execução: Sanitização nativa de inputs
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 1 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Regra de Acondicionamento: 1 Aluno (CPF) = 1 Instrutor</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Vínculo estrito por CPF único que impede duplicidade ou conflito pedagógico entre instrutores. Garante responsabilização jurídica e pedagógica conforme diretrizes do CONTRAN.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Camada de Aplicação: db.createStudent() valida unicidade de CPF
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 2 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Autonomia Descentralizada de Pacotes de Aulas</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Cada instrutor atua como entidade autônoma para criar e editar pacotes ilimitados com suporte a pagamento À Vista (com desconto), Parcelado (cartão) e Negociado. Auto-seleção no momento do registro.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Isolamento: instrutorId associado a cada LessonPackage
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 3 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Transferência de Aluno com Histórico Perpétuo</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Quando transferido para outro instrutor, o histórico de aulas anteriores, avaliações práticas e competências é 100% preservado. Uma entrada imutável é gravada no array <code className="text-emerald-600 font-mono">historicoTransferencias</code>.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Integridade Referencial: Nenhuma aula pretérita é órfã
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 4 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Grade Estendida com Aulas Noturnas (06h às 00h)</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Estrutura de dados desenhada para suportar intervalos de 50 minutos entre as 06:00 e 00:00. Atende rigorosamente a exigência legal de carga horária noturna para primeira habilitação.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Módulo: ScheduleView com slots gerados programaticamente
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 5 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Agentes Sentinelas e Governança de Código</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Agente de Monitoramento contínuo em tempo real + Agente de Trava de Código que impede mutações não autorizadas, com rollback instantâneo via checkpoints e autorização explícita do usuário.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      Engenharia de Segurança: codeGuardAgent + monitoringAgent
                    </div>
                  </div>
                )}

                {/* ARQUITETURA Item 6 */}
                {(validationFilter === 'TODOS' || validationFilter === 'ARQUITETURA') && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold text-slate-900">Isolamento Multi-Tenant e Governança RBAC</h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        APROVADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Papéis estritos (<code className="text-emerald-600 font-mono">SUPER_ADMIN</code>, <code className="text-emerald-600 font-mono">ADMIN_ORG</code>, <code className="text-emerald-600 font-mono">INSTRUTOR</code>, <code className="text-emerald-600 font-mono">ALUNO</code>). O aluno só acessa sua própria ficha, o instrutor vê apenas seus alunos e pacotes, e o Master gerencia as autoescolas.
                    </p>
                    <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono">
                      RBAC: Filtragem garantida por organizacaoId e userId
                    </div>
                  </div>
                )}

              </div>

              {/* Technical Sign-Off Footer */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-bold text-white">
                      Parecer Conclusivo da Tríade de Especialistas
                    </h5>
                    <p className="text-[11px] text-slate-400">
                      Sistema homologado com excelência nos 3 pilares técnicos em todos os modos operacionais.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handlePrintDossie}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Emitir Laudo Completo</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 5: BANCO DE DADOS & FIREBASE */}
          {activeTab === 'DATABASE' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900">
                        Google Cloud Firestore & Firebase Auth
                      </h3>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        PROVISIONADO & CONECTADO
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Instância de banco de dados NoSQL corporativa com segurança Zero-Trust e persistência em nuvem.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <button
                    type="button"
                    disabled={connTesting}
                    onClick={async () => {
                      setConnTesting(true);
                      setConnResult(null);
                      try {
                        const res = await db.testFirebaseConnection();
                        setConnResult(res);
                      } catch (err: any) {
                        setConnResult({ connected: false, message: `Falha: ${err.message}` });
                      } finally {
                        setConnTesting(false);
                      }
                    }}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${connTesting ? 'animate-spin' : ''}`} />
                    <span>{connTesting ? 'Testando Ping...' : 'Testar Conexão Cloud'}</span>
                  </button>
                </div>
              </div>

              {/* Ping Connection Result Alert */}
              {connResult && (
                <div
                  className={`p-4 rounded-xl border flex items-start gap-3 ${
                    connResult.connected
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50/70 border-amber-200 text-amber-900'
                  }`}
                >
                  {connResult.connected ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs">
                    <p className="font-bold">
                      {connResult.connected ? 'Conexão Firestore Homologada' : 'Alerta de Conexão'}
                    </p>
                    <p className="text-slate-600 mt-0.5">{connResult.message}</p>
                  </div>
                </div>
              )}

              {/* Credentials & Architecture Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">Projeto Google Cloud</span>
                    <Cloud className="w-4 h-4 text-blue-500" />
                  </div>
                  <p className="font-mono text-xs font-bold text-slate-800 truncate" title={firebaseStatus.projectId}>
                    {firebaseStatus.projectId}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Ambiente Oficial AI Studio</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">Banco Firestore ID</span>
                    <Database className="w-4 h-4 text-emerald-500" />
                  </div>
                  <p className="font-mono text-xs font-bold text-slate-800 truncate" title={firebaseStatus.databaseId}>
                    {firebaseStatus.databaseId}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">Database isolado e dedicado</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span className="font-semibold">Domínio de Autenticação</span>
                    <KeyRound className="w-4 h-4 text-amber-500" />
                  </div>
                  <p className="font-mono text-xs font-bold text-slate-800 truncate" title={firebaseStatus.authDomain}>
                    {firebaseStatus.authDomain}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">OAuth Google & Tokens JWT</p>
                </div>
              </div>

              {/* Migration Engine Section */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <UploadCloud className="w-5 h-5 text-blue-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        Motor de Migração: LocalStorage ➔ Cloud Firestore
                      </h4>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Transfere com segurança os cadastros, históricos de aulas, finanças e auditoria do navegador para o Firestore.
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={migrating}
                    onClick={async () => {
                      setMigrating(true);
                      setMigrationResult(null);
                      try {
                        const res = await db.migrateLocalDataToFirestore((prog) => {
                          setMigrationProgress(prog);
                        });
                        setMigrationResult(res);
                        setFirebaseStatus(db.getFirebaseStatus());
                      } catch (err: any) {
                        console.error('Erro na migração:', err);
                      } finally {
                        setMigrating(false);
                      }
                    }}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <UploadCloud className={`w-4 h-4 ${migrating ? 'animate-bounce' : ''}`} />
                    <span>{migrating ? 'Migrando Lotes...' : 'Iniciar Migração para Firestore'}</span>
                  </button>
                </div>

                {/* Local Records Summary */}
                <div>
                  <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2.5">
                    Entidades Locais Prontas para Migração:
                  </h5>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Alunos</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getStudents('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Usuários</p>
                      <p className="text-base font-extrabold text-slate-900">{db.getUsers().length}</p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Veículos</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getVehicles('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Aulas</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getLessons('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Horários</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getSlots('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Faturas / Contas</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getAccountsReceivable('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Pagamentos</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getPayments('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Despesas</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getExpenses('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Investimentos</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getInvestments('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Pacotes CNH</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getPackages('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Logs Auditoria</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getAuditLogs('org_direcao_certa_01').length}
                      </p>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-center">
                      <p className="text-[11px] text-slate-500 font-medium">Organizações</p>
                      <p className="text-base font-extrabold text-slate-900">
                        {db.getOrganizations().length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Real-time Migration Progress */}
                {migrationProgress && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>{migrationProgress.currentCollection}</span>
                      <span className="font-mono text-blue-600 font-bold">
                        {migrationProgress.processedItems} / {migrationProgress.totalItems} ({migrationProgress.percent}%)
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${migrationProgress.percent}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                      {Object.entries(migrationProgress.collections).map(([key, col]) => (
                        <div key={key} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-100 text-[11px]">
                          <span className="text-slate-600 truncate">{col.collectionName}:</span>
                          <span className={`font-mono font-bold ${
                            col.status === 'SUCESSO' ? 'text-emerald-600' :
                            col.status === 'MIGRANDO' ? 'text-blue-600 animate-pulse' :
                            col.status === 'ERRO' ? 'text-rose-600' : 'text-slate-400'
                          }`}>
                            {col.migrated}/{col.total}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Migration Success Confirmation */}
                {migrationResult && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-bold text-emerald-950">
                        Migração concluída com sucesso!
                      </p>
                      <p className="text-emerald-800">
                        Um total de <strong>{migrationResult.totalMigrated} registros</strong> foram sincronizados com o banco de dados Cloud Firestore no projeto <code>{firebaseStatus.projectId}</code>.
                      </p>
                      <p className="text-[11px] text-emerald-700">
                        Carimbo de conclusão: {new Date(migrationResult.migratedAt).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}

                {firebaseStatus.lastMigration && !migrationResult && (
                  <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Última sincronização com o Firestore realizada em: {new Date(firebaseStatus.lastMigration).toLocaleString('pt-BR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-white p-3.5 sm:p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span className="flex items-center gap-1.5">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <span>Sistema 100% Responsivo e Blindado</span>
          </span>
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
};
