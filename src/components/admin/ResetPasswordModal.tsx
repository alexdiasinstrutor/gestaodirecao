import React, { useState } from 'react';
import {
  X,
  Lock,
  Copy,
  Check,
  Send,
  Phone,
  Mail,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { db } from '../../lib/storage';
import type { User } from '../../types';

interface ResetPasswordModalProps {
  targetUser: User;
  actorId: string;
  onClose: () => void;
  onResetSuccess: (user: User, tempPass: string) => void;
}

export const ResetPasswordModal: React.FC<ResetPasswordModalProps> = ({
  targetUser,
  actorId,
  onClose,
  onResetSuccess
}) => {
  const [newTempPass, setNewTempPass] = useState<string>(targetUser.senhaTemporaria || '');
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);

  const handleGenerateReset = () => {
    const res = db.resetUserPasswordByMaster(targetUser.id, actorId);
    if (res.success) {
      setNewTempPass(res.newTempPass);
      setSuccessMsg(true);
      onResetSuccess(targetUser, res.newTempPass);
      setTimeout(() => setSuccessMsg(false), 3000);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(newTempPass);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mensagemWhatsApp = `Olá, ${targetUser.nome}! 🔑\n\nSua senha de acesso ao *Sistema de Gestão de Direção* foi redefinida pelo Administrador Master.\n\n📧 *Seu E-mail de Login:* ${targetUser.email}\n🔒 *Nova Senha Temporária:* *${newTempPass}*\n🔗 *Link do Sistema:* ${window.location.origin}\n\nRecomendamos alterar sua senha após o primeiro acesso!`;

  const handleSendWhatsApp = () => {
    const cleanPhone = (targetUser.telefone || '').replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? `55${cleanPhone}` : '';
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(mensagemWhatsApp)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Nova Senha de Acesso - Sistema de Gestão de Direção`);
    const body = encodeURIComponent(mensagemWhatsApp);
    window.location.href = `mailto:${targetUser.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Reset de Senha de Usuário</h2>
              <p className="text-[11px] text-slate-300">{targetUser.nome} ({targetUser.email})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto">
          <p className="text-slate-600">
            Como Administrador Master, você pode gerar uma nova senha temporária para este instrutor ou gestor e encaminhá-la diretamente.
          </p>

          {!newTempPass ? (
            <div className="text-center py-4 space-y-3">
              <button
                type="button"
                onClick={handleGenerateReset}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl cursor-pointer text-xs shadow-xs"
              >
                Gerar Nova Senha Temporária
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl text-center space-y-2">
                <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                  Nova Senha Temporária Gerada
                </span>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-xl font-black bg-white px-3 py-1.5 rounded-xl border border-amber-300 text-slate-900 tracking-wider shadow-2xs">
                    {newTempPass}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="p-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer transition-colors"
                    title="Copiar Senha"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-amber-900">
                  {copied ? '✅ Senha copiada!' : 'Copie ou envie abaixo pelos canais de contato.'}
                </p>
              </div>

              {/* Botões de envio */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleSendWhatsApp}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer text-xs"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Enviar WhatsApp</span>
                </button>
                <button
                  onClick={handleSendEmail}
                  className="flex items-center justify-center gap-1.5 p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold cursor-pointer text-xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Enviar E-mail</span>
                </button>
              </div>

              <div className="text-center pt-2">
                <button
                  onClick={handleGenerateReset}
                  className="text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Gerar outra senha diferente
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs cursor-pointer"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
