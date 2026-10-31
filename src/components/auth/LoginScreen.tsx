import React, { useState } from 'react';
import {
  Car,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserPlus,
  GraduationCap,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Shield
} from 'lucide-react';
import { db } from '../../lib/storage';
import { User } from '../../types';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';
import { Logo } from '../common/Logo';

interface LoginScreenProps {
  onLoginAttempt: (user: User) => void;
  onOpenInstructorRegister: () => void;
  onOpenStudentRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginAttempt,
  onOpenInstructorRegister,
  onOpenStudentRegister
}) => {
  const [email, setEmail] = useState<string>('cassiordcosta@gmail.com');
  const [password, setPassword] = useState<string>('123456');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState<boolean>(false);
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Por favor, informe seu endereço de e-mail.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const user = db.getUserByEmail(email);

      if (!user) {
        setError('Usuário não encontrado. Verifique o e-mail ou cadastre-se como Instrutor.');
        setLoading(false);
        return;
      }

      setLoading(false);
      onLoginAttempt(user);
    }, 400);
  };

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword('123456');
    const user = db.getUserByEmail(quickEmail);
    if (user) {
      onLoginAttempt(user);
    }
  };

  const handleSelectGoogleAccount = (googleEmail: string) => {
    setLoading(true);
    setShowGoogleModal(false);
    setTimeout(() => {
      const user = db.getUserByEmail(googleEmail);
      setLoading(false);
      if (user) {
        onLoginAttempt(user);
      } else {
        setError(`Conta Google (${googleEmail}) não encontrada no sistema.`);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-radial-[at_top] from-slate-900 via-slate-950 to-slate-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white relative overflow-hidden">
      {/* Decorative Automotive Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-40 right-10 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-4 relative z-10">
        {/* Gestão AD Official Vector Logo */}
        <div className="flex justify-center py-2">
          <Logo theme="dark" size="xl" className="justify-center scale-105" />
        </div>

        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/15 text-blue-300 text-[11px] font-semibold border border-blue-400/20 backdrop-blur-xs">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Plataforma Inteligente para Autoescolas & CFCs</span>
          </span>
          <p className="text-xs text-slate-300 max-w-sm mx-auto mt-2 leading-relaxed">
            Gestão financeira, controle de alunos por categoria, agenda prática sem conflitos e cobranças PIX automatizadas.
          </p>
        </div>
      </div>

      <div className="mt-7 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md py-7 px-6 sm:px-9 shadow-2xl rounded-3xl border border-white/20 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Social / Google Login */}
          <div>
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-300/80 rounded-xl shadow-xs bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition-all cursor-pointer touch-target"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Acessar com Google</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2.5 text-slate-400 font-bold tracking-wider text-[10px]">
                  ou com credenciais
                </span>
              </div>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail de Acesso
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@autoescola.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowPasswordRecovery(true)}
                  className="text-[11px] text-blue-600 hover:text-blue-800 cursor-pointer font-medium hover:underline"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-xl font-bold shadow-md shadow-blue-500/25 text-xs transition-all cursor-pointer touch-target mt-2"
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  <span>Entrar no Gestão AD</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Contas Cadastradas no Sistema */}
          {(() => {
            const registeredUsers = db.getUsers();
            if (registeredUsers.length === 0) return null;
            return (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                  Acesso Rápido — Contas Cadastradas
                </p>
                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto">
                  {registeredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => handleQuickLogin(u.email)}
                      className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-sky-50 hover:border-sky-300 text-left transition-colors cursor-pointer"
                    >
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-900 truncate">{u.nome}</p>
                        <p className="text-[11px] text-sky-700 font-mono truncate">{u.email}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white shrink-0 ml-2">
                        {u.papel === 'SUPER_ADMIN' ? 'Master' : u.papel === 'ALUNO' ? 'Aluno' : 'Instrutor'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Registration Links */}
          <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onOpenInstructorRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              Novo Instrutor
            </button>
            <button
              type="button"
              onClick={onOpenStudentRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              title="Auto-cadastro condicionado à indicação de instrutor"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
              Portal do Aluno
            </button>
          </div>
        </div>

        {/* Footer info & Security Badges */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-[11px] text-slate-400 font-medium">
            Gestão AD (Auto Direção) · Sistema Oficial em Conformidade com CONTRAN e LGPD
          </p>
          <div className="flex items-center justify-center gap-3 text-[10px] text-slate-500 font-mono">
            <span>✓ Criptografia 256-bit</span>
            <span>·</span>
            <span>✓ Cloud Backup</span>
            <span>·</span>
            <span>✓ Multi-CFC</span>
          </div>
        </div>
      </div>

      {/* Password Recovery Modal */}
      {showPasswordRecovery && (
        <PasswordRecoveryModal
          onClose={() => setShowPasswordRecovery(false)}
          onSuccessLogin={(user) => {
            setShowPasswordRecovery(false);
            onLoginAttempt(user);
          }}
        />
      )}

      {/* Google Account Selector Dialog */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <h3 className="font-bold text-slate-900 text-sm">Fazer Login com Google</h3>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <span className="sr-only">Fechar</span>
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Selecione a conta Google para entrar no sistema:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => handleSelectGoogleAccount('cassiordcosta@gmail.com')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-purple-200 bg-purple-50/60 hover:bg-purple-100 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  CC
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">Cássio Costa</p>
                  <p className="text-[11px] text-purple-700 font-mono truncate">cassiordcosta@gmail.com</p>
                  <span className="inline-block mt-0.5 text-[9px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-purple-200 text-purple-900">
                    Administrador Master
                  </span>
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowGoogleModal(false)}
              className="w-full py-2 text-xs font-medium text-slate-500 hover:text-slate-800 text-center"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
