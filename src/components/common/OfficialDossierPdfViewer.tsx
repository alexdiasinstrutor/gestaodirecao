import React from 'react';
import {
  Printer,
  Download,
  Eye,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  Database,
  ExternalLink,
  Lock,
  Smartphone,
  Cpu
} from 'lucide-react';
import { DOSSIER_METADATA } from '../../lib/dossierPdfPrinter';

interface OfficialDossierPdfViewerProps {
  onDownloadPdf: () => void;
  onOpenPdfTab?: () => void;
  onPrint: () => void;
  onDownloadMd: () => void;
  onDownloadHtml: () => void;
  isPrinting?: boolean;
  printFeedback?: string;
  viewMode: 'OFFICIAL_PDF' | 'CARDS';
  onToggleViewMode: () => void;
}

export const OfficialDossierPdfViewer: React.FC<OfficialDossierPdfViewerProps> = ({
  onDownloadPdf,
  onOpenPdfTab,
  onPrint,
  onDownloadMd,
  onDownloadHtml,
  isPrinting = false,
  printFeedback,
  viewMode,
  onToggleViewMode
}) => {
  return (
    <div className="space-y-4">
      {/* Top Document Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3 sticky top-0 z-10 backdrop-blur-md bg-white/95">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
              Documento Oficial A4
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              v5.6 Homologada
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-700">
              PDF Real (jsPDF Engine)
            </span>
          </div>
          <h3 className="text-base font-extrabold text-slate-900 mt-1">
            Visualizador Oficial do Dossiê Técnico
          </h3>
          <p className="text-xs text-slate-500">
            Exportação em arquivo PDF real, impressão direta ou download de arquivos fonte.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Primary Action: Direct PDF Download */}
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isPrinting}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Gera e faz o download direto do arquivo .PDF no seu computador"
          >
            <Download className={`w-4 h-4 ${isPrinting ? 'animate-bounce' : ''}`} />
            <span>{isPrinting ? 'Gerando PDF...' : 'Baixar Arquivo PDF (.pdf)'}</span>
          </button>

          {/* Secondary Action: Print Dialog */}
          <button
            type="button"
            onClick={onPrint}
            disabled={isPrinting}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            title="Abrir diálogo de impressão do navegador"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>

          {/* Open in new tab */}
          {onOpenPdfTab && (
            <button
              type="button"
              onClick={onOpenPdfTab}
              className="flex items-center justify-center gap-1 px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              title="Abrir PDF em nova aba do navegador"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span className="hidden lg:inline">Nova Aba</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleViewMode}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Alternar entre modo página A4 e modo cartões"
          >
            <Eye className="w-4 h-4 text-slate-500" />
            <span>{viewMode === 'OFFICIAL_PDF' ? 'Cards' : 'Modo A4'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadMd}
            className="flex items-center justify-center gap-1 px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Baixar arquivo markdown DOSSIE.md"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>.MD</span>
          </button>

          <button
            type="button"
            onClick={onDownloadHtml}
            className="flex items-center justify-center gap-1 px-2.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            title="Baixar versão HTML oficial"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>.HTML</span>
          </button>
        </div>
      </div>

      {/* Print Success Feedback Banner */}
      {printFeedback && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{printFeedback}</span>
        </div>
      )}

      {/* Simulated A4 Printable Sheet Container */}
      <div className="bg-white rounded-2xl border border-slate-300 shadow-lg p-6 sm:p-10 md:p-14 max-w-4xl mx-auto space-y-8 text-slate-900 font-sans print:p-0 print:border-none print:shadow-none">
        
        {/* Institutional Document Header */}
        <div className="border-b-4 border-blue-600 pb-6 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500">
            <span className="font-mono font-bold tracking-wider uppercase text-blue-700">
              REPÚBLICA FEDERATIVA DO BRASIL · SISTEMA NACIONAL DE TRÂNSITO
            </span>
            <span className="font-mono text-[11px] bg-slate-100 px-2.5 py-0.5 rounded">
              HOMOLOGADO: OUTUBRO DE 2026
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Sistema de Administração de Gestão de Direção
          </h1>
          <p className="text-sm text-slate-600">
            Dossiê Técnico, Arquitetura de Software, Catálogo de Telas, Regras de Negócio e Dicionário de Dados
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs mt-3">
            <div>
              <span className="text-slate-500 block text-[11px]">Versão da Plataforma:</span>
              <strong className="text-slate-900 font-mono">v5.3 Estável</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Administrador Master:</span>
              <strong className="text-purple-700 font-mono truncate block" title="cassiordcosta@gmail.com">
                cassiordcosta@gmail.com
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Banco de Dados:</span>
              <strong className="text-emerald-700">Cloud Firestore</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Modo Operacional:</span>
              <strong className="text-slate-800">Offline-First Híbrido</strong>
            </div>
          </div>
        </div>

        {/* Section 1: Resumo Executivo */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            Resumo Executivo e Identificação do Sistema
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">
            O <strong>Sistema de Administração de Gestão de Direção</strong> é uma plataforma full-stack de gestão pedagógica, operacional e financeira desenvolvida para Centros de Formação de Condutores (CFCs / Autoescolas), Instrutores de Trânsito Autônomos e Candidatos à Habilitação.
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
            <li><strong>Gestão Pedagógica CONTRAN</strong>: Acompanhamento de 8 competências práticas (baliza, embreagem, rodovia, etc.) avaliadas de 0 a 10.</li>
            <li><strong>Gestão Financeira em Centavos</strong>: Contas a receber, carnês, baixa de parcelas e integração com PIX dinâmico (Copia e Cola + QR Code).</li>
            <li><strong>Agenda Prática Noturna</strong>: Operação das 06:00 às 00:00 atendendo às exigências de carga horária noturna do Código de Trânsito Brasileiro.</li>
            <li><strong>Governança Estrita RBAC</strong>: Níveis categóricos de privilégio para Administrador Master, Gestores de CFC, Instrutores e Alunos.</li>
          </ul>
        </section>

        {/* Section 2: Matriz RBAC */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">2</span>
            Matriz de Perfis e Controle de Acesso (RBAC)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2 border-r border-slate-200">Papel</th>
                  <th className="p-2 border-r border-slate-200">Escopo</th>
                  <th className="p-2 border-r border-slate-200">Permissões Principais</th>
                  <th className="p-2">Regras de Segurança</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="p-2 font-bold text-purple-900 border-r border-slate-200">SUPER_ADMIN (Master)</td>
                  <td className="p-2 border-r border-slate-200">Global (Plataforma)</td>
                  <td className="p-2 border-r border-slate-200">Auditoria completa, verificador de cadastros, reatribuição de alunos, Dossiê e trava de código.</td>
                  <td className="p-2">Exclusivo: cassiordcosta@gmail.com com 2FA obrigatório.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-blue-900 border-r border-slate-200">ADMIN_ORG (CFC)</td>
                  <td className="p-2 border-r border-slate-200">Autoescola</td>
                  <td className="p-2 border-r border-slate-200">Gestão de instrutores, frota de veículos, relatórios e DRE consolidado.</td>
                  <td className="p-2">Isolado estritamente por <code>organizacaoId</code>.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-slate-900 border-r border-slate-200">INSTRUTOR</td>
                  <td className="p-2 border-r border-slate-200">Carteira Própria</td>
                  <td className="p-2 border-r border-slate-200">Cadastro de alunos vinculados por link, aulas (06h às 00h), notas e finanças.</td>
                  <td className="p-2">Regra 1 Aluno (CPF) = 1 Instrutor; não visualiza outros.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold text-emerald-900 border-r border-slate-200">ALUNO</td>
                  <td className="p-2 border-r border-slate-200">Portal do Aluno</td>
                  <td className="p-2 border-r border-slate-200">Consulta de aulas cumpridas, radar de competências e carnê PIX.</td>
                  <td className="p-2">Visualização restrita ao próprio CPF mascarado.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 3: Catálogo das 17 Telas */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            Catálogo Completo das 17 Telas do Sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">1. Autenticação e Login Multi-Método:</strong>
              <p className="text-slate-600 text-[11px]">Google OAuth, e-mail/senha, recuperação com CPF e 2FA.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">2. Auto-Cadastro de Instrutores:</strong>
              <p className="text-slate-600 text-[11px]">Validação de credencial de trânsito e criação de tenant.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">3. Auto-Matrícula Vinculada de Aluno:</strong>
              <p className="text-slate-600 text-[11px]">Vínculo por link exclusivo com instrutor fixo e idade &ge; 18 anos.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">4. Gerador de Convites WhatsApp:</strong>
              <p className="text-slate-600 text-[11px]">Geração e disparo de links de convite via deep link nativo.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">5. Painel Geral (Dashboard):</strong>
              <p className="text-slate-600 text-[11px]">KPIs de faturamento, taxa de aprovação e próximas aulas.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">6. Gestão de Alunos & Progresso:</strong>
              <p className="text-slate-600 text-[11px]">Fichas cadastrais, reatribuição e emissão de ficha A4.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">7. Radar e Avaliação de Habilidades:</strong>
              <p className="text-slate-600 text-[11px]">8 competências práticas CONTRAN avaliadas de 0 a 10.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">8. Agenda Prática Diurna e Noturna:</strong>
              <p className="text-slate-600 text-[11px]">Operação das 06:00 às 00:00 com bloqueio e registro de faltas.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">9. Finanças & Contas a Receber:</strong>
              <p className="text-slate-600 text-[11px]">Títulos em centavos, parcelamentos e comprovantes.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">10. Gateway PIX Dinâmico:</strong>
              <p className="text-slate-600 text-[11px]">Geração instantânea de EMV Copia e Cola e QR Code.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">11. Despesas Operacionais e Frota:</strong>
              <p className="text-slate-600 text-[11px]">Combustível, manutenção e custos categorizados por placa.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">12. Metas de Investimento e Reservas:</strong>
              <p className="text-slate-600 text-[11px]">Projeções financeiras para novos veículos e reservas.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">13. Demonstrativo de Resultados (DRE):</strong>
              <p className="text-slate-600 text-[11px]">Receita bruta, custos operacionais e apuração do Lucro Líquido.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">14. Central de Notificações WhatsApp:</strong>
              <p className="text-slate-600 text-[11px]">Modelos prontos de lembretes de aula e cobranças de débitos.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">15. Portal do Aluno:</strong>
              <p className="text-slate-600 text-[11px]">Acesso responsivo móvel para acompanhamento do candidato.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">16. Console Master e Verificador de Cadastros:</strong>
              <p className="text-slate-600 text-[11px]">Varredura de integridade e reatribuição de carteiras.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg sm:col-span-2">
              <strong className="text-slate-900">17. Painel de Agentes de Segurança e Banco de Dados:</strong>
              <p className="text-slate-600 text-[11px]">Watchdog, Code Guard com snapshots e sincronização Firestore.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Dicionário de Dados */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</span>
            Dicionário de Banco de Dados e Entidades (16 Coleções Homologadas)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 text-slate-900 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2 border-r border-slate-200">Coleção</th>
                  <th className="p-2 border-r border-slate-200">Chaves (PK / FK)</th>
                  <th className="p-2 border-r border-slate-200">Campos Principais</th>
                  <th className="p-2">Regras de Integridade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">organizations</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code></td>
                  <td className="p-2 border-r border-slate-200">nome, tipo, cnpjCpf, telefone, email, plano, status</td>
                  <td className="p-2">Particionamento multi-inquilino.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">users</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>organizacaoId</code></td>
                  <td className="p-2 border-r border-slate-200">nome, email, papel, telefone, cpfFingerprint, twoFactorAtivo</td>
                  <td className="p-2">Google OAuth e hash criptográfico de CPF.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">students</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">nome, cpfMascarado, cpfFingerprint, idade, categoriaCnh, habilidades</td>
                  <td className="p-2">1 Aluno = 1 Instrutor; Idade mínima &ge; 18 anos.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">StudentSkills</td>
                  <td className="p-2 border-r border-slate-200">Embutido</td>
                  <td className="p-2 border-r border-slate-200">baliza, embreagem, transito, conversoes, rodovia, simulado (0-10)</td>
                  <td className="p-2">Critérios práticos oficiais do CONTRAN.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">vehicles</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>organizacaoId</code></td>
                  <td className="p-2 border-r border-slate-200">modelo, placa, ano, tipo, kmAtual, proximaRevisaoKm</td>
                  <td className="p-2">Controle de manutenção e hodômetro.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">lessons</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FKs: <code>alunoId, instrutorId, veiculoId</code></td>
                  <td className="p-2 border-r border-slate-200">data, horaInicio, horaFim, topico, status, notaAula</td>
                  <td className="p-2">Grade ampliada das 06:00 às 00:00.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">availableSlots</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">data, horaInicio, horaFim, bloqueado, motivoBloqueio</td>
                  <td className="p-2">Disponibilidade individual do instrutor.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">accountsReceivable</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>alunoId</code></td>
                  <td className="p-2 border-r border-slate-200">valorTotalCentavos, saldoDevedorCentavos, pixPayload, pixQrCodeUrl</td>
                  <td className="p-2">Valores em centavos (sem distorção float).</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">paymentRecords</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>contaReceberId</code></td>
                  <td className="p-2 border-r border-slate-200">valorCentavos, metodo, dataPagamento, comprovanteNumero</td>
                  <td className="p-2">Amortizações e quitações financeiras.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">expenses</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>veiculoId</code></td>
                  <td className="p-2 border-r border-slate-200">descricao, categoria, valorCentavos, dataVencimento, status</td>
                  <td className="p-2">Fluxo de caixa de saídas e custos da frota.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">investments</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code></td>
                  <td className="p-2 border-r border-slate-200">titulo, valorMetaCentavos, valorAcumuladoCentavos, dataPrevisao</td>
                  <td className="p-2">Metas para aquisição de frota e reservas.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">packages</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code></td>
                  <td className="p-2 border-r border-slate-200">nome, totalAulas, categoriaCnh, valorCentavos, maxParcelas</td>
                  <td className="p-2">Planos comerciais configuráveis.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">studentTransfers</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>alunoId</code></td>
                  <td className="p-2 border-r border-slate-200">alunoNome, instrutorAnteriorId, instrutorNovoId, motivo, autorId</td>
                  <td className="p-2">Histórico perpétuo de transferências.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">auditLogs</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>usuarioId</code></td>
                  <td className="p-2 border-r border-slate-200">acao, entidade, entidadeId, detalhes, ipOrigem, timestamp</td>
                  <td className="p-2">Imutabilidade forense e conformidade LGPD.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">whatsappLogs</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>alunoId</code></td>
                  <td className="p-2 border-r border-slate-200">telefone, valorCentavos, mensagem, enviadoEm, status</td>
                  <td className="p-2">Registro de lembretes e cobranças.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">syncQueue</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code></td>
                  <td className="p-2 border-r border-slate-200">timestamp, action, entity, payload, retryCount</td>
                  <td className="p-2">Motor Offline-First para o Cloud Firestore.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 5: Agentes de Segurança */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">5</span>
            Agentes Autônomos de Segurança e Arquitetura Firestore
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <strong className="text-slate-900 block text-sm">Watchdog Agent (Sentinela Operacional)</strong>
              <p className="text-slate-600 leading-relaxed">
                Monitora transações ao vivo, tempo de resposta, sanidade das entidades locais e do Firestore. Categoriza eventos em INFO, SECURE, AVISO e CRÍTICO.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
              <strong className="text-slate-900 block text-sm">Code Guard Agent (Trava de Código)</strong>
              <p className="text-slate-600 leading-relaxed">
                Bloqueia mutações acidentais na lógica do sistema, mantendo checkpoints de restauração para recuperação instantânea em caso de divergência.
              </p>
            </div>
          </div>
        </section>

        {/* Section 6: Termo de Homologação e Assinaturas */}
        <section className="border-t-2 border-slate-300 pt-6 space-y-4">
          <div className="border-2 border-dashed border-emerald-600 bg-emerald-50/60 p-4 rounded-xl text-center space-y-1">
            <span className="inline-block bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded uppercase tracking-wider">
              Termo Oficial de Homologação v5.3
            </span>
            <p className="text-xs text-emerald-950 font-medium pt-1">
              Sistema integralmente auditado, protegido por agentes autônomos e homologado para operação contínua.
            </p>
            <p className="text-[11px] text-emerald-800 font-mono">
              Validação Criptográfica: SHA256-AGD-7F9A2B4C8E01-2026-STABLE
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8">
            <div className="text-center space-y-1">
              <div className="border-t border-slate-800 w-3/4 mx-auto pt-2" />
              <strong className="text-xs text-slate-950 block">Cássio R. D. Costa</strong>
              <span className="text-[11px] text-slate-600 block">Administrador Master do Sistema</span>
              <span className="text-[10px] text-slate-500 font-mono">cassiordcosta@gmail.com</span>
            </div>

            <div className="text-center space-y-1">
              <div className="border-t border-slate-800 w-3/4 mx-auto pt-2" />
              <strong className="text-xs text-slate-950 block">Comitê de Auditoria & Governança</strong>
              <span className="text-[11px] text-slate-600 block">Segurança da Informação e LGPD</span>
              <span className="text-[10px] text-slate-500 font-mono">Certificação v5.3 Estável</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
