import React, { useState } from 'react';
import {
  X,
  Mail,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  ArrowRight,
  RefreshCw,
  Send,
  Sparkles
} from 'lucide-react';
import { db } from '../../lib/storage';
import { isValidCPF, maskCPF } from '../../lib/validation';
import { User } from '../../types';

interface PasswordRecoveryModalProps {
  onClose: () => void;
  onSuccessLogin?: (user: User) => void;
}

export const PasswordRecoveryModal: React.FC<PasswordRecoveryModalProps> = ({
  onClose,
  onSuccessLogin
}) => {
  const [step, setStep] = useState<'VALIDATE' | 'CODE' | 'SUCCESS'>('VALIDATE');
  const [email, setEmail] = useState<string>('cassiordcosta@gmail.com');
  const [cpf, setCpf] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState<string>('');
  const [sentCode, setSentCode] = useState<string>('');
  const [validatedUser, setValidatedUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [resendNotice, setResendNotice] = useState<string>('');

  const handleCpfChange = (val: string) => {
    // Only numbers
    const clean = val.replace(/\D/g, '').slice(0, 11);
    if (clean.length <= 11) {
      // Apply mask: 000.000.000-00
      let formatted = clean;
      if (clean.length > 9) {
        formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
      } else if (clean.length > 6) {
        formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
      } else if (clean.length > 3) {
        formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
      }
      setCpf(formatted);
    }
  };

  const handleValidateIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Por favor, informe o e-mail de cadastro.');
      return;
    }

    if (!cpf.trim()) {
      setError('Por favor, informe o CPF cadastrado.');
      return;
    }

    if (!isValidCPF(cpf)) {
      setError('O CPF digitado é matematicamente inválido. Verifique os números informados.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const res = db.validateUserForPasswordRecovery(email, cpf);
      setLoading(false);

      if (!res.success || !res.user || !res.code) {
        setError(
          res.message ||
            'Dados não conferem. Por segurança e conformidade LGPD, a recuperação exige a validação estrita do CPF e do e-mail cadastrado.'
        );
        return;
      }

      setValidatedUser(res.user);
      setSentCode(res.code);
      setVerificationCode(res.code); // Pre-fill for demonstration ease
      setStep('CODE');
    }, 500);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!verificationCode.trim()) {
      setError('Por favor, insira o código de 6 dígitos recebido por e-mail.');
      return;
    }

    if (verificationCode.trim() !== sentCode.trim()) {
      setError('Código de verificação incorreto. Verifique o código enviado para seu e-mail.');
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    if (!validatedUser) {
      setError('Sessão expirada. Reinicie o processo.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      db.updateUserPassword(validatedUser.id, newPassword);
      setLoading(false);
      setStep('SUCCESS');
    }, 400);
  };

  const handleResendCode = () => {
    if (!validatedUser) return;
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSentCode(newCode);
    setVerificationCode(newCode);
    setResendNotice('Novo código reenviado com sucesso para seu e-mail!');
    setTimeout(() => setResendNotice(''), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Recuperação Segura de Senha</h2>
              <p className="text-xs text-slate-300">Confirmação estrita por CPF e E-mail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: VALIDATE CPF & EMAIL */}
          {step === 'VALIDATE' && (
            <form onSubmit={handleValidateIdentity} className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Protocolo de Segurança e Proteção LGPD</span>
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  Para proteger o acesso ao sistema, a recuperação de senha exige a conferência simultânea do
                  <strong> e-mail de cadastro</strong> e do <strong>CPF obrigatório</strong> do usuário.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  E-mail de Cadastro *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cassiordcosta@gmail.com"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Administrador: <span className="font-mono text-blue-600">cassiordcosta@gmail.com</span>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  CPF do Usuário (Obrigatório) *
                </label>
                <input
                  type="text"
                  required
                  value={cpf}
                  onChange={(e) => handleCpfChange(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Dica para teste do Administrador Master: <span className="font-mono text-blue-600 font-bold">111.222.333-00</span>
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer touch-target"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Validando Dados e Gerando Token...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Verificar e Enviar Código por E-mail</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: ENTER CODE & NEW PASSWORD */}
          {step === 'CODE' && validatedUser && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              {/* Email dispatch preview card */}
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>E-mail de Recuperação Disparado!</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">
                    Expira em 15 min
                  </span>
                </div>
                <div className="text-[11px] text-emerald-800 space-y-1 bg-white p-2.5 rounded-lg border border-emerald-100 font-mono">
                  <p><span className="text-slate-400">Destinatário:</span> {validatedUser.email}</p>
                  <p><span className="text-slate-400">Usuário:</span> {validatedUser.nome}</p>
                  <p><span className="text-slate-400">Código de 6 Dígitos:</span> <strong className="text-emerald-700 text-sm tracking-wider">{sentCode}</strong></p>
                </div>
              </div>

              {resendNotice && (
                <div className="p-2 bg-blue-50 border border-blue-200 text-blue-800 text-[11px] rounded-lg text-center font-medium">
                  {resendNotice}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Código de Verificação de 6 Dígitos *
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="Ex: 481920"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none font-mono text-center text-sm font-bold tracking-widest"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nova Senha (Mínimo 6 dígitos) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Confirme a Nova Senha *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="px-3 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-medium transition-colors cursor-pointer"
                >
                  Reenviar Código
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                >
                  {loading ? (
                    'Atualizando Senha...'
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Salvar Nova Senha</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: SUCCESS */}
          {step === 'SUCCESS' && validatedUser && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Senha Redefinida com Sucesso!
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  A conta <span className="font-mono font-bold text-slate-800">{validatedUser.email}</span> foi atualizada no banco de dados e está pronta para acesso.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                {onSuccessLogin && (
                  <button
                    onClick={() => {
                      onClose();
                      onSuccessLogin(validatedUser);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Entrar no Sistema Diretamente</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="w-full py-2 px-4 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Voltar para Tela de Login
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
