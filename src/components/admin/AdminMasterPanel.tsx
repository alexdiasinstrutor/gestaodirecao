import React, { useState } from 'react';
import {
  ShieldCheck,
  Building,
  Users,
  GraduationCap,
  TrendingUp,
  Database,
  RefreshCw,
  Search,
  Eye,
  Sliders,
  DollarSign,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  ArrowRightLeft,
  Calendar,
  CheckSquare,
  FileCheck,
  ChevronDown,
  ChevronUp,
  Link2,
  Phone,
  Mail,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Key,
  Layers,
  Sparkles,
  ExternalLink,
  Clock,
  Filter,
  Rocket
} from 'lucide-react';
import { db, CadastrosIntegrityReport } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { getPlanDetails, SAAS_PLANS } from '../../lib/saasPlans';
import { Organization, User, Student, SaaSPlanType, OrganizationStatus } from '../../types';

// Modais Administrativos Modulares
import { OrganizationDetailsModal } from './OrganizationDetailsModal';
import { OrganizationEditModal } from './OrganizationEditModal';
import { OrganizationNewModal } from './OrganizationNewModal';
import { OrganizationAccessKeyModal } from './OrganizationAccessKeyModal';
import { ResetPasswordModal } from './ResetPasswordModal';
import { SaaSPlansTableView } from './SaaSPlansTableView';
import { SupabaseMigrationModal } from './SupabaseMigrationModal';

interface AdminMasterPanelProps {
  currentUser: User;
  onSwitchUser: (email: string) => void;
}

export const AdminMasterPanel: React.FC<AdminMasterPanelProps> = ({ currentUser, onSwitchUser }) => {
  // Dados atualizados dinamicamente
  const [organizations, setOrganizations] = useState<Organization[]>(() => db.getOrganizations());
  const allUsers = db.getUsers();
  const allStudents = db.getStudents(organizations[0]?.id || '');
  const allPayments = db.getPayments(organizations[0]?.id || '');

  const [activeSubTab, setActiveSubTab] = useState<'VERIFICADOR' | 'ORGS' | 'PLANS' | 'MAINTENANCE'>('VERIFICADOR');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [filterPlan, setFilterPlan] = useState<string>('TODOS');
  const [resetSuccess, setResetSuccess] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [expandedInstructorId, setExpandedInstructorId] = useState<string | null>(null);

  // Feedback Messages
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showFeedback = (text: string, type: 'success' | 'error' = 'success') => {
    setFeedbackMsg({ text, type });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const refreshOrganizations = () => {
    setOrganizations(db.getOrganizations());
  };

  // Modais de Organização
  const [selectedOrgForDetails, setSelectedOrgForDetails] = useState<Organization | null>(null);
  const [selectedOrgForEdit, setSelectedOrgForEdit] = useState<Organization | null>(null);
  const [selectedOrgForKey, setSelectedOrgForKey] = useState<Organization | null>(null);
  const [showNewOrgModal, setShowNewOrgModal] = useState<boolean>(false);
  const [selectedUserForResetPass, setSelectedUserForResetPass] = useState<User | null>(null);
  const [showSupabaseModal, setShowSupabaseModal] = useState<boolean>(false);

  // Reassignment Modal state
  const [studentToReassign, setStudentToReassign] = useState<Student | null>(null);
  const [targetInstructorId, setTargetInstructorId] = useState<string>('');
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string>('');

  // Integrity Report
  const [integrityReport, setIntegrityReport] = useState<CadastrosIntegrityReport>(() =>
    db.verifyCadastrosIntegrity(organizations[0]?.id)
  );

  const runIntegrityScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const report = db.verifyCadastrosIntegrity(organizations[0]?.id);
      setIntegrityReport(report);
      setIsScanning(false);
    }, 450);
  };

  const handleReassignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToReassign || !targetInstructorId) return;

    const ok = db.reassignStudentInstructor(studentToReassign.id, targetInstructorId, currentUser.id);
    if (ok) {
      const targetInstructor = allUsers.find((u) => u.id === targetInstructorId);
      setReassignSuccessMsg(
        `Aluno "${studentToReassign.nome}" reatribuído com sucesso para o instrutor "${targetInstructor?.nome || ''}"!`
      );
      setStudentToReassign(null);
      setTargetInstructorId('');
      runIntegrityScan();
      setTimeout(() => setReassignSuccessMsg(''), 4500);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Deseja realmente redefinir o banco de dados para os dados padrão de demonstração?')) {
      db.resetDatabase();
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        window.location.reload();
      }, 1000);
    }
  };

  const handleCleanForProduction = () => {
    if (
      window.confirm(
        'ATENÇÃO: Deseja realmente LIMPAR todos os dados fictícios de teste e preparar o banco para PRODUÇÃO (Go-Live)?\n\n' +
        '✓ Sua conta Master (cassiordcosta@gmail.com) e sua Organização Master serão mantidas intactas com Plano Master.\n' +
        '✓ Todos os alunos, aulas, despesas e pagamentos fictícios de teste serão removidos.\n' +
        '✓ O sistema ficará pronto para cadastrar clientes e alunos reais.'
      )
    ) {
      db.clearDatabaseForProduction();
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        window.location.reload();
      }, 1000);
    }
  };

  // Handlers para Organizações
  const handleSaveEditOrg = (updatedOrg: Organization) => {
    db.updateOrganization(updatedOrg, currentUser.id);
    refreshOrganizations();
    setSelectedOrgForEdit(null);
    showFeedback(`Organização "${updatedOrg.nome}" atualizada com sucesso!`);
  };

  const handleCreateNewOrg = (newOrg: Organization, initialUser?: User) => {
    db.createOrganization(newOrg);
    if (initialUser) {
      db.createUser(initialUser);
    }
    refreshOrganizations();
    setShowNewOrgModal(false);
    showFeedback(`Nova instituição "${newOrg.nome}" cadastrada com sucesso! Chave de Acesso gerada.`);
  };

  const handleDeleteOrg = (org: Organization) => {
    if (window.confirm(`Tem certeza de que deseja EXCLUIR a organização "${org.nome}"? Esta ação removerá os acessos associados.`)) {
      const res = db.deleteOrganization(org.id, currentUser.id);
      if (res.success) {
        refreshOrganizations();
        showFeedback(`Organização "${org.nome}" excluída com sucesso.`);
      } else {
        showFeedback(res.error || 'Erro ao excluir organização.', 'error');
      }
    }
  };

  const handleToggleBlock = (org: Organization) => {
    const isBlocked = org.status === 'BLOQUEADO';
    const newStatus: OrganizationStatus = isBlocked ? 'ATIVO' : 'BLOQUEADO';
    const actionLabel = isBlocked ? 'DESBLOQUEAR' : 'BLOQUEAR';

    if (window.confirm(`Deseja realmente ${actionLabel} a organização "${org.nome}"?`)) {
      const updated: Organization = {
        ...org,
        status: newStatus,
        motivoBloqueio: isBlocked ? undefined : 'Suspensão manual realizada pelo Administrador Master'
      };
      db.updateOrganization(updated, currentUser.id);
      refreshOrganizations();
      showFeedback(`Organização "${org.nome}" agora está com status ${newStatus}.`);
    }
  };

  const handleQuickApprove = (org: Organization) => {
    const res = db.approveOrganizationRegistration({
      orgId: org.id,
      plano: 'BASICO',
      diasValidade: 30,
      actorId: currentUser.id
    });
    if (res.success) {
      refreshOrganizations();
      showFeedback(`Cadastro da instituição "${org.nome}" aprovado com sucesso! Chave de Acesso: ${res.key}`);
    }
  };

  const handleAccessAsOrg = (org: Organization) => {
    // Procura instrutor ou admin daquela organização
    const orgUsers = db.getUsers(org.id);
    const targetUser = orgUsers.find((u) => u.papel === 'INSTRUTOR' || u.papel === 'ADMIN_ORG') || orgUsers[0];

    if (targetUser) {
      onSwitchUser(targetUser.email);
    } else {
      // Se não tiver nenhum usuário ainda, avisa ou cria um instrutor padrão
      alert(`Esta organização não possui usuários cadastrados ainda. Adicione um usuário em "Consultar Ficha".`);
    }
  };

  const instructorsList = allUsers.filter((u) => u.papel === 'ADMIN_ORG' || u.papel === 'INSTRUTOR');
  const pendingOrgs = organizations.filter((o) => o.status === 'PENDENTE_APROVACAO');

  // Filtros de busca
  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.cnpjCpf.includes(searchTerm) ||
      (org.cidade || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === 'TODOS' || org.status === filterStatus;
    const matchesPlan = filterPlan === 'TODOS' || org.plano === filterPlan;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-900 text-white rounded-2xl p-6 shadow-xl border border-purple-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-purple-400 tracking-wider uppercase">
                Console Administrativo Master · Gestão Total
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Ambiente do Administrador Master
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Gestão centralizada da plataforma, assinaturas SaaS, controle de permissões de instituições/CFCs e verificação contínua de integridade.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onSwitchUser('instrutor@autoescola.com')}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Acessar ambiente como Instrutor Carlos Eduardo"
            >
              <Users className="w-4 h-4" />
              Simular Instrutor
            </button>
            <button
              onClick={() => onSwitchUser('aluno@teste.com.br')}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Acessar ambiente como Aluno Pedro"
            >
              <GraduationCap className="w-4 h-4" />
              Simular Aluno
            </button>
          </div>
        </div>
      </div>

      {/* Alertas de Feedback */}
      {feedbackMsg && (
        <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 shadow-xs border ${
          feedbackMsg.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : 'bg-red-50 border-red-300 text-red-800'
        }`}>
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span className="font-semibold">{feedbackMsg.text}</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Banco de dados restaurado com sucesso!</span>
        </div>
      )}

      {reassignSuccessMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{reassignSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('VERIFICADOR')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'VERIFICADOR'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>Verificador de Cadastros & Relações</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px]">
            {integrityReport.score}%
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('ORGS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'ORGS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Instituições & CFCs ({organizations.length})</span>
          {pendingOrgs.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] animate-pulse">
              {pendingOrgs.length} pendente(s)
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('PLANS')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'PLANS'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Planos SaaS & Módulos</span>
        </button>

        <button
          onClick={() => setActiveSubTab('MAINTENANCE')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'MAINTENANCE'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Manutenção & Banco Demo</span>
        </button>

        <button
          onClick={() => setShowSupabaseModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs ml-auto"
          title="Conectar com Supabase, exportar DDL SQL relacional e sincronizar tabelas"
        >
          <Database className="w-4 h-4" />
          <span>Supabase / PostgreSQL</span>
          <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px]">
            SQL
          </span>
        </button>
      </div>

      {/* TAB 1: VERIFICADOR DE INTEGRIDADE */}
      {activeSubTab === 'VERIFICADOR' && (
        <div className="space-y-6">
          {/* Card de Score e Resumo */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-xs ${
                  integrityReport.score >= 90
                    ? 'bg-emerald-600'
                    : integrityReport.score >= 70
                    ? 'bg-amber-500'
                    : 'bg-red-600'
                }`}
              >
                {integrityReport.score}%
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {integrityReport.isAllConsistent
                    ? 'Base de Dados 100% Homologada & Saudável'
                    : 'Atenção: Inconsistências Detectadas na Base'}
                </h3>
                <p className="text-xs text-slate-500">
                  Verificado em: {new Date(integrityReport.timestamp).toLocaleTimeString('pt-BR')} · Total de Alunos: {integrityReport.totalStudents} · Instrutores: {integrityReport.totalInstructors}
                </p>
              </div>
            </div>

            <button
              onClick={runIntegrityScan}
              disabled={isScanning}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Varrendo Banco...' : 'Executar Nova Varredura'}</span>
            </button>
          </div>

          {/* Lista de Instrutores e Alunos Vinculados */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Instrutores Ativos & Carteiras de Alunos Condicionados</span>
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {instructorsList.map((instructor) => {
                const students = db.getStudents(instructor.organizacaoId).filter((s) => s.instrutorId === instructor.id);
                const isExpanded = expandedInstructorId === instructor.id;

                return (
                  <div key={instructor.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedInstructorId(isExpanded ? null : instructor.id)}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm">
                          {instructor.nome.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{instructor.nome}</span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold">
                              {instructor.papel}
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 font-mono">
                            {instructor.email} · Tel: {instructor.telefone || 'S/N'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        <div className="bg-purple-50 px-3 py-1 rounded-lg border border-purple-200 text-right">
                          <span className="text-[10px] text-purple-700 font-semibold block">Alunos Vinculados</span>
                          <span className="font-mono font-black text-sm text-purple-900">{students.length}</span>
                        </div>
                        <button className="text-slate-400 p-1 rounded-lg">
                          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-slate-100 bg-slate-50/50 p-4 space-y-2">
                        {students.length === 0 ? (
                          <p className="text-xs text-slate-500 text-center py-2">Nenhum aluno vinculado a este instrutor.</p>
                        ) : (
                          students.map((student) => (
                            <div key={student.id} className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs">
                              <div>
                                <span className="font-bold text-slate-900">{student.nome}</span>
                                <span className="text-slate-500 font-mono ml-2">CNH {student.categoriaCnh} · CPF: {student.cpfMascarado}</span>
                              </div>
                              <button
                                onClick={() => setStudentToReassign(student)}
                                className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 hover:bg-purple-50 text-slate-700 hover:text-purple-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5 text-purple-600" />
                                <span>Reatribuir</span>
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INSTITUIÇÕES & CFCS (GESTÃO COMPLETA MASTER) */}
      {activeSubTab === 'ORGS' && (
        <div className="space-y-5">
          {/* Alerta de Solicitações Pendentes de Aprovação */}
          {pendingOrgs.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-amber-100/60 p-5 rounded-2xl border-2 border-amber-300 shadow-xs space-y-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
                <h3 className="text-sm font-bold text-amber-900">
                  {pendingOrgs.length} Solicitação(ões) de Cadastro Aguardando Sua Aprovação
                </h3>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                Nenhum novo instrutor ou CFC tem permissão de operar o sistema sem que você autorize e gere a chave de acesso.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {pendingOrgs.map((org) => (
                  <div key={org.id} className="bg-white p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-3 shadow-2xs">
                    <div>
                      <span className="font-bold text-slate-900 text-xs block">{org.nome}</span>
                      <span className="text-[11px] text-slate-500 font-mono block">
                        {org.tipo.replace('_', ' ')} · {org.cidade}/{org.estado} · Tel: {org.telefone}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleQuickApprove(org)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs"
                      >
                        Aprovar & Gerar Chave
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Barra de Filtros e Novo Cadastro */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Instituições e Autoescolas Cadastradas ({filteredOrganizations.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Gestão de planos, vigências, liberação de menus e controle de acesso
                </p>
              </div>

              <button
                onClick={() => setShowNewOrgModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>+ Cadastrar Nova Instituição / CFC</span>
              </button>
            </div>

            {/* Controles de Filtro */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-1">
              <div className="sm:col-span-2 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CNPJ/CPF ou cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none"
                />
              </div>

              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="TODOS">Todos os Status</option>
                  <option value="ATIVO">🟢 Ativos</option>
                  <option value="PENDENTE_APROVACAO">🟡 Pendentes</option>
                  <option value="BLOQUEADO">🔴 Bloqueados</option>
                  <option value="VENCIDO">🟠 Vencidos</option>
                  <option value="TESTE">🔵 Teste</option>
                </select>
              </div>

              <div>
                <select
                  value={filterPlan}
                  onChange={(e) => setFilterPlan(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="TODOS">Todos os Planos</option>
                  <option value="DEMO">Plano DEMO</option>
                  <option value="BASICO">Plano BÁSICO</option>
                  <option value="AVANCADO">Plano AVANÇADO</option>
                  <option value="MASTER">Plano MASTER</option>
                </select>
              </div>
            </div>

            {/* Tabela de Instituições */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Organização / Documento</th>
                    <th className="py-2.5 px-3">Modalidade</th>
                    <th className="py-2.5 px-3">Contato</th>
                    <th className="py-2.5 px-3">Plano SaaS</th>
                    <th className="py-2.5 px-3">Vigência / Chave</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Ações do Master</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredOrganizations.map((org) => {
                    const planInfo = getPlanDetails(org.plano);
                    const isBlocked = org.status === 'BLOQUEADO';
                    const isPending = org.status === 'PENDENTE_APROVACAO';

                    return (
                      <tr key={org.id} className="hover:bg-slate-50/70">
                        {/* Nome e CNPJ */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-900 block">{org.nome}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{org.cnpjCpf}</span>
                        </td>

                        {/* Modalidade */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                            {org.tipo === 'AUTOESCOLA_CFC' ? 'CFC / Autoescola' : 'Instrutor Autônomo'}
                          </span>
                        </td>

                        {/* Contato */}
                        <td className="py-3 px-3 text-[11px]">
                          <span className="text-slate-800 block">{org.cidade} / {org.estado}</span>
                          <span className="text-slate-400 font-mono block">{org.telefone || org.email || 'S/N'}</span>
                        </td>

                        {/* Plano */}
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${planInfo.corBadge}`}>
                            {org.plano}
                          </span>
                          {org.modulosCustomizados && org.modulosCustomizados.length > 0 && (
                            <span className="block text-[9px] text-purple-700 font-medium mt-0.5">
                              {org.modulosCustomizados.length} módulos ativos
                            </span>
                          )}
                        </td>

                        {/* Vigência / Chave */}
                        <td className="py-3 px-3 text-[11px]">
                          <span className="block font-semibold text-slate-800">
                            {org.dataVencimentoPlano ? `Vence: ${formatDateBR(org.dataVencimentoPlano)}` : 'Indeterminado'}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="font-mono text-[10px] text-purple-800 font-bold bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                              {org.chaveAcesso || 'Sem chave'}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            org.status === 'ATIVO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : isPending
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : isBlocked
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {org.status}
                          </span>
                        </td>

                        {/* Ações */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 flex-wrap">
                            {/* Botão Rápido de Aprovação se estiver Pendente */}
                            {isPending && (
                              <button
                                onClick={() => handleQuickApprove(org)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer shadow-xs flex items-center gap-1 transition-all mr-1"
                                title="Aprovar cadastro e gerar chave de acesso imediatamente"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Aprovar</span>
                              </button>
                            )}

                            {/* Consultar Ficha */}
                            <button
                              onClick={() => setSelectedOrgForDetails(org)}
                              className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                              title="Consultar ficha detalhada da instituição"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Editar */}
                            <button
                              onClick={() => setSelectedOrgForEdit(org)}
                              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Editar dados, plano e liberar módulos"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>

                            {/* Chave de Acesso */}
                            <button
                              onClick={() => setSelectedOrgForKey(org)}
                              className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                              title="Gerenciar e enviar chave de acesso via WhatsApp/Email"
                            >
                              <Key className="w-4 h-4" />
                            </button>

                            {/* Bloquear / Desbloquear */}
                            <button
                              onClick={() => handleToggleBlock(org)}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isBlocked
                                  ? 'text-emerald-600 hover:bg-emerald-50'
                                  : 'text-amber-600 hover:bg-amber-50'
                              }`}
                              title={isBlocked ? 'Desbloquear organização' : 'Bloquear / Suspender organização'}
                            >
                              {isBlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                            </button>

                            {/* Acessar Painel */}
                            <button
                              onClick={() => handleAccessAsOrg(org)}
                              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold cursor-pointer"
                              title="Acessar o painel como usuário desta organização"
                            >
                              Acessar
                            </button>

                            {/* Excluir */}
                            <button
                              onClick={() => handleDeleteOrg(org)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir organização"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLANOS SAAS & MÓDULOS */}
      {activeSubTab === 'PLANS' && (
        <SaaSPlansTableView />
      )}

      {/* TAB 4: MANUTENÇÃO */}
      {activeSubTab === 'MAINTENANCE' && (
        <div className="space-y-4">
          {/* Card Go-Live: Produção Limpa */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Rocket className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Ambiente de Produção Oficial · Go-Live
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                Limpar Banco de Dados para Produção (Clientes Reais)
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Remove com segurança todos os alunos fictícios, aulas de teste, parcelas simuladas e despesas de demonstração.
                <strong className="text-emerald-300 block mt-1">
                  ✓ Preserva 100% intacta a sua conta Master (cassiordcosta@gmail.com) e sua Organização com Plano MASTER.
                </strong>
              </p>
            </div>

            <button
              onClick={handleCleanForProduction}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-emerald-900/30 transition-all cursor-pointer shrink-0"
            >
              <Rocket className="w-4 h-4" />
              <span>Limpar e Iniciar Produção</span>
            </button>
          </div>

          {/* Card Supabase & PostgreSQL */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Database className="w-5 h-5" />
                </span>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Banco Relacional Externo · PostgreSQL & Supabase
                </span>
              </div>
              <h3 className="text-base font-bold text-white">
                Exportador & Conector Supabase
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Insira as credenciais do seu projeto Supabase, gere o DDL SQL com todas as 12 tabelas relacionais, chaves estrangeiras e índices, e faça a cópia direta dos dados via API ou Dump SQL.
              </p>
            </div>

            <button
              onClick={() => setShowSupabaseModal(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg hover:shadow-emerald-900/30 transition-all cursor-pointer shrink-0"
            >
              <Database className="w-4 h-4" />
              <span>Abrir Migrador Supabase</span>
            </button>
          </div>

          {/* Card Demo Reset */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-purple-600" />
                Restaurar Dados Simulados de Demonstração
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Utilize esta opção apenas caso queira repovoar a base com dados fictícios de teste (alunos Pedro e Mariana, instrutor Carlos, etc.) para treinamento ou demonstrações.
              </p>
            </div>

            <button
              onClick={handleResetData}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
              Restaurar Dados Demo
            </button>
          </div>
        </div>
      )}

      {/* MODAL: CONSULTA DETALHADA DE INSTITUIÇÃO */}
      {selectedOrgForDetails && (
        <OrganizationDetailsModal
          organization={selectedOrgForDetails}
          onClose={() => setSelectedOrgForDetails(null)}
          onOpenEdit={(org) => {
            setSelectedOrgForDetails(null);
            setSelectedOrgForEdit(org);
          }}
          onOpenKeyModal={(org) => {
            setSelectedOrgForKey(org);
          }}
          onOpenResetPass={(user) => {
            setSelectedUserForResetPass(user);
          }}
        />
      )}

      {/* MODAL: EDITAR INSTITUIÇÃO & PERMISSÕES */}
      {selectedOrgForEdit && (
        <OrganizationEditModal
          organization={selectedOrgForEdit}
          onClose={() => setSelectedOrgForEdit(null)}
          onSave={handleSaveEditOrg}
        />
      )}

      {/* MODAL: NOVA INSTITUIÇÃO */}
      {showNewOrgModal && (
        <OrganizationNewModal
          onClose={() => setShowNewOrgModal(false)}
          onCreate={handleCreateNewOrg}
        />
      )}

      {/* MODAL: CHAVE DE ACESSO & ENVIO */}
      {selectedOrgForKey && (
        <OrganizationAccessKeyModal
          organization={selectedOrgForKey}
          currentUser={currentUser}
          onClose={() => setSelectedOrgForKey(null)}
          onKeyUpdated={() => refreshOrganizations()}
        />
      )}

      {/* MODAL: RESET DE SENHA */}
      {selectedUserForResetPass && (
        <ResetPasswordModal
          targetUser={selectedUserForResetPass}
          actorId={currentUser.id}
          onClose={() => setSelectedUserForResetPass(null)}
          onResetSuccess={(user, tempPass) => {
            showFeedback(`Senha de "${user.nome}" resetada com sucesso! Senha: ${tempPass}`);
          }}
        />
      )}

      {/* MODAL: REATRIBUIÇÃO ADMINISTRATIVA DE ALUNO */}
      {studentToReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Reatribuição Administrativa de Aluno</h3>
              </div>
              <button
                onClick={() => setStudentToReassign(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl text-xs space-y-1">
              <p className="font-bold text-purple-900">Aluno Selecionado:</p>
              <p className="text-slate-800 font-semibold">{studentToReassign.nome}</p>
              <p className="text-[11px] text-slate-600 font-mono">
                CPF: {studentToReassign.cpfMascarado} · CNH {studentToReassign.categoriaCnh}
              </p>
            </div>

            <form onSubmit={handleReassignSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Selecione o Novo Instrutor Responsável *
                </label>
                <select
                  required
                  value={targetInstructorId}
                  onChange={(e) => setTargetInstructorId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none text-xs bg-white"
                >
                  <option value="">Selecione um instrutor credenciado...</option>
                  {instructorsList.map((ins) => (
                    <option key={ins.id} value={ins.id}>
                      {ins.nome} ({ins.email})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  A reatribuição atualizará o vínculo do CPF, as agendas e gravará log de auditoria permanente.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentToReassign(null)}
                  className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!targetInstructorId}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
                >
                  Confirmar Vínculo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTEGRAÇÃO & MIGRADOR SUPABASE */}
      <SupabaseMigrationModal
        isOpen={showSupabaseModal}
        onClose={() => setShowSupabaseModal(false)}
      />
    </div>
  );
};
