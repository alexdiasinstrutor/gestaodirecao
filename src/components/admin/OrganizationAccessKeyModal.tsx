import React, { useState } from 'react';
import {
  X,
  Key,
  Copy,
  Check,
  Send,
  Mail,
  RefreshCw,
  Sparkles,
  Phone
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatDateBR } from '../../lib/validation';
import type { Organization, User } from '../../types';

interface OrganizationAccessKeyModalProps {
  organization: Organization;
  currentUser: User;
  onClose: () => void;
  onKeyUpdated: (newKey: string) => void;
}

export const OrganizationAccessKeyModal: React.FC<OrganizationAccessKeyModalProps> = ({
  organization,
  currentUser,
  onClose,
  onKeyUpdated
}) => {
  const [currentKey, setCurrentKey] = useState<string>(
    organization.chaveAcesso || 'KEY-GERAR-AGORA'
  );
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(currentKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerateKey = () => {
    if (window.confirm(`Deseja gerar uma nova Chave de Acesso para "${organization.nome}"? A anterior será revogada.`)) {
      setIsGenerating(true);
      setTimeout(() => {
        const { key } = db.generateOrganizationAccessKey(organization.id, currentUser.id);
        setCurrentKey(key);
        onKeyUpdated(key);
        setIsGenerating(false);
      }, 300);
    }
  };

  const appUrl = window.location.origin;

  const mensagemWhatsApp = `Olá, ${organization.nome}! 🚗\n\nSeu acesso ao *Sistema de Gestão de Direção* foi liberado com sucesso pelo Administrador Master!\n\n📋 *Plano Contratado:* ${organization.plano}\n🔑 *Sua Chave de Acesso:* *${currentKey}*\n🔗 *Link de Acesso:* ${appUrl}\n\nCaso tenha dúvidas ou precise de suporte, estamos à disposição!`;

  const handleSendWhatsApp = () => {
    const cleanPhone = (organization.telefone || '').replace(/\D/g, '');
    const phoneParam = cleanPhone.length >= 10 ? `55${cleanPhone}` : '';
    const url = `https://wa.me/${phoneParam}?text=${encodeURIComponent(mensagemWhatsApp)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Liberação de Acesso - Sistema de Gestão de Direção (Chave: ${currentKey})`);
    const body = encodeURIComponent(mensagemWhatsApp);
    window.location.href = `mailto:${organization.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-xl">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Chave de Acesso & Envio</h2>
              <p className="text-[11px] text-slate-300">{organization.nome}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-5 sm:p-6 space-y-5 text-xs flex-1 overflow-y-auto">
          {/* Card da Chave em Destaque */}
          <div className="bg-gradient-to-br from-indigo-50 via-purple-50 to-white p-5 rounded-2xl border border-indigo-200 text-center space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">
              Chave de Acesso Oficial do Tenant
            </span>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black font-mono tracking-wider text-slate-900 bg-white px-4 py-2 rounded-xl border border-indigo-300 shadow-xs">
                {currentKey}
              </span>
              <button
                onClick={handleCopy}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl cursor-pointer transition-colors shadow-xs"
                title="Copiar Chave"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {copied ? '✅ Chave copiada com sucesso!' : 'Clique no ícone para copiar para a área de transferência.'}
            </p>
          </div>

          {/* Botão de Regeneração */}
          <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
            <span>
              Gerada em: {organization.chaveAcessoGeradaEm ? formatDateBR(organization.chaveAcessoGeradaEm) : 'Hoje'}
            </span>
            <button
              onClick={handleRegenerateKey}
              disabled={isGenerating}
              className="flex items-center gap-1 text-purple-700 hover:text-purple-900 font-bold underline cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
              <span>Gerar Nova Chave</span>
            </button>
          </div>

          {/* Envio por WhatsApp / E-mail */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <span className="font-bold text-slate-900 uppercase text-[10px] tracking-wider block">
              Encaminhar Credenciais de Acesso ao Usuário
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleSendWhatsApp}
                className="flex items-center justify-center gap-2 p-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Phone className="w-4 h-4" />
                <span>Enviar no WhatsApp</span>
              </button>

              <button
                onClick={handleSendEmail}
                className="flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-colors cursor-pointer shadow-xs"
              >
                <Mail className="w-4 h-4" />
                <span>Enviar por E-mail</span>
              </button>
            </div>
          </div>

          {/* Pré-visualização da Mensagem */}
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1.5 text-[11px]">
            <span className="font-bold text-slate-700 block">Prévia da Mensagem Formatada:</span>
            <pre className="whitespace-pre-wrap font-sans text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
              {mensagemWhatsApp}
            </pre>
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl text-xs cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
