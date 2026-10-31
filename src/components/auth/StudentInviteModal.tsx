import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, Link, Share2, Sparkles, Mail } from 'lucide-react';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { User, Organization } from '../../types';

interface StudentInviteModalProps {
  instructor: User;
  org: Organization;
  onClose: () => void;
  onSimulateOpenInvite: () => void;
}

export const StudentInviteModal: React.FC<StudentInviteModalProps> = ({
  instructor,
  org,
  onClose,
  onSimulateOpenInvite
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [studentPhone, setStudentPhone] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [emailSentNotice, setEmailSentNotice] = useState<boolean>(false);

  const token = `inv_${instructor.id.slice(-6)}_${Date.now().toString(36)}`;
  const referralCode = instructor.id.replace('usr_', '').toUpperCase();
  const inviteUrl = `${window.location.origin}/?convite=${token}&instrutorId=${instructor.id}&instrutor=${encodeURIComponent(instructor.nome)}`;

  const inviteMessage = `Olá${studentName ? `, ${studentName}` : ''}! 🚗💨\n\nAqui é o instrutor *${instructor.nome}* da *${org.nome}*.\n\nPara agilizar a sua matrícula e liberar o seu agendamento de aulas práticas de direção, clique no link abaixo para realizar seu auto-cadastro:\n\n👉 ${inviteUrl}\n\nCódigo de Indicação do Instrutor: ${referralCode}\n\n*(Lembrete: obrigatório ter mais de 18 anos completos e portar documento de identidade / CPF)*. Te aguardo nas aulas!`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendWhatsApp = () => {
    const link = buildWhatsAppLink(studentPhone || '11999999999', inviteMessage);
    window.open(link, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(`Convite de Matrícula - Aulas Práticas com ${instructor.nome}`);
    const body = encodeURIComponent(inviteMessage);
    if (studentEmail) {
      window.location.href = `mailto:${studentEmail}?subject=${subject}&body=${body}`;
    } else {
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
    setEmailSentNotice(true);
    setTimeout(() => setEmailSentNotice(false), 4000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">Link de Convite do Aluno</h2>
              <p className="text-xs text-slate-300">Vinculação direta e obrigatória ao instrutor</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs text-slate-700 overflow-y-auto flex-1">
          {/* Instructor Referral Badge */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-blue-900">Instrutor Responsável</p>
              <p className="text-xs font-semibold text-slate-800">{instructor.nome}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Código</span>
              <span className="font-mono font-extrabold text-blue-700 text-xs px-2 py-0.5 rounded bg-blue-100">
                {referralCode}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Nome do Aluno (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Beatriz Mendes"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="text"
                  placeholder="(11) 98765-4321"
                  value={studentPhone}
                  onChange={(e) => setStudentPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">E-mail do Aluno</label>
                <input
                  type="email"
                  placeholder="aluno@email.com.br"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {emailSentNotice && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-medium">
              ✓ Aplicativo de e-mail aberto para envio do convite ao aluno!
            </div>
          )}

          {/* Link box */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">Link Exclusivo com Vínculo do Instrutor</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteUrl}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono text-[11px] select-all truncate"
              />
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl shrink-0 cursor-pointer transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copiado!' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          {/* Message Preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
              Mensagem Pronta para Envio
            </p>
            <p className="text-[11px] text-slate-600 whitespace-pre-line leading-relaxed font-sans bg-white p-2.5 rounded-lg border border-slate-100">
              {inviteMessage}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
            <button
              onClick={handleSendWhatsApp}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleSendEmail}
              className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              <span>Por E-mail</span>
            </button>
            <button
              onClick={() => {
                onClose();
                onSimulateOpenInvite();
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl font-semibold transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Simular Tela</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
