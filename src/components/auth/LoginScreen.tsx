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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3">
        {/* Brand Icon */}
        <div className="inline-flex p-3.5 bg-gradient-to-tr from-blue-600 to-sky-400 rounded-2xl shadow-xl shadow-blue-500/20 text-white">
          <Car className="w-10 h-10" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Sistema de Administração de Gestão de Direção
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-sm mx-auto">
          Gestão financeira integrada, controle de alunos, agenda prática sem conflitos e cobranças via WhatsApp.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-200 space-y-6">
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
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-slate-300 rounded-xl shadow-xs bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer touch-target"
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
              <span>Continuar com Google</span>
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider text-[10px]">
                  Ou acesse com e-mail e senha
                </span>
              </div>
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail Cadastrado
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@autoescola.com.br"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
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
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-[11px] text-slate-600 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Autenticação protegida por 2FA rigoroso via SMS/E-mail.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs text-xs transition-colors cursor-pointer touch-target"
            >
              {loading ? (
                'Autenticando...'
              ) : (
                <>
                  Entrar no Sistema
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick profile shortcuts for Instant Testing */}
          <div className="pt-4 border-t border-slate-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 text-center">
              Acesso Rápido para Testes & Demonstração
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('cassiordcosta@gmail.com')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-purple-200 bg-purple-50/50 hover:bg-purple-100 hover:border-purple-300 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Cássio Costa (Administrador Master)</p>
                  <p className="text-[11px] text-purple-700 font-mono font-medium">cassiordcosta@gmail.com</p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-600 text-white shadow-2xs">
                  Super Admin Master
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('instrutor@autoescola.com')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Instrutor (Carlos Eduardo)</p>
                  <p className="text-[11px] text-slate-500 font-mono">instrutor@autoescola.com</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                  Instrutor A
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('roberto@autoescola.com')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 hover:border-indigo-300 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Instrutor (Roberto Vasconcelos)</p>
                  <p className="text-[11px] text-slate-500 font-mono">roberto@autoescola.com</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  Instrutor B
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('aluno@teste.com.br')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-left transition-colors cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Aluno Padrão de Teste</p>
                  <p className="text-[11px] text-slate-500 font-mono">aluno@teste.com.br</p>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  Portal do Aluno
                </span>
              </button>
            </div>
          </div>

          {/* Registration Links */}
          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onOpenInstructorRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 text-blue-600" />
              Novo Instrutor
            </button>
            <button
              type="button"
              onClick={onOpenStudentRegister}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 border border-slate-300 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              title="Auto-cadastro condicionado à indicação de instrutor"
            >
              <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
              Auto-Cadastro Aluno
            </button>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11px] text-slate-400">
          Auto Gestão de Direção · Em conformidade com a LGPD e Normas CONTRAN
        </p>
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

              <button
                onClick={() => handleSelectGoogleAccount('instrutor@autoescola.com')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  CE
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">Carlos Eduardo</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">instrutor@autoescola.com</p>
                  <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-blue-100 text-blue-800">
                    Instrutor Credenciado
                  </span>
                </div>
              </button>

              <button
                onClick={() => handleSelectGoogleAccount('roberto@autoescola.com')}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-indigo-50 text-left transition-colors cursor-pointer"
              >
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                  RV
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 truncate">Roberto Vasconcelos</p>
                  <p className="text-[11px] text-slate-500 font-mono truncate">roberto@autoescola.com</p>
                  <span className="inline-block mt-0.5 text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800">
                    Instrutor Credenciado
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
