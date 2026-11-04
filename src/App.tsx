import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  DollarSign,
  Users,
  Calendar,
  MessageSquare,
  FileText,
  Shield,
  WifiOff,
  RefreshCw,
  LogOut,
  HeartPulse,
  Smartphone,
  Tablet,
  Monitor,
  LayoutGrid,
  Minimize2
} from 'lucide-react';
import { db, initDatabase, syncFromSupabase } from './lib/storage';
import { User, Organization } from './types';
import { Header } from './components/common/Header';
import { TwoFactorModal } from './components/common/TwoFactorModal';
import { AuditLogViewer } from './components/common/AuditLogViewer';
import { LoginScreen } from './components/auth/LoginScreen';
import { InstructorRegisterModal } from './components/auth/InstructorRegisterModal';
import { StudentInviteModal } from './components/auth/StudentInviteModal';
import { StudentSelfRegisterModal } from './components/auth/StudentSelfRegisterModal';
import { InstructorDashboard } from './components/instructor/InstructorDashboard';
import { FinanceView } from './components/instructor/FinanceView';
import { FinancialHealthView } from './components/instructor/FinancialHealthView';
import { StudentsView } from './components/instructor/StudentsView';
import { ScheduleView } from './components/instructor/ScheduleView';
import { WhatsAppRemindersView } from './components/instructor/WhatsAppRemindersView';
import { ReportsView } from './components/instructor/ReportsView';
import { StudentPortal } from './components/student/StudentPortal';
import { AdminMasterPanel } from './components/admin/AdminMasterPanel';
import { SecurityAgentsModal } from './components/common/SecurityAgentsModal';
import { PixConfigModal } from './components/common/PixConfigModal';
import { SmartScrollNav } from './components/common/SmartScrollNav';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useInterfaceMode } from './hooks/useInterfaceMode';
import { canAccessModule } from './lib/saasPlans';

export default function App() {
  // Initialize storage & seeds on mount, then hydrate from Supabase (sem login automático)
  useEffect(() => {
    initDatabase();
    db.setCurrentUser(null);
    syncFromSupabase().then(() => {
      // Atualiza apenas os dados da organização padrão após sincronizar, mantendo a exigência de login manual
      setCurrentOrg(db.getOrganizations()[0]);
    });
  }, []);

  // Sempre exige autenticação manual por e-mail e senha ao abrir a plataforma (sem entrada automática do Master)
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [currentOrg, setCurrentOrg] = useState<Organization | undefined>(() => {
    const user = db.getCurrentUser();
    return user ? db.getOrganization(user.organizacaoId) : db.getOrganizations()[0];
  });

  // Active navigation tab for Instructors
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');

  // 2FA pending state
  const [pending2FAUser, setPending2FAUser] = useState<User | null>(null);

  // Modals
  const [showInstructorRegisterModal, setShowInstructorRegisterModal] = useState<boolean>(false);
  const [showStudentSelfRegisterModal, setShowStudentSelfRegisterModal] = useState<boolean>(false);
  const [showStudentInviteModal, setShowStudentInviteModal] = useState<boolean>(false);
  const [showLGPDModal, setShowLGPDModal] = useState<boolean>(false);
  const [showSecurityAgentsModal, setShowSecurityAgentsModal] = useState<boolean>(false);
  const [showPixConfigModal, setShowPixConfigModal] = useState<boolean>(false);

  const { isOnline, isSyncing, pendingCount, triggerSync } = useOnlineStatus();
  const {
    deviceType,
    deviceLabel,
    isSimplified,
    setViewMode,
    toggleViewMode
  } = useInterfaceMode();

  // Handle Login attempt (triggers strict 2FA)
  const handleLoginAttempt = (user: User) => {
    if (user.twoFactorAtivo) {
      setPending2FAUser(user);
    } else {
      finalizeLogin(user);
    }
  };

  const finalizeLogin = (user: User) => {
    db.setCurrentUser(user);
    setCurrentUser(user);
    const org = db.getOrganization(user.organizacaoId);
    setCurrentOrg(org);
    setPending2FAUser(null);
    if (user.papel === 'SUPER_ADMIN' || user.email === 'cassiordcosta@gmail.com') {
      setActiveTab('ADMIN');
    } else {
      setActiveTab('DASHBOARD');
    }
  };

  const handleLogout = () => {
    db.setCurrentUser(null);
    setCurrentUser(null);
    setPending2FAUser(null);
  };

  const handleSwitchUser = (email: string) => {
    const user = db.getUserByEmail(email);
    if (user) {
      finalizeLogin(user);
    }
  };

  // If no user is logged in, show Login Screen
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900">
        <LoginScreen
          onLoginAttempt={handleLoginAttempt}
          onOpenInstructorRegister={() => setShowInstructorRegisterModal(true)}
          onOpenStudentRegister={() => setShowStudentSelfRegisterModal(true)}
        />

        {/* 2FA Verification Modal */}
        {pending2FAUser && (
          <TwoFactorModal
            user={pending2FAUser}
            onSuccess={() => finalizeLogin(pending2FAUser)}
            onCancel={() => setPending2FAUser(null)}
          />
        )}

        {/* Self-registration Modals */}
        {showInstructorRegisterModal && (
          <InstructorRegisterModal
            onClose={() => setShowInstructorRegisterModal(false)}
            onRegistered={(user) => {
              setShowInstructorRegisterModal(false);
              finalizeLogin(user);
            }}
          />
        )}

        {showStudentSelfRegisterModal && (
          <StudentSelfRegisterModal
            onClose={() => setShowStudentSelfRegisterModal(false)}
            onRegistered={(student, user) => {
              setShowStudentSelfRegisterModal(false);
              finalizeLogin(user);
            }}
          />
        )}
      </div>
    );
  }

  const isStudent = currentUser.papel === 'ALUNO';
  const isSuperAdmin = currentUser.papel === 'SUPER_ADMIN' || currentUser.email === 'cassiordcosta@gmail.com';

  const DeviceIcon =
    deviceType === 'MOBILE'
      ? Smartphone
      : deviceType === 'TABLET'
      ? Tablet
      : Monitor;

  // Definição dos itens de navegação com flag essential para Modo Mobile Simplificado
  const allNavItems = [
    { id: 'DASHBOARD', label: 'Painel Geral', shortLabel: 'Início', icon: LayoutDashboard, moduleId: 'DASHBOARD', essential: true },
    { id: 'SCHEDULE', label: 'Agenda & Horários', shortLabel: 'Agenda', icon: Calendar, moduleId: 'SCHEDULE', essential: true },
    { id: 'STUDENTS', label: 'Alunos & Progresso', shortLabel: 'Alunos', icon: Users, moduleId: 'STUDENTS', essential: true },
    { id: 'WHATSAPP', label: 'Cobrança & PIX', shortLabel: 'Cobrar/PIX', icon: MessageSquare, moduleId: 'WHATSAPP', essential: true },
    { id: 'FINANCE', label: 'Finanças & DRE', shortLabel: 'Finanças', icon: DollarSign, moduleId: 'FINANCE_RECEIVABLES', essential: false },
    { id: 'FINANCIAL_HEALTH', label: 'Saúde Financeira', shortLabel: 'Saúde', icon: HeartPulse, moduleId: 'FINANCIAL_HEALTH', essential: false },
    { id: 'REPORTS', label: 'Relatórios Automáticos', shortLabel: 'Relatórios', icon: FileText, moduleId: 'REPORTS', essential: false },
    ...(isSuperAdmin ? [{ id: 'ADMIN', label: 'Console Master', shortLabel: 'Master', icon: Shield, moduleId: 'ADMIN', essential: true }] : [])
  ].filter((item) => item.id === 'ADMIN' || canAccessModule(currentOrg, item.moduleId, currentUser));

  const visibleNavItems = isSimplified
    ? allNavItems.filter((item) => item.essential || item.id === activeTab)
    : allNavItems;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 pb-24 md:pb-6 print:pb-0 print:bg-white overflow-x-hidden">
      {/* Top Header */}
      <div className="no-print">
        <Header
          currentUser={currentUser}
          currentOrg={currentOrg}
          onLogout={handleLogout}
          onSwitchUser={handleSwitchUser}
          onOpenLGPD={() => setShowLGPDModal(true)}
          onOpenDossieAndAgents={() => setShowSecurityAgentsModal(true)}
          onOpenPixConfig={() => setShowPixConfigModal(true)}
          onNavigate={(tab) => setActiveTab(tab)}
        />
      </div>

      {/* Offline / Sync Alert Banner */}
      {!isOnline && (
        <div className="no-print bg-amber-500 text-amber-950 px-3 sm:px-4 py-2 text-xs font-semibold flex flex-wrap items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Modo Offline ativo. Dados salvos localmente e sincronizados automaticamente ao reconectar.
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] font-mono shrink-0">
              {pendingCount} na fila
            </span>
          )}
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 py-3 sm:py-5 flex-1 w-full print:p-0 print:m-0 print:max-w-none">
        {/* Adaptive Interface Mode Bar (Identifies Mobile / Tablet / Desktop & Switches Simplified vs Full Mode) */}
        <div className="no-print mb-3 sm:mb-4 bg-white rounded-2xl border border-slate-200/90 px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold shrink-0">
              <DeviceIcon className="w-3.5 h-3.5 text-blue-600" />
              <span>Interface: {deviceLabel}</span>
            </span>
            <span className="text-[11px] text-slate-600 truncate">
              {isSimplified
                ? 'Modo Simplificado (Recursos Essenciais)'
                : 'Modo Normal Completo (Todos os Menus Visíveis)'}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              onClick={() => setViewMode('SIMPLIFIED')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                isSimplified
                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Exibir apenas os recursos essenciais para operação rápida em campo"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Modo Mobile</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('FULL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                !isSimplified
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Liberar todos os menus, relatórios, DRE e painéis avançados"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Modo Normal (Todos os Menus)</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar for Instructors and Admins - Always accessible in Full Mode or on Tablet/Desktop */}
        {!isStudent && (
          <div className={`no-print mb-3.5 sm:mb-5 ${isSimplified ? 'hidden md:block' : 'block'}`}>
            <SmartScrollNav
              ariaLabel="Menu de Navegação Principal"
              className="flex items-center lg:justify-between gap-1 xl:gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs"
            >
              {visibleNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={`flex items-center justify-center lg:flex-1 gap-1.5 px-2.5 xl:px-3 py-2 sm:py-2.5 rounded-xl text-[11px] xl:text-xs font-bold transition-all whitespace-nowrap cursor-pointer touch-target shrink-0 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 xl:w-4 xl:h-4 shrink-0 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              {isSimplified && (
                <button
                  type="button"
                  onClick={() => setViewMode('FULL')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 transition-all whitespace-nowrap cursor-pointer touch-target shrink-0 ml-auto"
                >
                  <LayoutGrid className="w-3.5 h-3.5 text-sky-600" />
                  <span>+ Todos os Menus (Modo Normal)</span>
                </button>
              )}
            </SmartScrollNav>
          </div>
        )}

        {/* Content based on Role & Active Tab */}
        {isStudent ? (
          <StudentPortal
            currentUser={currentUser}
            currentOrg={currentOrg!}
            isSimplified={isSimplified}
            onSwitchToFullMode={() => setViewMode('FULL')}
          />
        ) : (
          <>
            {activeTab === 'DASHBOARD' && (
              <InstructorDashboard
                currentUser={currentUser}
                currentOrg={currentOrg!}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenInvite={() => setShowStudentInviteModal(true)}
                onOpenNewStudent={() => setShowStudentSelfRegisterModal(true)}
                onOpenPixConfig={() => setShowPixConfigModal(true)}
                isSimplified={isSimplified}
                onSwitchToFullMode={() => setViewMode('FULL')}
              />
            )}

            {activeTab === 'FINANCE' && (
              <FinanceView
                currentOrg={currentOrg!}
                currentUser={currentUser}
                onNavigateToFinancialHealth={() => setActiveTab('FINANCIAL_HEALTH')}
              />
            )}

            {activeTab === 'FINANCIAL_HEALTH' && (
              <FinancialHealthView
                currentOrg={currentOrg!}
                currentUser={currentUser}
                onNavigateToFinanceTab={() => setActiveTab('FINANCE')}
                onNavigateTab={(tab) => setActiveTab(tab)}
              />
            )}

            {activeTab === 'STUDENTS' && (
              <StudentsView
                currentOrg={currentOrg!}
                currentUser={currentUser}
                onOpenNewStudent={() => setShowStudentSelfRegisterModal(true)}
                onOpenInvite={() => setShowStudentInviteModal(true)}
              />
            )}

            {activeTab === 'SCHEDULE' && (
              <ScheduleView currentOrg={currentOrg!} currentUser={currentUser} />
            )}

            {activeTab === 'WHATSAPP' && (
              <WhatsAppRemindersView currentOrg={currentOrg!} currentUser={currentUser} />
            )}

            {activeTab === 'REPORTS' && (
              <ReportsView currentOrg={currentOrg!} currentUser={currentUser} />
            )}

            {activeTab === 'ADMIN' && (
              <AdminMasterPanel
                currentUser={currentUser}
                onSwitchUser={handleSwitchUser}
                onUserUpdated={(updated) => setCurrentUser(updated)}
                isSimplified={isSimplified}
                onSwitchToFullMode={() => setViewMode('FULL')}
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (WCAG AA Touch Target compliant with overflow protection) */}
      {!isStudent && (
        <nav
          aria-label="Navegação Principal Móvel"
          className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1 pb-safe flex items-center justify-between gap-0.5 shadow-lg overflow-x-auto no-scrollbar"
        >
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-1 min-w-[54px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'text-blue-600 font-extrabold bg-blue-50/80'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 mb-0.5 shrink-0 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-500'}`} />
                <span className="text-[10px] whitespace-nowrap leading-tight">{item.shortLabel}</span>
              </button>
            );
          })}

          {/* Botão direto na barra inferior para expandir o Modo Normal quando simplificado */}
          {isSimplified ? (
            <button
              type="button"
              onClick={() => setViewMode('FULL')}
              className="flex-1 min-w-[60px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold text-sky-700 bg-sky-50/80 border border-sky-200/80 transition-all cursor-pointer shrink-0"
              title="Exibir todos os menus do Modo Normal"
            >
              <LayoutGrid className="w-4 h-4 mb-0.5 shrink-0 text-sky-600" />
              <span className="text-[10px] whitespace-nowrap leading-tight">+ Menus</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setViewMode('SIMPLIFIED')}
              className="flex-1 min-w-[56px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold text-slate-600 bg-slate-100/80 transition-all cursor-pointer shrink-0"
              title="Voltar para o Modo Mobile Simplificado"
            >
              <Minimize2 className="w-4 h-4 mb-0.5 shrink-0 text-slate-600" />
              <span className="text-[10px] whitespace-nowrap leading-tight">Simplificar</span>
            </button>
          )}

          {(isSuperAdmin || currentUser?.email === 'cassiordcosta@gmail.com') && !isSimplified && (
            <button
              onClick={() => setShowSecurityAgentsModal(true)}
              className="flex-1 min-w-[50px] flex flex-col items-center justify-center py-1.5 px-1 rounded-xl text-[10px] font-bold text-emerald-600 transition-all cursor-pointer hover:bg-emerald-50/60 shrink-0"
              title="Dossiê Técnico e Agentes (Exclusivo Administrador Master)"
            >
              <Shield className="w-4 h-4 mb-0.5 shrink-0 text-emerald-600" />
              <span className="text-[10px] whitespace-nowrap leading-tight text-emerald-700">Dossiê</span>
            </button>
          )}
        </nav>
      )}

      {/* Modals */}
      {showInstructorRegisterModal && (
        <InstructorRegisterModal
          onClose={() => setShowInstructorRegisterModal(false)}
          onRegistered={(user) => {
            setShowInstructorRegisterModal(false);
            finalizeLogin(user);
          }}
        />
      )}

      {showStudentSelfRegisterModal && (
        <StudentSelfRegisterModal
          onClose={() => setShowStudentSelfRegisterModal(false)}
          defaultInstructorId={currentUser.id}
          defaultOrgId={currentOrg?.id}
          onRegistered={(student, user) => {
            setShowStudentSelfRegisterModal(false);
            // Refresh view
            setActiveTab('STUDENTS');
          }}
        />
      )}

      {showStudentInviteModal && currentOrg && (
        <StudentInviteModal
          instructor={currentUser}
          org={currentOrg}
          onClose={() => setShowStudentInviteModal(false)}
          onSimulateOpenInvite={() => setShowStudentSelfRegisterModal(true)}
        />
      )}

      {showLGPDModal && currentOrg && (
        <AuditLogViewer
          orgId={currentOrg.id}
          onClose={() => setShowLGPDModal(false)}
        />
      )}

      {showSecurityAgentsModal && (
        <SecurityAgentsModal
          isOpen={showSecurityAgentsModal}
          onClose={() => setShowSecurityAgentsModal(false)}
          currentUserNome={currentUser.nome}
        />
      )}

      {showPixConfigModal && (
        <PixConfigModal
          org={currentOrg}
          user={currentUser}
          onClose={() => setShowPixConfigModal(false)}
          onSaved={() => {
            setShowPixConfigModal(false);
            if (currentUser) {
              const u = db.getCurrentUser();
              if (u) setCurrentUser({ ...u });
            }
            if (currentOrg) {
              const o = db.getOrganization(currentOrg.id);
              if (o) setCurrentOrg({ ...o });
            }
          }}
        />
      )}
    </div>
  );
}
