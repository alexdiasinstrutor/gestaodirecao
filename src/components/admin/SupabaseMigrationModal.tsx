import React, { useState } from 'react';
import {
  X,
  Database,
  Key,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Check,
  Download,
  RefreshCw,
  Send,
  Code2,
  Layers,
  ArrowRight,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import {
  generateSupabaseSchemaSQL,
  generateSupabaseDataDumpSQL,
  testSupabaseConnection,
  syncDataToSupabase,
  getStoredSupabaseConfig,
  saveStoredSupabaseConfig,
  SupabaseConfig
} from '../../lib/supabaseMigration';

interface SupabaseMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseMigrationModal: React.FC<SupabaseMigrationModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const [config, setConfig] = useState<SupabaseConfig>(getStoredSupabaseConfig());
  const [activeStep, setActiveStep] = useState<'CREDENTIALS' | 'SCHEMA' | 'SYNC'>('CREDENTIALS');
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message?: string; success?: boolean } | null>(null);
  const [copiedSchema, setCopiedSchema] = useState(false);
  const [copiedDump, setCopiedDump] = useState(false);
  const [syncState, setSyncState] = useState<{
    syncing: boolean;
    currentTable: string;
    percent: number;
    finished?: boolean;
    error?: string;
  }>({
    syncing: false,
    currentTable: '',
    percent: 0
  });

  const schemaSQL = generateSupabaseSchemaSQL();
  const dumpSQL = generateSupabaseDataDumpSQL();

  const handleTestConnection = async () => {
    setTestStatus({ testing: true });
    saveStoredSupabaseConfig(config);
    const res = await testSupabaseConnection(config);
    setTestStatus({
      testing: false,
      success: res.success,
      message: res.message
    });
  };

  const handleCopySchema = () => {
    navigator.clipboard.writeText(schemaSQL);
    setCopiedSchema(true);
    setTimeout(() => setCopiedSchema(false), 2500);
  };

  const handleDownloadSchema = () => {
    const blob = new Blob([schemaSQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'schema_supabase_direcao.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyDump = () => {
    navigator.clipboard.writeText(dumpSQL);
    setCopiedDump(true);
    setTimeout(() => setCopiedDump(false), 2500);
  };

  const handleDownloadDump = () => {
    const blob = new Blob([dumpSQL], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dados_dump_direcao.sql';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleStartDirectSync = async () => {
    if (!config.projectUrl || !config.apiKey) {
      alert('Por favor, informe a URL do projeto Supabase e a Chave de API na primeira aba.');
      setActiveStep('CREDENTIALS');
      return;
    }

    setSyncState({ syncing: true, currentTable: 'Iniciando...', percent: 5 });

    try {
      const res = await syncDataToSupabase(config, (progress) => {
        setSyncState(prev => ({
          ...prev,
          currentTable: progress.currentTable,
          percent: progress.percent
        }));
      });

      setSyncState({
        syncing: false,
        currentTable: 'Concluído com sucesso!',
        percent: 100,
        finished: true
      });
    } catch (err: any) {
      setSyncState({
        syncing: false,
        currentTable: 'Falha na sincronização',
        percent: 0,
        error: err.message || 'Erro inesperado ao sincronizar com o Supabase'
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col">
        {/* Top Header */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white p-5 flex items-center justify-between shrink-0 border-b border-emerald-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white">
                  Integração & Migrador Supabase (PostgreSQL)
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30 uppercase">
                  Exclusivo Master
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Conecte seu projeto Supabase, gere o esquema relacional oficial com chaves estrangeiras e sincronize os dados.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Steps Bar */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex items-center gap-2 overflow-x-auto shrink-0 text-xs font-bold">
          <button
            onClick={() => setActiveStep('CREDENTIALS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeStep === 'CREDENTIALS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>1. Credenciais Supabase</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

          <button
            onClick={() => setActiveStep('SCHEMA')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeStep === 'SCHEMA'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>2. Esquema SQL & Relações</span>
          </button>

          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

          <button
            onClick={() => setActiveStep('SYNC')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
              activeStep === 'SYNC'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>3. Cópia & Sincronização</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs text-slate-700 flex-1">
          {/* STEP 1: CREDENCIAIS */}
          {activeStep === 'CREDENTIALS' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-emerald-900 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-emerald-800 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Como obter as credenciais do seu projeto Supabase:
                </span>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  Acesse seu painel no <strong>supabase.com</strong>, selecione seu projeto e vá em <strong>Project Settings → API</strong>. Copie a <strong>Project URL</strong> e a chave <strong>anon public</strong> (ou <strong>service_role</strong> para bypass de RLS).
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL do Projeto Supabase (Project URL) *
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="url"
                      placeholder="https://abcdefghijklmnop.supabase.co"
                      value={config.projectUrl}
                      onChange={(e) => setConfig({ ...config, projectUrl: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    O endpoint base da REST API do seu banco de dados PostgreSQL no Supabase.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Chave de Acesso (API Key: anon ou service_role) *
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Utilizada exclusivamente para autenticar as requisições com o PostgREST.
                  </span>
                </div>
              </div>

              {testStatus && (
                <div className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
                  testStatus.success
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-red-50 border-red-300 text-red-800'
                }`}>
                  {testStatus.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span className="font-semibold">{testStatus.message}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testStatus?.testing}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testStatus?.testing ? 'animate-spin' : ''}`} />
                  <span>{testStatus?.testing ? 'Testando Conexão...' : 'Testar Conexão com Supabase'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('SCHEMA')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <span>Avançar para o Esquema SQL</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: ESQUEMA SQL & RELAÇÕES */}
          {activeStep === 'SCHEMA' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                <div>
                  <h3 className="font-bold text-slate-900 text-xs">
                    Esquema Relacional PostgreSQL / Supabase
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Cria automaticamente as 12 tabelas com Chaves Primárias, Chaves Estrangeiras, Índices e Cascata.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopySchema}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold transition-colors cursor-pointer"
                  >
                    {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedSchema ? 'Copiado!' : 'Copiar Script SQL'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadSchema}
                    className="flex items-center gap-1 px-3 py-1.5 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-semibold transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar .sql</span>
                  </button>
                </div>
              </div>

              {/* Bloco de Código SQL */}
              <div className="relative border border-slate-300 rounded-2xl overflow-hidden bg-slate-950 text-slate-200 font-mono text-[11px]">
                <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between text-slate-400 text-[10px]">
                  <span>schema_supabase_direcao.sql · 12 Tabelas Relacionais</span>
                  <span>PostgreSQL 15+</span>
                </div>
                <textarea
                  readOnly
                  value={schemaSQL}
                  rows={14}
                  className="w-full bg-slate-950 text-emerald-400 p-4 font-mono text-[11px] resize-none focus:outline-none"
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px] leading-relaxed">
                <strong>💡 Como aplicar no Supabase:</strong> Abra o <strong>SQL Editor</strong> no painel do Supabase, cole o código acima e clique em <strong>RUN</strong>. As tabelas serão criadas instantaneamente com todos os relacionamentos e regras de integridade.
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStep('CREDENTIALS')}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-medium cursor-pointer"
                >
                  Voltar
                </button>

                <button
                  type="button"
                  onClick={() => setActiveStep('SYNC')}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <span>Avançar para Cópia de Dados</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: CÓPIA E SINCRONIZAÇÃO */}
          {activeStep === 'SYNC' && (
            <div className="space-y-5">
              {/* Opção 1: Sincronização Direta via API */}
              <div className="border border-emerald-200 bg-emerald-50/50 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-600 text-white rounded-xl">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Opção A: Cópia e Sincronização Direta via API REST
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      O sistema transmite todas as organizações, usuários, alunos e finanças diretamente para o seu Supabase.
                    </p>
                  </div>
                </div>

                {syncState.syncing && (
                  <div className="space-y-2 bg-white p-4 rounded-xl border border-emerald-200">
                    <div className="flex justify-between font-bold text-slate-800 text-xs">
                      <span>{syncState.currentTable}</span>
                      <span>{syncState.percent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${syncState.percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {syncState.finished && (
                  <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-900 rounded-xl font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Todas as tabelas e registros foram copiados para o Supabase com sucesso!</span>
                  </div>
                )}

                {syncState.error && (
                  <div className="p-3.5 bg-red-50 border border-red-300 text-red-800 rounded-xl font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                    <span>{syncState.error}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleStartDirectSync}
                  disabled={syncState.syncing}
                  className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-4 h-4 ${syncState.syncing ? 'animate-spin' : ''}`} />
                  <span>{syncState.syncing ? 'Copiando Tabelas...' : 'Iniciar Cópia de Dados para Supabase'}</span>
                </button>
              </div>

              {/* Opção 2: Exportação por Dump SQL (Cópia Manual sem depender de chaves) */}
              <div className="border border-slate-200 bg-white rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-slate-900 text-white rounded-xl">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Opção B: Dump SQL de Dados (Carga Rápida via SQL Editor)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Gera os comandos <code className="font-mono font-bold">INSERT INTO</code> com todos os dados atuais da plataforma para você rodar diretamente no Supabase.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyDump}
                    className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold cursor-pointer shadow-xs"
                  >
                    {copiedDump ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedDump ? 'Dump Copiado!' : 'Copiar INSERTs SQL'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadDump}
                    className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-semibold cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Baixar Arquivo dados_dump.sql</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500">
            Compatível com Supabase, Neon e qualquer banco PostgreSQL standard.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
