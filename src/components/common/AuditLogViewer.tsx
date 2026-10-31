import React, { useState } from 'react';
import { ShieldCheck, FileText, Lock, Download, AlertCircle, X, Search, CheckCircle2 } from 'lucide-react';
import { AuditLog } from '../../types';
import { db } from '../../lib/storage';

interface AuditLogViewerProps {
  orgId: string;
  onClose: () => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ orgId, onClose }) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'AUDIT' | 'LGPD_RIGHTS'>('AUDIT');
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const logs = db.getAuditLogs(orgId);

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase();
    return (
      log.acao.toLowerCase().includes(term) ||
      log.usuarioNome.toLowerCase().includes(term) ||
      log.detalhes.toLowerCase().includes(term) ||
      log.entidade.toLowerCase().includes(term)
    );
  });

  const handleExportDataSubject = () => {
    const exportBundle = {
      termo: 'Exportação de Dados para Cumprimento do Art. 18 da Lei Geral de Proteção de Dados (LGPD)',
      dataExportacao: new Date().toISOString(),
      organizacao: db.getOrganization(orgId),
      logs: logs,
      estudantesCadastrados: db.getStudents(orgId).map((s) => ({
        id: s.id,
        nome: s.nome,
        cpfMascarado: s.cpfMascarado,
        idade: s.idade,
        categoriaCnh: s.categoriaCnh,
        status: s.status,
        aulasCumpridas: s.aulasCumpridas,
        dataCadastro: s.dataCadastro
      }))
    };

    const blob = new Blob([JSON.stringify(exportBundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_lgpd_auditoria_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white">
                Governança LGPD & Trilha de Auditoria
              </h2>
              <p className="text-xs text-slate-300">
                Conformidade com a Lei 13.709/2018 (Lei Geral de Proteção de Dados Pessoais)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-5 flex items-center gap-2 sm:gap-4 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'AUDIT'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Trilha de Auditoria ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('LGPD_RIGHTS')}
            className={`py-3 border-b-2 whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'LGPD_RIGHTS'
                ? 'border-blue-600 text-blue-700 font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Direitos do Titular & Criptografia
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'AUDIT' ? (
            <>
              {/* Search and Filters */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar ação, autor ou detalhe..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={handleExportDataSubject}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Exportar Relatório LGPD (JSON)
                </button>
              </div>

              {exportSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Relatório oficial de dados e logs exportado com sucesso para arquivo JSON!
                </div>
              )}

              {/* Mobile Card Stack (md:hidden) to avoid truncated text on narrow phones */}
              <div className="md:hidden space-y-2.5">
                {filteredLogs.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-400">
                    Nenhum registro de auditoria encontrado.
                  </div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-semibold border border-blue-200">
                          {log.acao}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div className="text-xs">
                        <span className="font-semibold text-slate-900">{log.usuarioNome}</span>
                        <span className="text-slate-500"> · {log.entidade}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 break-words leading-relaxed">
                        {log.detalhes}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop / Tablet Table View (hidden md:block) */}
              <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Data / Hora</th>
                        <th className="py-2.5 px-3">Autor</th>
                        <th className="py-2.5 px-3">Ação</th>
                        <th className="py-2.5 px-3">Entidade</th>
                        <th className="py-2.5 px-3">Detalhes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            Nenhum registro de auditoria encontrado.
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString('pt-BR')}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 whitespace-nowrap">
                              {log.usuarioNome}
                            </td>
                            <td className="py-2 px-3 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] font-semibold border border-blue-200">
                                {log.acao}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">
                              {log.entidade}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-sm break-words" title={log.detalhes}>
                              {log.detalhes}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-4 text-xs text-slate-700">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Mecanismos de Segurança e Privacidade Implementados
                </h3>
                <p>
                  O <strong>Auto Gestão de Direção</strong> adota o princípio de <em>Privacy by Design</em> e boas práticas de criptografia:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  <li><strong>Mascaramento e Fingerprint de CPF:</strong> O CPF completo nunca é exibido de forma desnecessária na interface. A busca interna opera por fingerprint HMAC/SHA-256 irreversível.</li>
                  <li><strong>Controle Estrito de Maioridade (18+):</strong> O sistema rejeita veementemente o cadastro de menores de 18 anos, exigindo confirmação de data de nascimento.</li>
                  <li><strong>Isolamento Multi-Tenant:</strong> Dados de cada autoescola e instrutor autônomo são protegidos e isolados por chave de organização, impedindo vazamento cruzado.</li>
                  <li><strong>Autenticação de Dois Fatores (2FA):</strong> Camada adicional de proteção via token numérico de uso único.</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <h3 className="font-bold text-blue-900 text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  Atendimento aos Direitos dos Titulares de Dados (Art. 18 LGPD)
                </h3>
                <p className="text-slate-700">
                  Como operador e controlador, qualquer aluno ou instrutor pode solicitar:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="font-semibold text-slate-900">1. Acesso e Portabilidade</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">Exportação de todo o histórico de aulas, avaliações práticas e pagamentos em formato interoperável.</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="font-semibold text-slate-900">2. Correção de Dados</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">Atualização imediata de endereço, telefone ou e-mail cadastrado na ficha do aluno.</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="font-semibold text-slate-900">3. Anonimização / Exclusão</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">Anonimização de dados após expiração do prazo legal de guarda exigido pelo Detran/Contran.</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-blue-200">
                    <p className="font-semibold text-slate-900">4. Trilha Inviolável</p>
                    <p className="text-slate-600 text-[11px] mt-0.5">Registro auditável de todas as transações financeiras, cancelamentos e aprovações práticas.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl cursor-pointer"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    </div>
  );
};
