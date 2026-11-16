import { createPortal } from 'react-dom';
import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, Link, Share2, Sparkles, Mail, Ticket, AlertCircle } from 'lucide-react';
import { buildWhatsAppLink } from '../../lib/whatsapp';
import { db } from '../../lib/storage';
import { describeCoupon } from '../../lib/coupons';
import { maskPhoneInput, cleanPhoneDigits, isValidPhone } from '../../lib/validation';
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const fieldId = useId();
  const [copyError, setCopyError] = useState('');
  const [token] = useState(() => `inv_${instructor.id.slice(-6)}_${Date.now().toString(36)}`);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLButtonElement>('[aria-label="Fechar convite"]')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(el => el.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [onClose]);
  const [copied, setCopied] = useState<boolean>(false);
  const [studentPhone, setStudentPhone] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [emailSentNotice, setEmailSentNotice] = useState<boolean>(false);

  // Cupons do instrutor para vincular opcionalmente ao convite
  const instructorCoupons = db
    .getCoupons({ escopo: 'ALUNO', instrutorId: instructor.id })
    .filter((c) => c.ativo);

  const [selectedCouponCode, setSelectedCouponCode] = useState<string>('');

  const referralCode = instructor.id.replace('usr_', '').toUpperCase();

  const couponParam = selectedCouponCode ? `&cupom=${encodeURIComponent(selectedCouponCode)}` : '';
  const inviteUrl = `${window.location.origin}/?convite=${token}&instrutorId=${instructor.id}&instrutor=${encodeURIComponent(instructor.nome)}${couponParam}`;

  const couponBonusText = selectedCouponCode
    ? `\n🎁 *Cupom de Desconto Especial Incluso:* Use o código *${selectedCouponCode}* para garantir seu desconto!`
    : '';

  const inviteMessage = `Olá${studentName ? `, ${studentName}` : ''}! 🚗💨\n\nAqui é o instrutor *${instructor.nome}* da *${org.nome}*.\n\nPara agilizar a sua matrícula e liberar o seu agendamento de aulas práticas de direção, clique no link abaixo para realizar seu auto-cadastro:\n\n👉 ${inviteUrl}\n\nCódigo de Indicação do Instrutor: *${referralCode}*${couponBonusText}\n\n*(Lembrete: obrigatório ter mais de 18 anos completos e portar documento de identidade / CPF)*. Te aguardo nas aulas!`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyError(''); setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { setCopyError('Não foi possível copiar. Selecione o link ou a mensagem e copie manualmente.'); }
  };
  const handleCopyLink = () => copy(inviteUrl);
  const handleCopyMessage = () => copy(inviteMessage);

  const handleSendWhatsApp = () => {
    const digits = cleanPhoneDigits(studentPhone);
    if (!digits) {
      setPhoneError('O número de telefone WhatsApp é obrigatório para enviar o convite.');
      return;
    }
    if (digits.length < 10) {
      setPhoneError('Informe o telefone completo com DDD (mínimo 10 ou 11 dígitos, ex: (11) 98765-4321).');
      return;
    }
    if (!isValidPhone(digits)) {
      setPhoneError('DDD ou número inválido. Informe um telefone brasileiro válido com DDD (11 a 99).');
      return;
    }

    setPhoneError('');
    // Extrai estritamente os dígitos numéricos (nunca passa caracteres de máscara para o link)
    const link = buildWhatsAppLink(digits, inviteMessage);
    if (!link) {
      setPhoneError('Não foi possível gerar o link do WhatsApp para este número.');
      return;
    }
    window.open(link, '_blank');
  };

  const handleSendEmail = () => {
    if (studentEmail && !emailRef.current?.checkValidity()) { emailRef.current?.reportValidity(); return; }
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

  return createPortal(
    <div className="invite-overlay fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`} className="invite-dialog bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 id={`${fieldId}-title`} className="text-base sm:text-lg font-bold text-white">Link de Convite do Aluno</h2>
              <p className="text-xs text-slate-300">Vinculação direta por link ou código de indicação</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar convite" className="text-slate-300 hover:text-white min-h-11 min-w-11 flex items-center justify-center rounded-lg cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="invite-scroll p-4 sm:p-5 space-y-4 text-sm text-slate-700 min-h-0 min-w-0 flex-1" tabIndex={0} role="region" aria-label="Dados e mensagem do convite">
          {/* Instructor Referral Badge */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex flex-wrap items-start justify-between gap-3 min-w-0">
            <div>
              <p className="text-xs font-bold text-blue-900">Instrutor Responsável</p>
              <p className="text-xs font-semibold text-slate-800">{instructor.nome}</p>
            </div>
            <div className="sm:text-right min-w-0">
              <span className="text-xs uppercase font-bold font-bold text-slate-400 block">Código para o Aluno</span>
              <span className="font-mono font-extrabold text-blue-700 text-xs px-2.5 py-1 rounded bg-blue-100 border border-blue-200 inline-block break-all max-w-full">
                {referralCode}
              </span>
            </div>
          </div>

          {/* Opção de incluir cupom de desconto junto ao convite */}
          {instructorCoupons.length > 0 && (
            <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-purple-900 text-xs">
                <Ticket className="w-3.5 h-3.5 text-purple-600" />
                <span>Incluir Cupom de Desconto no Convite? (Opcional)</span>
              </div>
              <label htmlFor={`${fieldId}-coupon`} className="sr-only">Cupom de desconto do convite</label>
              <select aria-label="Cupom de desconto do convite"
                id={`${fieldId}-coupon`}
                value={selectedCouponCode}
                onChange={(e) => setSelectedCouponCode(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-purple-200 rounded-xl text-xs font-medium focus:outline-none focus:border-purple-600"
              >
                <option value="">Nenhum cupom (Valor padrão do pacote)</option>
                {instructorCoupons.map((c) => (
                  <option key={c.id} value={c.codigo}>
                    {c.codigo} — {describeCoupon(c)}
                  </option>
                ))}
              </select>
              {selectedCouponCode && (
                <p className="text-xs text-purple-700 font-semibold">
                  ✓ O código do cupom será injetado no link e na mensagem para aplicação automática.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor={`${fieldId}-name`} className="block font-medium text-slate-700 mb-1">Nome do Aluno (Opcional)</label>
              <input aria-label="Nome do Aluno (Opcional)"
                type="text"
                id={`${fieldId}-name`} placeholder="Ex: Beatriz Mendes"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="invite-contact-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor={`${fieldId}-phone`} className="font-semibold text-slate-700 mb-1 flex items-center justify-between gap-2">
                  <span>WhatsApp do Aluno *</span>
                  <span className="whitespace-nowrap shrink-0 text-[10px] uppercase font-bold text-red-600 bg-red-50 px-1.5 py-0.2 rounded">Obrigatório</span>
                </label>
                <input aria-label="Telefone WhatsApp do Aluno * Obrigatório"
                  type="text"
                  required
                  id={`${fieldId}-phone`} inputMode="tel" aria-invalid={!!phoneError} aria-describedby={phoneError ? `${fieldId}-phone-error` : undefined} placeholder="(11) 98765-4321"
                  value={studentPhone}
                  onChange={(e) => {
                    setStudentPhone(maskPhoneInput(e.target.value));
                    if (phoneError) setPhoneError('');
                  }}
                  maxLength={15}
                  className={`w-full px-3 py-2 border rounded-xl focus:outline-none font-mono text-xs ${
                    phoneError
                      ? 'border-red-500 bg-red-50/40 focus:border-red-600 ring-2 ring-red-200'
                      : 'border-slate-300 focus:border-blue-600'
                  }`}
                />
                {phoneError && (
                  <p id={`${fieldId}-phone-error`} role="alert" className="text-xs font-semibold text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{phoneError}</span>
                  </p>
                )}
              </div>

              <div>
                <label htmlFor={`${fieldId}-email`} className="block font-medium text-slate-700 mb-1">E-mail do Aluno (Opcional)</label>
                <input aria-label="E-mail do Aluno (Opcional)"
                  ref={emailRef} id={`${fieldId}-email`} type="email"
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
            <label htmlFor={`${fieldId}-link`} className="block font-medium text-slate-700 mb-1">Link Exclusivo com Vínculo do Instrutor</label>
            <div className="flex items-center gap-2">
              <input aria-label="Link Exclusivo com Vínculo do Instrutor"
                type="text"
                readOnly
                id={`${fieldId}-link`}
                value={inviteUrl}
                className="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono text-xs select-all truncate"
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
            <p data-testid="invite-message" tabIndex={0} role="region" aria-label="Mensagem pronta para envio" className="invite-message text-sm text-slate-600 whitespace-pre-wrap [overflow-wrap:anywhere] leading-relaxed font-sans bg-white p-3 rounded-lg border border-slate-100">
              {inviteMessage}
            </p>
          </div>

          {copyError && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-amber-900">{copyError}</p>}
        </div>
        <footer className="shrink-0 border-t border-slate-200 bg-white p-3 sm:px-5">
          <p className="text-xs text-slate-500 mb-3">Enviar convite ao aluno</p>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleSendWhatsApp}
              className="flex flex-wrap items-center justify-center gap-1.5 px-2 py-2.5 min-h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm"
            >
              <Send className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={handleSendEmail}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm"
            >
              <Mail className="w-4 h-4" />
              <span>E-mail</span>
            </button>
            <button
              onClick={handleCopyMessage}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-sm"
            >
              <Copy className="w-4 h-4" />
              <span>Copiar Texto</span>
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
};
