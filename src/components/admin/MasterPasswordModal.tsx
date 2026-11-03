import React, { useState } from 'react';
import {
  X,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail
} from 'lucide-react';
import { db } from '../../lib/storage';
import { User } from '../../types';

interface MasterPasswordModalProps {
  user: User;
  currentUser: User;
  onClose: () => void;
  onSuccess: (updatedUser: User, newPass: string) => void;
}

export const MasterPasswordModal: React.FC<MasterPasswordModalProps> = ({
  user,
  currentUser,
  onClose,
  onSuccess
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isSelf = user.id === currentUser.id;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 6) {
      setError('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A confirmação não coincide com a nova senha digitada.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const res = db.changeMasterPassword(user.id, newPassword, currentUser.id);

      if (!res.success) {
        setError(res.message || 'Erro ao atualizar a senha do Administrador Master.');
        setLoading(false);
        return;
      }

      const updatedUser = db.getUserByEmail(user.email) || {
        ...user,
        senhaTemporaria: newPassword
      };

      setLoading(false);
      onSuccess(updatedUser, newPassword);
    }, 350);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-purple-950 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-400/30">
              <KeyRound className="w-5 h-5 text-purple-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                {isSelf ? 'Alterar Minha Senha Master' : 'Alterar Senha do Administrador Master'}
              </h2>
              <p className="text-[11px] text-purple-200/80">
                Segurança de Acesso e Governança do Sistema
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações do Usuário Master */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">
                Usuário Master
              </span>
              <p className="font-bold text-slate-900">{user.nome}</p>
              <p className="text-slate-600 font-mono text-[11px]">{user.email}</p>
            </div>
            <span className="px-2 py-0.5 rounded-md bg-purple-600 text-white text-[10px] font-bold">
              SUPER_ADMIN
            </span>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nova Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nova Senha de Acesso *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full pl-9 pr-10 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  title={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmação de Senha */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Confirmar Nova Senha *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha exatamente"
                  className="w-full pl-9 pr-3 py-2.5 text-xs border border-slate-300 rounded-xl focus:border-purple-600 focus:outline-none bg-slate-50/50 focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Informações de Recuperação e Sincronização */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 text-slate-800 font-semibold">
                <Mail className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>Recuperação e Validação por E-mail</span>
              </div>
              <p className="leading-relaxed">
                Ao salvar, a nova senha entrará em vigor imediatamente tanto no armazenamento local quanto no Supabase PostgreSQL.
                Caso necessário no futuro, você poderá recuperá-la por e-mail com a validação do seu CPF cadastrado.
              </p>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-medium cursor-pointer transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-500/20 cursor-pointer flex items-center gap-1.5"
              >
                {loading ? (
                  <span>Salvando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirmar Nova Senha</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
