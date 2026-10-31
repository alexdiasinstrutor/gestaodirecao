import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Smartphone, Mail, ArrowRight, RefreshCw, X } from 'lucide-react';
import { User } from '../../types';

interface TwoFactorModalProps {
  user: User;
  onSuccess: () => void;
  onCancel: () => void;
}

export const TwoFactorModal: React.FC<TwoFactorModalProps> = ({ user, onSuccess, onCancel }) => {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [timer, setTimer] = useState<number>(55);
  const [error, setError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [codeDispatched, setCodeDispatched] = useState<boolean>(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Generate 6 digit code on mount
  useEffect(() => {
    generateAndSendCode();
  }, []);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const generateAndSendCode = () => {
    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(newCode);
    setCode(['', '', '', '', '', '']);
    setTimer(60);
    setError('');
    setCodeDispatched(true);
    // Focus first input
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 100);
  };

  const handleInputChange = (index: number, val: string) => {
    const digit = val.slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError('');

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto verify when all 6 digits entered
    if (digit && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        verifyCode(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verifyCode = (fullEnteredCode?: string) => {
    const currentCode = fullEnteredCode || code.join('');
    if (currentCode.length !== 6) {
      setError('Por favor, informe os 6 dígitos do código de segurança.');
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      if (currentCode === generatedCode) {
        onSuccess();
      } else {
        setError('Código de verificação incorreto ou expirado. Tente novamente.');
      }
    }, 400);
  };

  const handleFillCodeDemo = () => {
    const digits = generatedCode.split('');
    setCode(digits);
    verifyCode(generatedCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-6 shrink-0">
          <button
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1 rounded-lg"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Autenticação Rigorosa 2FA</h2>
              <p className="text-xs text-slate-300">Verificação em duas etapas de segurança</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4 text-xs text-slate-700 space-y-1 sm:space-y-2">
            <p className="font-semibold text-blue-900 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Código de uso único enviado com sucesso</span>
            </p>
            <p className="text-slate-600">
              Enviamos um token numérico via SMS para seu número celular cadastrado{' '}
              <strong className="text-slate-900">{user.telefone || '(11) 9****-1199'}</strong> e para o e-mail{' '}
              <strong className="text-slate-900">{user.email}</strong>.
            </p>
          </div>

          {/* Demo helper alert to test with zero friction */}
          <div className="flex items-center justify-between p-3 bg-slate-100 rounded-xl border border-slate-200">
            <div className="text-xs text-slate-600">
              Token simulado:{' '}
              <span className="font-mono font-bold text-blue-700 tracking-wider text-sm">
                {generatedCode}
              </span>
            </div>
            <button
              type="button"
              onClick={handleFillCodeDemo}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Autopreencher
            </button>
          </div>

          {/* 6 Digit Inputs */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2 text-center">
              Digite o código de 6 dígitos recebido:
            </label>
            <div className="flex justify-center gap-1.5 sm:gap-2.5 max-w-full">
              {code.map((digit, idx) => (
                <input
                  key={idx}
                  ref={(el) => { inputRefs.current[idx] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(idx, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(idx, e)}
                  className="w-9 h-11 sm:w-11 sm:h-13 text-center text-lg sm:text-xl font-bold font-mono border-2 border-slate-300 rounded-xl focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                  aria-label={`Dígito ${idx + 1}`}
                />
              ))}
            </div>
            {error && (
              <p className="mt-2 text-xs text-red-600 text-center font-medium animate-shake">
                {error}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => verifyCode()}
              disabled={isVerifying || code.join('').length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 px-4 rounded-xl shadow-sm transition-colors text-sm touch-target"
            >
              {isVerifying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Verificando credenciais...
                </>
              ) : (
                <>
                  Confirmar e Entrar
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>
                {timer > 0 ? (
                  `Reenviar código em ${timer}s`
                ) : (
                  <button
                    type="button"
                    onClick={generateAndSendCode}
                    className="text-blue-600 hover:text-blue-800 font-semibold underline cursor-pointer"
                  >
                    Reenviar novo código via SMS
                  </button>
                )}
              </span>
              <button
                type="button"
                onClick={onCancel}
                className="text-slate-500 hover:text-slate-800"
              >
                Cancelar acesso
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
