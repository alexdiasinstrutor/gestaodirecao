import React, { useState } from 'react';
import {
  Car,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  LogOut,
  UserCheck,
  Shield,
  GraduationCap,
  ChevronDown
} from 'lucide-react';
import { User, Organization } from '../../types';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface HeaderProps {
  currentUser: User | null;
  currentOrg?: Organization;
  onLogout: () => void;
  onSwitchUser: (email: string) => void;
  onOpenLGPD: () => void;
  onOpenDossieAndAgents?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  currentOrg,
  onLogout,
  onSwitchUser,
  onOpenLGPD,
  onOpenDossieAndAgents
}) => {
  const { isOnline, isSyncing, pendingCount, triggerSync } = useOnlineStatus();
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState<boolean>(false);
  const [showSwitchMenu, setShowSwitchMenu] = useState<boolean>(false);

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return { label: 'Admin Master', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'ADMIN_ORG':
      case 'INSTRUTOR':
        return { label: 'Instrutor / CFC', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      case 'ALUNO':
        return { label: 'Área do Aluno', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      default:
        return { label: 'Visitante', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    }
  };

  const roleInfo = getRoleLabel(currentUser?.papel);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo & App Title - Mobile responsive */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/30 text-white shrink-0">
              <Car className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-extrabold text-xs sm:text-base md:text-lg tracking-tight text-white leading-tight truncate block">
                  Gestão de Direção
                </span>
                <span className="hidden lg:inline-block text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 shrink-0">
                  Sistema de Administração
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate max-w-xs mt-0.5">
                {currentOrg?.nome || 'Plataforma para Instrutores e CFCs'}
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Dossiê & Agentes de Segurança Button - EXCLUSIVO DO ADMINISTRADOR MASTER */}
            {onOpenDossieAndAgents && (currentUser?.papel === 'SUPER_ADMIN' || currentUser?.email === 'cassiordcosta@gmail.com') && (
              <button
                type="button"
                onClick={onOpenDossieAndAgents}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-2.5 sm:py-1.5 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0"
                title="Dossiê Técnico e Agentes de Segurança (Acesso Exclusivo do Administrador)"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] sm:text-xs">Dossiê</span>
                <span className="hidden md:inline text-[11px] sm:text-xs">& Validação</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              </button>
            )}

            {/* Online / Offline Sync Badge */}
            <div className="flex items-center shrink-0">
              {isOnline ? (
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 text-[10px] sm:text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="hidden md:inline font-medium">Online</span>
                  {pendingCount > 0 && (
                    <button
                      onClick={triggerSync}
                      disabled={isSyncing}
                      className="ml-0.5 px-1.5 py-0.5 rounded bg-emerald-700/60 hover:bg-emerald-600 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                      title="Sincronizar dados pendentes com a nuvem"
                    >
                      <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span className="hidden sm:inline">Sync</span> ({pendingCount})
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-amber-950/70 border border-amber-600/50 text-amber-300 text-[10px] sm:text-xs font-medium">
                  <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Offline</span>
                  {pendingCount > 0 && (
                    <span className="px-1 py-0.5 rounded bg-amber-800 text-[10px] font-mono">
                      {pendingCount}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* PWA Install Button */}
            {!isInstalled && isInstallable && (
              <button
                onClick={install}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer touch-target"
                title="Instalar aplicativo no Android / Computador"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar App
              </button>
            )}

            {!isInstalled && isIOS && (
              <button
                onClick={() => setShowIOSModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Instalar no iOS
              </button>
            )}

            {/* LGPD & Compliance Button */}
            <button
              onClick={onOpenLGPD}
              className="p-1.5 sm:p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="LGPD e Proteção de Dados"
              aria-label="LGPD e Proteção de Dados"
            >
              <Shield className="w-4 h-4" />
            </button>

            {/* User Profile & Quick Switch Menu */}
            {currentUser && (
              <div className="relative">
                <button
                  onClick={() => setShowSwitchMenu(!showSwitchMenu)}
                  className="flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-left transition-colors cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase">
                    {currentUser.nome.charAt(0)}
                  </div>
                  <div className="hidden md:block">
                    <p className="text-xs font-semibold text-white leading-tight truncate max-w-[120px]">
                      {currentUser.nome.split(' ')[0]}
                    </p>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      {roleInfo.label}
                    </span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {showSwitchMenu && (
                  <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-xl border border-slate-200 py-2 text-slate-800 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs text-slate-500 font-medium">Conectado como</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{currentUser.nome}</p>
                      <p className="text-xs text-slate-500 font-mono truncate">{currentUser.email}</p>
                      <div className="mt-1 inline-block">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </div>

                    {/* Quick Profile Switching for Testing / RBAC Demonstration */}
                    <div className="px-2 py-1.5 border-b border-slate-100">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        Alternar Perfil Rápido (Demonstração)
                      </p>
                      <button
                        onClick={() => {
                          onSwitchUser('instrutor@autoescola.com');
                          setShowSwitchMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                        <span>Instrutor (Carlos Eduardo)</span>
                      </button>
                      <button
                        onClick={() => {
                          onSwitchUser('aluno@teste.com.br');
                          setShowSwitchMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                      >
                        <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Aluno Teste (Pedro Henrique)</span>
                      </button>
                      <button
                        onClick={() => {
                          onSwitchUser('admin@sistema.com.br');
                          setShowSwitchMenu(false);
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-slate-100 flex items-center gap-2 text-slate-700 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-600" />
                        <span>Super Admin Master</span>
                      </button>
                    </div>

                    <div className="px-2 pt-1">
                      <button
                        onClick={() => {
                          setShowSwitchMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sair do Sistema</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* iOS Install Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white text-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900">Como instalar no iPhone/iPad</h3>
            <div className="mt-3 text-xs text-slate-600 space-y-2">
              <p>1. Toque no botão de <strong>Compartilhar</strong> (ícone com quadrado e seta para cima) na barra do Safari.</p>
              <p>2. Role a lista e selecione <strong>Adicionar à Tela de Início</strong>.</p>
              <p>3. Toque em <strong>Adicionar</strong> no canto superior direito.</p>
            </div>
            <button
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full bg-slate-900 text-white text-xs font-semibold py-2.5 rounded-xl hover:bg-slate-800"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
