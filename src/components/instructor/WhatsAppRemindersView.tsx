import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  QrCode,
  Sparkles,
  Phone,
  Calendar,
  History,
  CheckCircle2,
  Settings,
  Edit3,
  KeyRound,
  Eye,
  RefreshCw
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generateWhatsAppMessage, buildWhatsAppLink, generatePixCopiaECola } from '../../lib/whatsapp';
import { PixConfigModal } from '../common/PixConfigModal';
import { PixQrCodeModal } from '../common/PixQrCodeModal';
import type { Organization, User, AccountReceivable, WhatsAppReminderLog } from '../../types';

interface WhatsAppRemindersViewProps {
  currentOrg: Organization;
  currentUser: User;
}

export const WhatsAppRemindersView: React.FC<WhatsAppRemindersViewProps> = ({
  currentOrg,
  currentUser
}) => {
  const orgId = currentOrg.id;
  const accounts = db.getAccountsReceivable(orgId);
  const students = db.getStudents(orgId);
  const sentLogs = db.getWhatsAppLogs(orgId);

  const [messageTone, setMessageTone] = useState<'GENTIL' | 'PADRAO' | 'URGENTE'>('PADRAO');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Modals state
  const [showPixConfigModal, setShowPixConfigModal] = useState<boolean>(false);
  const [selectedAccountForQrModal, setSelectedAccountForQrModal] = useState<AccountReceivable | null>(null);

  // Custom edited message state per account id: { [accountId]: customText }
  const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  // Effective PIX configuration (User profile takes precedence, then Organization, then fallback)
  const [pixConfig, setPixConfig] = useState(() => db.getEffectivePixConfig(currentOrg, currentUser));

  const refreshPixConfig = () => {
    const updatedUser = db.getUserByEmail(currentUser.email) || currentUser;
    const updatedOrg = db.getOrganization(currentOrg.id) || currentOrg;
    setPixConfig(db.getEffectivePixConfig(updatedOrg, updatedUser));
  };

  // Filter overdue accounts
  const overdueAccounts = accounts.filter(
    (a) => a.status === 'VENCIDO' || (a.status === 'PARCIAL' && new Date(a.dataVencimento) < new Date())
  );

  // Helper to compute active message for an account
  const getAccountMessage = (acc: AccountReceivable): string => {
    if (customMessages[acc.id] !== undefined) {
      return customMessages[acc.id];
    }
    const student = students.find((s) => s.id === acc.alunoId);
    if (!student) return '';

    return generateWhatsAppMessage({
      alunoNome: student.nome,
      telefone: student.telefone,
      valorCentavos: acc.saldoDevedorCentavos,
      dataVencimento: acc.dataVencimento,
      chavePix: pixConfig.chavePix,
      nomeInstrutorOuAutoescola: pixConfig.beneficiarioPix || currentOrg.nome,
      tipoMensagem: messageTone
    });
  };

  const handleCopyMessage = (acc: AccountReceivable) => {
    const message = getAccountMessage(acc);
    if (!message) return;

    navigator.clipboard.writeText(message);
    setCopiedId(acc.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendWhatsApp = (acc: AccountReceivable) => {
    const student = students.find((s) => s.id === acc.alunoId);
    if (!student) return;

    const message = getAccountMessage(acc);

    // Log the reminder in system
    const log: WhatsAppReminderLog = {
      id: `wpp_${Date.now()}`,
      organizacaoId: orgId,
      alunoId: student.id,
      alunoNome: student.nome,
      telefone: student.telefone,
      valorCentavos: acc.saldoDevedorCentavos,
      dataVencimento: acc.dataVencimento,
      mensagem: message,
      enviadoEm: new Date().toISOString(),
      status: 'ENVIADO'
    };

    db.logWhatsAppReminder(log);

    // Open WhatsApp Web / App
    const url = buildWhatsAppLink(student.telefone, message);
    window.open(url, '_blank');

    setSuccessNotice(`Lembrete disparado para ${student.nome} via WhatsApp!`);
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  const handleResetCustomMessage = (accId: string) => {
    const updated = { ...customMessages };
    delete updated[accId];
    setCustomMessages(updated);
    setEditingAccountId(null);
  };

  const studentForQrModal = selectedAccountForQrModal
    ? students.find((s) => s.id === selectedAccountForQrModal.alunoId)
    : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-900/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold text-emerald-400 tracking-wider uppercase">
                Automação de Cobranças
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
              Lembretes de Cobrança via WhatsApp & PIX
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Dispare lembretes com mensagens totalmente editáveis, chave PIX configurável e geração de QR Code oficial.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/10 text-right">
            <span className="text-[11px] text-emerald-300 font-medium block">Total em Atraso</span>
            <span className="text-xl font-mono font-bold text-white">
              {formatCurrencyBRL(overdueAccounts.reduce((a, b) => a + b.saldoDevedorCentavos, 0))}
            </span>
            <span className="text-[11px] text-slate-300 block">{overdueAccounts.length} cobrança(s) pendente(s)</span>
          </div>
        </div>
      </div>

      {successNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successNotice}</span>
        </div>
      )}

      {/* PIX RECEIVING SETTINGS BAR (CRITICAL) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 border border-emerald-300">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900">Chave PIX de Recebimento Ativa:</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase bg-emerald-100 text-emerald-800">
                {pixConfig.tipoChavePix}
              </span>
              <span className="text-[10px] text-slate-400">
                ({pixConfig.origem === 'INSTRUTOR' ? 'Chave do Instrutor' : pixConfig.origem === 'ORGANIZACAO' ? 'Chave da Autoescola' : 'Padrão'})
              </span>
            </div>
            <p className="text-sm font-mono font-extrabold text-emerald-700 mt-0.5">
              {pixConfig.chavePix}
            </p>
            <p className="text-[11px] text-slate-500">
              Titular: <strong>{pixConfig.beneficiarioPix}</strong> · Cidade: <strong>{pixConfig.cidadePix}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPixConfigModal(true)}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Settings className="w-4 h-4" />
          <span>Editar Chave PIX</span>
        </button>
      </div>

      {/* Tone of Voice Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-900">
            Modelo Padrão de Mensagem de Cobrança:
          </label>
          <span className="text-[11px] text-slate-500">
            💡 Você pode clicar em <strong>"Editar Mensagem"</strong> em qualquer aluno para customizar o texto livremente.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => setMessageTone('GENTIL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${messageTone === 'GENTIL'
                ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50'
              }`}
          >
            <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>🚗</span> Lembrete Gentil
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Tom amigável e descontraído para atrasos recentes de até 5 dias.
            </p>
          </button>

          <button
            onClick={() => setMessageTone('PADRAO')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${messageTone === 'PADRAO'
                ? 'border-blue-600 bg-blue-50/70 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50'
              }`}
          >
            <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>📄</span> Padrão Comercial
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Mensagem profissional, educada e direta com dados da fatura e PIX.
            </p>
          </button>

          <button
            onClick={() => setMessageTone('URGENTE')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${messageTone === 'URGENTE'
                ? 'border-amber-600 bg-amber-50/70 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50'
              }`}
          >
            <p className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
              <span>⚠️</span> Notificação Formal
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Aviso formal para atrasos maiores com menção ao bloqueio de agenda.
            </p>
          </button>
        </div>
      </div>

      {/* Overdue List */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-900">
          Alunos com Faturas em Atraso ({overdueAccounts.length})
        </h2>

        {overdueAccounts.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">Nenhum aluno em atraso no momento!</h3>
            <p className="text-xs text-slate-500">
              Todas as parcelas e contratos de aulas práticas estão em dia.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {overdueAccounts.map((acc) => {
              const student = students.find((s) => s.id === acc.alunoId);
              const currentMessage = getAccountMessage(acc);
              const isEditing = editingAccountId === acc.id;
              const hasCustom = customMessages[acc.id] !== undefined;

              return (
                <div
                  key={acc.id}
                  className="bg-white rounded-2xl border border-red-200 p-5 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 font-bold flex items-center justify-center text-sm border border-red-200 shrink-0">
                        {student?.nome.charAt(0) || 'A'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-slate-900 truncate">{student?.nome}</h3>
                        <p className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="flex items-center gap-1 font-mono text-[11px]">
                            <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            {student?.telefone}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px]">Venceu em: <strong>{formatDateBR(acc.dataVencimento)}</strong></span>
                        </p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex sm:block items-baseline justify-between sm:justify-end">
                      <span className="text-[11px] text-slate-400 block mr-2 sm:mr-0">Saldo Devedor:</span>
                      <span className="text-base font-extrabold font-mono text-red-600">
                        {formatCurrencyBRL(acc.saldoDevedorCentavos)}
                      </span>
                    </div>
                  </div>

                  {/* Message Box: View Mode or Edit Mode */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                        <span>Texto da Mensagem:</span>
                        {hasCustom && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                            Personalizada
                          </span>
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        {hasCustom && (
                          <button
                            type="button"
                            onClick={() => handleResetCustomMessage(acc.id)}
                            className="text-[11px] text-slate-400 hover:text-slate-700 flex items-center gap-1 cursor-pointer"
                            title="Restaurar modelo automático"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restaurar padrão</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditingAccountId(isEditing ? null : acc.id)}
                          className="text-[11px] text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isEditing ? 'Concluir Edição' : 'Editar Texto da Mensagem'}</span>
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        rows={7}
                        value={currentMessage}
                        onChange={(e) => setCustomMessages({ ...customMessages, [acc.id]: e.target.value })}
                        className="w-full p-3 bg-white rounded-xl border-2 border-blue-400 text-xs text-slate-900 font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-inner"
                        placeholder="Edite a mensagem que será enviada para o aluno..."
                      />
                    ) : (
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-700 font-sans whitespace-pre-line leading-relaxed break-words">
                        {currentMessage}
                      </div>
                    )}
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                    {/* View QR Code Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedAccountForQrModal(acc)}
                      className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Ver QR Code & Copia e Cola</span>
                    </button>

                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        type="button"
                        onClick={() => handleCopyMessage(acc)}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {copiedId === acc.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Texto</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSendWhatsApp(acc)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Abrir no WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* History of Sent Reminders */}
      {sentLogs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-blue-600" />
            Histórico de Cobranças Disparadas
          </h3>
          <div className="divide-y divide-slate-100 text-xs">
            {sentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{log.alunoNome} ({log.telefone})</p>
                  <p className="text-[11px] text-slate-400">
                    Enviado em {new Date(log.enviadoEm).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900">
                    {formatCurrencyBRL(log.valorCentavos)}
                  </span>
                  <span className="block text-[10px] text-emerald-700 font-semibold">
                    ✓ {log.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pix Config Modal */}
      {showPixConfigModal && (
        <PixConfigModal
          currentOrg={currentOrg}
          currentUser={currentUser}
          isOpen={showPixConfigModal}
          onClose={() => setShowPixConfigModal(false)}
          onSaved={() => refreshPixConfig()}
        />
      )}

      {/* Pix QR Code Modal */}
      {selectedAccountForQrModal && (
        <PixQrCodeModal
          isOpen={!!selectedAccountForQrModal}
          onClose={() => setSelectedAccountForQrModal(null)}
          alunoNome={studentForQrModal?.nome || 'Aluno'}
          alunoTelefone={studentForQrModal?.telefone}
          descricao={selectedAccountForQrModal.descricao}
          valorCentavos={selectedAccountForQrModal.saldoDevedorCentavos}
          dataVencimento={selectedAccountForQrModal.dataVencimento}
          chavePix={pixConfig.chavePix}
          tipoChavePix={pixConfig.tipoChavePix}
          beneficiario={pixConfig.beneficiarioPix}
          cidade={pixConfig.cidadePix}
          txid={selectedAccountForQrModal.id}
        />
      )}
    </div>
  );
};
