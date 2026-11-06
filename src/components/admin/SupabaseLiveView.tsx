import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Server,
  Users,
  Building,
  GraduationCap,
  Package,
  Ticket,
  Key,
  ShieldCheck,
  Search,
  ExternalLink,
  UploadCloud,
  Check,
  X,
  Clock,
  Sparkles
} from 'lucide-react';
import { supabase, supabaseUrl, testSupabaseClientConnection } from '../../lib/supabaseClient';
import { supabaseAdapter } from '../../lib/supabaseAdapter';
import { db } from '../../lib/storage';
import { User, Organization, Student, PackageOffer, DiscountCoupon } from '../../types';
import { formatCurrencyBRL } from '../../lib/validation';

export const SupabaseLiveView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'ORGS' | 'STUDENTS' | 'PACKAGES' | 'COUPONS'>('USERS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [connectionStatus, setConnectionStatus] = useState<{ connected: boolean; message: string; latencyMs?: number }>({
    connected: false,
    message: 'Testando conexão com Supabase...'
  });

  // Dados carregados diretamente do Supabase PostgreSQL
  const [remoteUsers, setRemoteUsers] = useState<User[]>([]);
  const [remoteOrgs, setRemoteOrgs] = useState<Organization[]>([]);
  const [remoteStudents, setRemoteStudents] = useState<Student[]>([]);
  const [remotePackages, setRemotePackages] = useState<PackageOffer[]>([]);
  const [remoteCoupons, setRemoteCoupons] = useState<DiscountCoupon[]>([]);

  // Estado da Sincronização Forçada (Push)
  const [isPushing, setIsPushing] = useState<boolean>(false);
  const [pushProgress, setPushProgress] = useState<string>('');
  const [pushResult, setPushResult] = useState<{ success: boolean; stats: Record<string, number>; errors: string[] } | null>(null);

  // Modal de edição / redefinição de senha rápida no Supabase
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [resetMessage, setResetMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Carrega todos os registros ao vivo direto do Supabase
  const fetchLiveSupabaseData = async () => {
    setLoading(true);
    setResetMessage(null);
    try {
      // 1. Testa conectividade e mede latência
      const conn = await testSupabaseClientConnection();
      setConnectionStatus(conn);

      // 2. Consulta paralela em todas as tabelas principais no PostgreSQL
      const [users, orgs, students, packages, coupons] = await Promise.all([
        supabaseAdapter.getUsers(),
        supabaseAdapter.getOrganizations(),
        supabaseAdapter.getStudents(),
        supabaseAdapter.getPackages(),
        supabaseAdapter.getCoupons()
      ]);

      setRemoteUsers(users || []);
      setRemoteOrgs(orgs || []);
      setRemoteStudents(students || []);
      setRemotePackages(packages || []);
      setRemoteCoupons(coupons || []);
    } catch (err: any) {
      console.error('[SupabaseLiveView] Falha ao carregar dados:', err);
      setConnectionStatus({
        connected: false,
        message: 'Falha ao consultar tabelas: ' + (err?.message || 'Erro de rede')
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveSupabaseData();
  }, []);

  // Executa o envio completo dos dados locais para o Supabase
  const handleForcePushToSupabase = async () => {
    if (!window.confirm('Deseja enviar TODOS os dados do ambiente local para o banco Supabase em nuvem?')) {
      return;
    }
    setIsPushing(true);
    setPushProgress('Iniciando sincronização...');
    setPushResult(null);

    try {
      const res = await db.pushAllLocalDataToSupabase((msg) => setPushProgress(msg));
      setPushResult(res);
      // Recarrega os dados ao vivo do Supabase
      await fetchLiveSupabaseData();
    } catch (err: any) {
      setPushResult({
        success: false,
        stats: {},
        errors: [err?.message || 'Erro desconhecido durante sincronização']
      });
    } finally {
      setIsPushing(false);
      setPushProgress('');
    }
  };

  // Salva nova senha diretamente no Supabase e no localStorage
  const handleConfirmPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToReset) return;
    if (!newPasswordInput || newPasswordInput.trim().length < 6) {
      setResetMessage({ text: 'A senha deve possuir no mínimo 6 caracteres.', isError: true });
      return;
    }

    try {
      const ok = await db.updateUserPasswordAsync(userToReset.id, newPasswordInput.trim());
      if (ok) {
        setResetMessage({ text: `Senha do usuário ${userToReset.nome} atualizada com sucesso no banco Supabase!`, isError: false });
        setTimeout(() => {
          setUserToReset(null);
          setNewPasswordInput('');
          setResetMessage(null);
          fetchLiveSupabaseData();
        }, 1200);
      } else {
        setResetMessage({ text: 'Falha ao atualizar senha.', isError: true });
      }
    } catch (err: any) {
      setResetMessage({ text: 'Erro ao salvar no banco: ' + (err?.message || 'Tente novamente'), isError: true });
    }
  };

  // Filtragem de busca
  const term = searchTerm.trim().toLowerCase();
  const filteredUsers = remoteUsers.filter(
    (u) => u.nome.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.papel.toLowerCase().includes(term) || u.id.toLowerCase().includes(term)
  );
  const filteredOrgs = remoteOrgs.filter(
    (o) => o.nome.toLowerCase().includes(term) || o.cnpjCpf.toLowerCase().includes(term) || o.email.toLowerCase().includes(term)
  );
  const filteredStudents = remoteStudents.filter(
    (s) => s.nome.toLowerCase().includes(term) || s.cpfMascarado.includes(term) || (s.email && s.email.toLowerCase().includes(term))
  );
  const filteredPackages = remotePackages.filter(
    (p) => p.nome.toLowerCase().includes(term) || (p.instrutorNome && p.instrutorNome.toLowerCase().includes(term))
  );
  const filteredCoupons = remoteCoupons.filter(
    (c) => c.codigo.toLowerCase().includes(term) || (c.criadoPorNome && c.criadoPorNome.toLowerCase().includes(term))
  );

  return (
    <div className="space-y-4">
      {/* Top Banner de Diagnóstico e Conexão em Tempo Real */}
      <div className="bg-slate-900 border border-slate-800 text-white rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`p-3 rounded-xl border ${
              connectionStatus.connected
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-red-500/20 text-red-400 border-red-500/30'
            }`}>
              <Database className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-white text-base">Banco de Dados Supabase (Ao Vivo)</h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  connectionStatus.connected
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                    : 'bg-red-500/15 text-red-300 border-red-400/30'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${connectionStatus.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  {connectionStatus.connected ? 'ONLINE / CONECTADO' : 'OFFLINE / ERRO'}
                </span>
                {connectionStatus.latencyMs !== undefined && (
                  <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" /> {connectionStatus.latencyMs}ms de latência
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono mt-0.5 flex items-center gap-1 break-all">
                <Server className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span>Endpoint: {supabaseUrl}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchLiveSupabaseData}
              disabled={loading || isPushing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all border border-slate-700 cursor-pointer shadow-xs"
              title="Recarrega todos os registros diretamente do PostgreSQL"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
              <span>{loading ? 'Consultando...' : 'Atualizar do Banco'}</span>
            </button>

            <button
              onClick={handleForcePushToSupabase}
              disabled={loading || isPushing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/30 cursor-pointer"
              title="Envia todos os cadastros locais para o Supabase garantindo que nada fique faltando"
            >
              <UploadCloud className={`w-4 h-4 ${isPushing ? 'animate-bounce' : ''}`} />
              <span>{isPushing ? 'Enviando...' : 'Forçar Push Local ➔ Nuvem'}</span>
            </button>
          </div>
        </div>

        {/* Notificação de Progresso do Push */}
        {isPushing && (
          <div className="mt-3 p-3 bg-purple-950/60 border border-purple-800/60 rounded-xl text-xs text-purple-200 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-400 shrink-0" />
            <span>{pushProgress}</span>
          </div>
        )}

        {/* Notificação de Resultado do Push */}
        {pushResult && (
          <div className={`mt-3 p-3 rounded-xl text-xs border ${
            pushResult.success
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
              : 'bg-amber-950/60 border-amber-800 text-amber-200'
          }`}>
            <div className="flex items-center gap-2 font-bold mb-1">
              {pushResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
              <span>{pushResult.success ? 'Sincronização concluída com sucesso no Supabase!' : 'Sincronização concluída com observações:'}</span>
            </div>
            <div className="flex gap-4 flex-wrap text-xs font-mono">
              {Object.entries(pushResult.stats).map(([k, v]) => (
                <span key={k} className="bg-white/10 px-2 py-0.5 rounded">
                  {k}: {v}
                </span>
              ))}
            </div>
            {pushResult.errors.length > 0 && (
              <ul className="mt-2 list-disc list-inside text-xs text-red-300 space-y-0.5">
                {pushResult.errors.slice(0, 3).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Cartões de Métricas Ao Vivo direto do Supabase */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Usuários (Nuvem)</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{remoteUsers.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">
            {remoteUsers.filter((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG').length} instrutores
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Instituições</span>
            <Building className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{remoteOrgs.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">CFCs e autônomos</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Alunos no Banco</span>
            <GraduationCap className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{remoteStudents.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">Cadastrados no PostgreSQL</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Pacotes de Aulas</span>
            <Package className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{remotePackages.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">Ofertas ativas</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold">Cupons de Desconto</span>
            <Ticket className="w-4 h-4 text-pink-600" />
          </div>
          <div className="text-xl font-black text-slate-900">{remoteCoupons.length}</div>
          <p className="text-xs text-slate-500 mt-0.5">Criados no SaaS</p>
        </div>
      </div>

      {/* Navegação entre Tabelas do Banco */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'USERS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Usuários & Instrutores ({remoteUsers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ORGS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'ORGS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Building className="w-3.5 h-3.5" />
              <span>Organizações ({remoteOrgs.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('STUDENTS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'STUDENTS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Alunos ({remoteStudents.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('PACKAGES')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'PACKAGES'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Pacotes ({remotePackages.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('COUPONS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'COUPONS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Cupons ({remoteCoupons.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar dados da tabela..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-white"
            />
          </div>
        </div>

        {/* Tabela Selecionada */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-purple-600" />
              <span>Consultando registros ao vivo do Supabase...</span>
            </div>
          ) : (
            <>
              {/* TABELA: USUÁRIOS E INSTRUTORES */}
              {activeTab === 'USERS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                      <th className="p-3">Nome / Usuário</th>
                      <th className="p-3">E-mail Cadastrado</th>
                      <th className="p-3">Papel</th>
                      <th className="p-3">Organização ID</th>
                      <th className="p-3">Senha Atual no Banco</th>
                      <th className="p-3">Último Acesso</th>
                      <th className="p-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          Nenhum usuário encontrado na tabela "users" do Supabase.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const org = remoteOrgs.find((o) => o.id === u.organizacaoId);
                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{u.nome}</div>
                              <div className="text-xs font-mono text-slate-400">{u.id}</div>
                            </td>
                            <td className="p-3 font-medium text-slate-700">{u.email}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                                u.papel === 'SUPER_ADMIN'
                                  ? 'bg-purple-100 text-purple-800'
                                  : u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {u.papel}
                              </span>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-slate-800">{org?.nome || u.organizacaoId}</div>
                              <div className="text-xs text-slate-400 font-mono">{u.organizacaoId}</div>
                            </td>
                            <td className="p-3 font-mono text-xs">
                              <span className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-semibold border border-slate-200">
                                {u.senhaTemporaria || '123456 (Padrão)'}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 text-xs">
                              {u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleString('pt-BR') : 'Sem registro'}
                            </td>
                            <td className="p-3 text-right">
                              <button
                                onClick={() => {
                                  setUserToReset(u);
                                  setNewPasswordInput('');
                                  setResetMessage(null);
                                }}
                                className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg font-bold text-xs transition-colors cursor-pointer"
                                title="Redefinir senha diretamente no Supabase"
                              >
                                Alterar Senha
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA: ORGANIZAÇÕES */}
              {activeTab === 'ORGS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                      <th className="p-3">Nome da Instituição</th>
                      <th className="p-3">Tipo</th>
                      <th className="p-3">CNPJ / CPF</th>
                      <th className="p-3">Plano SaaS</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Validade do Plano</th>
                      <th className="p-3">Chave de Acesso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrgs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400">
                          Nenhuma organização encontrada na tabela "organizations" do Supabase.
                        </td>
                      </tr>
                    ) : (
                      filteredOrgs.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{o.nome}</div>
                            <div className="text-xs font-mono text-slate-400">{o.id}</div>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {o.tipo === 'AUTOESCOLA_CFC' ? 'CFC / Autoescola' : 'Instrutor Autônomo'}
                          </td>
                          <td className="p-3 font-mono text-slate-700">{o.cnpjCpf}</td>
                          <td className="p-3">
                            <span className="font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              {o.plano}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${
                              o.status === 'ATIVO'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'PENDENTE_APROVACAO'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-600 font-medium">
                            {o.dataVencimentoPlano || 'Sem vencimento'}
                          </td>
                          <td className="p-3 font-mono text-xs text-slate-600">
                            {o.chaveAcesso ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {o.chaveAcesso}
                              </span>
                            ) : (
                              'Não gerada'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA: ALUNOS */}
              {activeTab === 'STUDENTS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                      <th className="p-3">Nome do Aluno</th>
                      <th className="p-3">CPF</th>
                      <th className="p-3">Instrutor Responsável</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Aulas</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Nenhum aluno encontrado na tabela "students" do Supabase.
                        </td>
                      </tr>
                    ) : (
                      filteredStudents.map((s) => {
                        const instrutor = remoteUsers.find((u) => u.id === s.instrutorId);
                        return (
                          <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-3">
                              <div className="font-bold text-slate-900">{s.nome}</div>
                              <div className="text-xs text-slate-400 font-mono">{s.id}</div>
                            </td>
                            <td className="p-3 font-mono text-slate-700">{s.cpfMascarado}</td>
                            <td className="p-3">
                              <div className="font-semibold text-blue-700">{instrutor?.nome || 'Não vinculado'}</div>
                              <div className="text-xs text-slate-400 font-mono">{s.instrutorId}</div>
                            </td>
                            <td className="p-3 font-bold text-slate-800">Cat. {s.categoriaCnh}</td>
                            <td className="p-3 text-slate-700">
                              {s.aulasCumpridas || 0} / {s.totalAulasContratadas || 20}
                            </td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                                {s.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA: PACOTES */}
              {activeTab === 'PACKAGES' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                      <th className="p-3">Nome do Pacote</th>
                      <th className="p-3">Instrutor</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Qtd. Aulas</th>
                      <th className="p-3">Valor</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPackages.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Nenhum pacote encontrado na tabela "package_offers" do Supabase.
                        </td>
                      </tr>
                    ) : (
                      filteredPackages.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-bold text-slate-900">{p.nome}</div>
                            <div className="text-xs text-slate-400 font-mono">{p.id}</div>
                          </td>
                          <td className="p-3 text-slate-700 font-medium">{p.instrutorNome || p.instrutorId || 'Todos'}</td>
                          <td className="p-3 font-bold">Cat. {p.categoriaCnh}</td>
                          <td className="p-3 text-slate-700">{p.totalAulas} aulas</td>
                          <td className="p-3 font-bold text-emerald-700">{formatCurrencyBRL(p.valorCentavos)}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${p.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {p.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}

              {/* TABELA: CUPONS */}
              {activeTab === 'COUPONS' && (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-xs">
                      <th className="p-3">Código do Cupom</th>
                      <th className="p-3">Escopo</th>
                      <th className="p-3">Tipo de Desconto</th>
                      <th className="p-3">Criado Por</th>
                      <th className="p-3">Usos Realizados</th>
                      <th className="p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredCoupons.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-slate-400">
                          Nenhum cupom encontrado na tabela "discount_coupons" do Supabase.
                        </td>
                      </tr>
                    ) : (
                      filteredCoupons.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3">
                            <div className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block">
                              {c.codigo}
                            </div>
                          </td>
                          <td className="p-3 font-medium text-slate-700">
                            {c.escopo === 'PLATAFORMA' ? 'Planos SaaS do Sistema' : 'Pacotes de Aulas dos Alunos'}
                          </td>
                          <td className="p-3 font-semibold text-slate-800">
                            {c.tipoDesconto === 'PERIODO_GRATIS'
                              ? `${c.mesesGratis || 0} meses de teste grátis`
                              : c.tipoDesconto === 'PERCENTUAL'
                              ? `${c.percentual}% de desconto`
                              : `${formatCurrencyBRL(c.valorCentavos || 0)} de desconto`}
                          </td>
                          <td className="p-3 text-slate-600">{c.criadoPorNome}</td>
                          <td className="p-3 text-slate-700">
                            {c.usosRealizados || 0} / {(c.limiteUsos && c.limiteUsos > 0) ? c.limiteUsos : 'Ilimitado'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${c.ativo ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                              {c.ativo ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal Rápido de Alteração de Senha no Banco */}
      {userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-purple-400" />
                <h3 className="font-bold text-sm">Alterar Senha no Supabase</h3>
              </div>
              <button
                onClick={() => setUserToReset(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmPasswordChange} className="p-5 space-y-4 text-xs">
              <div>
                <p className="text-slate-600 font-medium">
                  Defina a nova senha para o usuário <strong className="text-slate-900">{userToReset.nome}</strong> ({userToReset.email}):
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nova Senha</label>
                <input
                  type="text"
                  required
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none font-mono"
                />
              </div>

              {resetMessage && (
                <div className={`p-3 rounded-xl flex items-center gap-2 ${
                  resetMessage.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  {resetMessage.isError ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                  <span>{resetMessage.text}</span>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setUserToReset(null)}
                  className="flex-1 py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl cursor-pointer shadow-xs"
                >
                  Gravar no Banco
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
