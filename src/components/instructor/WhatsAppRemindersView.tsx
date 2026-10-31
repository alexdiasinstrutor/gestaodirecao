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
  CheckCircle2
} from 'lucide-react';
import { db } from '../../lib/storage';
import { formatCurrencyBRL, formatDateBR } from '../../lib/validation';
import { generateWhatsAppMessage, buildWhatsAppLink } from '../../lib/whatsapp';
import { Organization, User, AccountReceivable, WhatsAppReminderLog } from '../../types';

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

  // Filter overdue accounts
  const overdueAccounts = accounts.filter(
    (a) => a.status === 'VENCIDO' || (a.status === 'PARCIAL' && new Date(a.dataVencimento) < new Date())
  );

  const handleCopyMessage = (acc: AccountReceivable) => {
    const student = students.find((s) => s.id === acc.alunoId);
    if (!student) return;

    const message = generateWhatsAppMessage({
      alunoNome: student.nome,
      telefone: student.telefone,
      valorCentavos: acc.saldoDevedorCentavos,
      dataVencimento: acc.dataVencimento,
      chavePix: 'financeiro@direcaosegura.com.br',
      nomeInstrutorOuAutoescola: currentOrg.nome,
      tipoMensagem: messageTone
    });

    navigator.clipboard.writeText(message);
    setCopiedId(acc.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleSendWhatsApp = (acc: AccountReceivable) => {
    const student = students.find((s) => s.id === acc.alunoId);
    if (!student) return;

    const message = generateWhatsAppMessage({
      alunoNome: student.nome,
      telefone: student.telefone,
      valorCentavos: acc.saldoDevedorCentavos,
      dataVencimento: acc.dataVencimento,
      chavePix: 'financeiro@direcaosegura.com.br',
      nomeInstrutorOuAutoescola: currentOrg.nome,
      tipoMensagem: messageTone
    });

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
              Lembretes de Cobrança via WhatsApp
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
              Dispare lembretes amigáveis ou formais com chave PIX copia e cola para alunos com parcelas atrasadas em 1 clique.
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

      {/* Tone of Voice Selector */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <label className="block text-xs font-bold text-slate-900">
          Modelo de Mensagem de Cobrança:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            onClick={() => setMessageTone('GENTIL')}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              messageTone === 'GENTIL'
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              messageTone === 'PADRAO'
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              messageTone === 'URGENTE'
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
          <div className="space-y-3">
            {overdueAccounts.map((acc) => {
              const student = students.find((s) => s.id === acc.alunoId);
              const previewMsg = student
                ? generateWhatsAppMessage({
                    alunoNome: student.nome,
                    telefone: student.telefone,
                    valorCentavos: acc.saldoDevedorCentavos,
                    dataVencimento: acc.dataVencimento,
                    chavePix: 'financeiro@direcaosegura.com.br',
                    nomeInstrutorOuAutoescola: currentOrg.nome,
                    tipoMensagem: messageTone
                  })
                : '';

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

                  {/* Message Preview Box */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 font-sans whitespace-pre-line leading-relaxed break-words">
                    {previewMsg}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => handleCopyMessage(acc)}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedId === acc.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Mensagem Copiada!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copiar Texto</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleSendWhatsApp(acc)}
                      className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Abrir no WhatsApp</span>
                    </button>
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
    </div>
  );
};
