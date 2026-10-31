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
  HeartPulse
} from 'lucide-react';
import { db, initDatabase } from './lib/storage';
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
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { canAccessModule } from './lib/saasPlans';

export default function App() {
  // Initialize storage & seeds on mount
  useEffect(() => {
    initDatabase();
  }, []);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    initDatabase();
    return db.getCurrentUser();
  });

  const [currentOrg, setCurrentOrg] = useState<Organization | undefined>(() => {
    initDatabase();
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

  const { isOnline, isSyncing, pendingCount, triggerSync } = useOnlineStatus();

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

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 pb-20 md:pb-6 print:pb-0 print:bg-white">
      {/* Top Header */}
      <div className="no-print">
        <Header
          currentUser={currentUser}
          currentOrg={currentOrg}
          onLogout={handleLogout}
          onSwitchUser={handleSwitchUser}
          onOpenLGPD={() => setShowLGPDModal(true)}
          onOpenDossieAndAgents={() => setShowSecurityAgentsModal(true)}
        />
      </div>

      {/* Offline / Sync Alert Banner */}
      {!isOnline && (
        <div className="no-print bg-amber-500 text-amber-950 px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              Você está trabalhando offline. Os dados estão sendo salvos localmente e serão sincronizados automaticamente assim que a conexão retornar.
            </span>
          </div>
          {pendingCount > 0 && (
            <span className="bg-amber-600 text-white px-2 py-0.5 rounded text-[10px] font-mono">
              {pendingCount} operação(ões) na fila
            </span>
          )}
        </div>
      )}

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 flex-1 w-full print:p-0 print:m-0 print:max-w-none">
        {/* Navigation Bar for Instructors and Admins - Desktop / Tablet only (Mobile uses bottom nav) */}
        {!isStudent && (
          <div className="no-print hidden md:block mb-4 sm:mb-6">
            <nav className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-x-auto scrollbar-none">
              {[
                { id: 'DASHBOARD', label: 'Painel Geral', icon: LayoutDashboard, moduleId: 'DASHBOARD' },
                { id: 'FINANCE', label: 'Finanças & DRE', icon: DollarSign, moduleId: 'FINANCE_RECEIVABLES' },
                { id: 'FINANCIAL_HEALTH', label: 'Saúde Financeira', icon: HeartPulse, moduleId: 'FINANCIAL_HEALTH' },
                { id: 'STUDENTS', label: 'Alunos & Progresso', icon: Users, moduleId: 'STUDENTS' },
                { id: 'SCHEDULE', label: 'Agenda & Horários', icon: Calendar, moduleId: 'SCHEDULE' },
                { id: 'WHATSAPP', label: 'Cobrança WhatsApp', icon: MessageSquare, moduleId: 'WHATSAPP' },
                { id: 'REPORTS', label: 'Relatórios Automáticos', icon: FileText, moduleId: 'REPORTS' },
                ...(isSuperAdmin ? [{ id: 'ADMIN', label: 'Console Master', icon: Shield, moduleId: 'ADMIN' }] : [])
              ]
                .filter((item) => item.id === 'ADMIN' || canAccessModule(currentOrg, item.moduleId, currentUser))
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer touch-target ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </nav>
          </div>
        )}

        {/* Content based on Role & Active Tab */}
        {isStudent ? (
          <StudentPortal currentUser={currentUser} currentOrg={currentOrg!} />
        ) : (
          <>
            {activeTab === 'DASHBOARD' && (
              <InstructorDashboard
                currentUser={currentUser}
                currentOrg={currentOrg!}
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenInvite={() => setShowStudentInviteModal(true)}
                onOpenNewStudent={() => setShowStudentSelfRegisterModal(true)}
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
              />
            )}
          </>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (WCAG AA Touch Target compliant with overflow protection) */}
      {!isStudent && (
        <nav aria-label="Navegação Principal Móvel" className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-1.5 py-1 flex items-center justify-between shadow-lg overflow-x-auto no-scrollbar">
          {[
            { id: 'DASHBOARD', label: 'Início', icon: LayoutDashboard, moduleId: 'DASHBOARD' },
            { id: 'FINANCE', label: 'Finanças', icon: DollarSign, moduleId: 'FINANCE_RECEIVABLES' },
            { id: 'FINANCIAL_HEALTH', label: 'Saúde', icon: HeartPulse, moduleId: 'FINANCIAL_HEALTH' },
            { id: 'STUDENTS', label: 'Alunos', icon: Users, moduleId: 'STUDENTS' },
            { id: 'SCHEDULE', label: 'Agenda', icon: Calendar, moduleId: 'SCHEDULE' },
            { id: 'WHATSAPP', label: 'Cobrar', icon: MessageSquare, moduleId: 'WHATSAPP' },
            { id: 'REPORTS', label: 'Relatórios', icon: FileText, moduleId: 'REPORTS' },
            ...(isSuperAdmin ? [{ id: 'ADMIN', label: 'Master', icon: Shield, moduleId: 'ADMIN' }] : [])
          ]
            .filter((item) => item.id === 'ADMIN' || canAccessModule(currentOrg, item.moduleId, currentUser))
            .map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex-1 min-w-[44px] flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    isActive ? 'text-blue-600 font-extrabold bg-blue-50/60' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className={`w-4 h-4 mb-0.5 shrink-0 ${isActive ? 'text-blue-600 scale-110' : 'text-slate-500'}`} />
                  <span className="text-[10px] whitespace-nowrap leading-tight">{item.label}</span>
                </button>
              );
            })}

          {(isSuperAdmin || currentUser?.email === 'cassiordcosta@gmail.com') && (
            <button
              onClick={() => setShowSecurityAgentsModal(true)}
              className="flex-1 min-w-[44px] flex flex-col items-center justify-center py-1.5 px-0.5 rounded-lg text-[10px] font-bold text-emerald-600 transition-all cursor-pointer hover:bg-emerald-50/60"
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
    </div>
  );
}
