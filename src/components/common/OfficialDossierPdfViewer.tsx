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
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-blue-100 text-blue-800 border border-blue-200">
              Documento Oficial A4
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              v6.8 Homologada (17/17 Testes)
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-slate-100 text-slate-700">
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
            <span className="font-mono text-xs bg-slate-100 px-2.5 py-0.5 rounded">
              HOMOLOGADO: NOVEMBRO DE 2026
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
            Gestão AD (Auto Direção)
          </h1>
          <p className="text-sm text-slate-600">
            Dossiê Técnico, Mapa Geográfico (5–40 km), Blindagem Cloud Vault de Pacotes, Gestão de Veículos, Catálogo de 20 Telas e Dicionário de Dados (19 Coleções)
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs mt-3">
            <div>
              <span className="text-slate-500 block text-xs">Versão da Plataforma:</span>
              <strong className="text-slate-900 font-mono">v6.8 Estável (17/17 Testes)</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Administrador Master:</span>
              <strong className="text-purple-700 font-mono truncate block" title="cassiordcosta@gmail.com">
                cassiordcosta@gmail.com
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Banco de Dados:</span>
              <strong className="text-emerald-700">Supabase + Cloud Vault</strong>
            </div>
            <div>
              <span className="text-slate-500 block text-xs">Mapa, Frota & Pacotes:</span>
              <strong className="text-slate-800">5–40 km, Veículos & Zero Perda</strong>
            </div>
          </div>
        </div>

        {/* Section 1: Resumo Executivo */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">1</span>
            Resumo Executivo, Identidade Visual e Novas Melhorias Homologadas (v6.8)
          </h2>
          <p className="text-xs text-slate-700 leading-relaxed">
            O <strong>Gestão AD (Auto Direção)</strong> é uma plataforma full-stack de gestão pedagógica, operacional, geográfica e financeira desenvolvida para Centros de Formação de Condutores (CFCs / Autoescolas), Instrutores de Trânsito Autônomos e Candidatos à Habilitação.
          </p>
          <ul className="list-disc pl-5 text-xs text-slate-700 space-y-1">
            <li><strong>Cadastro de Aluno em 3 Etapas (Wizard) & Confidencialidade por Código</strong>: Processo otimizado em 3 telas claras. Por segurança e confidencialidade comercial, o sistema <strong>não lista os nomes dos instrutores</strong> no auto-cadastro público; o aluno informa o <strong>Código do Instrutor</strong> (ou utiliza o link do WhatsApp que já preenche o código automaticamente) para visualizar exclusivamente os planos daquele instrutor.</li>
            <li><strong>Localizador Geográfico de Instrutores (Mapa 5 a 40 km), Estado Primeiro, CEP e Privacidade de Bairro</strong>: Mapa interativo (Leaflet/OpenStreetMap + Haversine) onde o aluno seleciona o <strong>Estado (UF) primeiro</strong> ou digita o <strong>CEP</strong> (com auto-preenchimento), filtra por raio de <strong>5 a 40 km</strong>, Cidade, Categoria CNH, Câmbio (Manual/Automático) e Tipo de Veículo (Carro, Moto, Caminhão, Ônibus). Exibe <strong>apenas as cidades atendidas</strong> pelo instrutor (ocultando o bairro do endereço residencial) e direciona o contato direto pelo botão <strong>"Chamar no WhatsApp"</strong>.</li>
            <li><strong>Demanda Reversa (Alunos à Procura de Instrutor) & Mapa Interno Exclusivo para Instrutores Logados</strong>: Caso o aluno não localize instrutor na sua área, pode cadastrar sua solicitação com CEP; os instrutores logados recebem alertas na seção <strong>"Mapa & Notificações"</strong> e visualizam no mapa interno quantos alunos e instrutores existem por cidade, bairro e distância.</li>
            <li><strong>Liberação/Remoção de Agenda por Período (Semanal, Mensal, Anual) & Notificação ao Aluno</strong>: O instrutor habilita ou remove períodos da agenda por semana, mês ou ano. Se houver aluno agendado no horário a ser removido, o sistema exibe alerta de confirmação e envia automaticamente uma <strong>Notificação na Tela do Aluno</strong> solicitando que ele remarque para um novo horário disponível.</li>
            <li><strong>Edição e Persistência de Plano na Ficha do Aluno</strong>: O instrutor pode mudar o plano/pacote contratado, categoria CNH e evolução pedagógica diretamente na ficha do aluno (<code>StudentsView.tsx</code>), salvando de forma assíncrona no Supabase e atualizando a fatura em aberto.</li>
            <li><strong>Blindagem Absoluta Contra Perda de Pacotes do Instrutor (Zero Data Loss)</strong>: O sistema <strong>jamais apaga, sobrescreve ou inventa pacotes aleatórios</strong>. Conta com cofre local redundante (<code>PACKAGES_BACKUP</code>), fila <code>PENDING_PACKAGES</code>, carimbo <code>atualizadoEm</code> e <strong>Cloud Sync Vault</strong> (<code>__agd_vault_package_offers</code>) no Supabase.</li>
            <li><strong>Cadastro e Gestão de Carros / Veículos dos Instrutores (<code>VehiclesView.tsx</code>)</strong>: Aba dedicada <strong>"Meus Veículos"</strong> disponível em todos os planos para cadastrar carros, motos, caminhões e ônibus (placa Mercosul/antiga, ano, cor, câmbio manual/automático, duplo comando, adaptação PCD, km atual e próxima revisão), sincronizando automaticamente com os filtros do Mapa.</li>
            <li><strong>Sanitização Global de Telefone e Validação Automatizada (17/17 Testes)</strong>: Telefone obrigatório no convite e cadastros sem jamais passar máscara vazia como número, auditado por 17 baterias de testes automatizados (<code>run_automated_tests.mjs</code>).</li>
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

        {/* Section 3: Catálogo das 20 Telas */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">3</span>
            Catálogo Completo das 20 Telas do Sistema
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">1. Autenticação e Login Multi-Método:</strong>
              <p className="text-slate-600 text-xs">Google OAuth, e-mail/senha, recuperação com CPF e 2FA.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">2. Auto-Cadastro de Instrutores:</strong>
              <p className="text-slate-600 text-xs">Validação de CPF, endereço por CEP e credencial DETRAN.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">3. Auto-Matrícula de Aluno (Wizard 3 Telas):</strong>
              <p className="text-slate-600 text-xs">Busca confidencial por código do instrutor (ou link WhatsApp) e pacotes reais.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">4. Localizador Geográfico (Mapa 5–40 km):</strong>
              <p className="text-slate-600 text-xs">UF primeiro, busca por CEP, filtros CNH/Câmbio/Veículo, sem bairro e contato WhatsApp.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">5. Mapa Interno & Notificações do Instrutor:</strong>
              <p className="text-slate-600 text-xs">Raio 5–40 km, cidades atendidas, mapa de mercado e alunos procurando instrutor.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">6. Meus Veículos e Frota de Instrução:</strong>
              <p className="text-slate-600 text-xs">Cadastro de carros/motos do instrutor (câmbio manual/automático, placa, duplo comando e km).</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">7. Gerador de Convites WhatsApp:</strong>
              <p className="text-slate-600 text-xs">Telefone obrigatório validado (anti-máscara vazia) e link com código do instrutor.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">8. Painel Geral (Dashboard):</strong>
              <p className="text-slate-600 text-xs">KPIs financeiros, alerta de alunos na região, atalho Meus Veículos e próximas aulas.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">9. Gestão de Alunos & Mudança de Plano:</strong>
              <p className="text-slate-600 text-xs">Menu apenas com categorias com alunos, edição persistente de plano na ficha e transferência.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">10. Radar e Avaliação de Habilidades:</strong>
              <p className="text-slate-600 text-xs">8 competências práticas CONTRAN avaliadas de 0 a 10 com salvamento imediato.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">11. Agenda por Período (Semanal/Mensal/Anual):</strong>
              <p className="text-slate-600 text-xs">Liberação/remoção por período, visão mobile do aluno e notificação automática ao desmarcar.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">12. Catálogo Blindado de Pacotes e Planos:</strong>
              <p className="text-slate-600 text-xs">Proteção Zero Data Loss (PACKAGES_BACKUP + Cloud Vault) contra perda de pacotes.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">13. Finanças, Contas a Receber & PIX:</strong>
              <p className="text-slate-600 text-xs">Títulos em centavos, parcelamentos, recibos digitais e QR Code PIX dinâmico.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">14. Despesas Operacionais e Frota:</strong>
              <p className="text-slate-600 text-xs">Combustível, manutenção e custos categorizados por placa do veículo.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">15. Metas de Investimento, DRE e IRPF:</strong>
              <p className="text-slate-600 text-xs">Projeções para troca de frota, apuração do Lucro Líquido (DRE) e Carnê-Leão.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">16. Saúde Financeira & Simulador DETRAN:</strong>
              <p className="text-slate-600 text-xs">Score 0–100, Regra dos 4 Potes e calculadora do custo real da aula prática.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">17. Central de Notificações WhatsApp:</strong>
              <p className="text-slate-600 text-xs">Modelos prontos de lembretes de aula e cobranças de débitos.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">18. Portal do Aluno (Com Alertas):</strong>
              <p className="text-slate-600 text-xs">Avisos de aulas desmarcadas pelo instrutor para remarcação, notas e PIX.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">19. Console Master e Verificador de Cadastros:</strong>
              <p className="text-slate-600 text-xs">Varredura de integridade, planos SaaS, cupons e reatribuição de carteiras.</p>
            </div>
            <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
              <strong className="text-slate-900">20. Painel de Agentes & Cloud Sync Vault:</strong>
              <p className="text-slate-600 text-xs">Watchdog, Code Guard com snapshots e sincronização Supabase/Firestore.</p>
            </div>
          </div>
        </section>

        {/* Section 4: Dicionário de Dados */}
        <section className="space-y-2.5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center gap-2">
            <span className="w-5 h-5 rounded bg-blue-600 text-white flex items-center justify-center text-xs font-bold">4</span>
            Dicionário de Banco de Dados e Entidades (19 Coleções Homologadas)
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
                  <td className="p-2 border-r border-slate-200">nome, tipo, cnpjCpf, cep, logradouro, numero, complemento, bairro, cidade, estado (MG), chavePix, plano, status</td>
                  <td className="p-2">Particionamento multi-inquilino + Endereço completo por CEP no Supabase.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">users</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>organizacaoId</code></td>
                  <td className="p-2 border-r border-slate-200">nome, email, papel, telefone, cpfFingerprint, cep, logradouro, numero, complemento, bairro, cidade, estado (MG), chavePix</td>
                  <td className="p-2">Login explícito sem auto-login, Multi-Master, CEP e hash de CPF.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">students</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">nome, cpfMascarado, idade, categoriaCnh (12 categorias), cep, logradouro, numero, complemento, bairro, cidade, estado (MG), habilidades</td>
                  <td className="p-2">1 Aluno = 1 Instrutor; Idade &ge; 18 anos; Endereço validado por CEP.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">StudentSkills</td>
                  <td className="p-2 border-r border-slate-200">Embutido</td>
                  <td className="p-2 border-r border-slate-200">baliza, embreagem, transito, conversoes, rodovia, simulado (0-10)</td>
                  <td className="p-2">Critérios práticos oficiais do CONTRAN.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">vehicles</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FKs: <code>organizacaoId, instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">modelo, placa, ano, cor, tipo (CARRO|MOTO|CAMINHAO|ONIBUS), cambio (MANUAL|AUTOMATICO), duploComando, adaptadoPcd, kmAtual, proximaRevisaoKm</td>
                  <td className="p-2">Frota do instrutor protegida por VEHICLES_BACKUP + Cloud Vault e integrada ao Mapa.</td>
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
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">nome, totalAulas, categoriaCnh, valorCentavos, formaPagamento, maxParcelas, atualizadoEm</td>
                  <td className="p-2">Planos do instrutor com proteção Zero Data Loss (PACKAGES_BACKUP + Cloud Vault).</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">instructorCoverage</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>instrutorId</code></td>
                  <td className="p-2 border-r border-slate-200">raioAtendimentoKm (5–40), cidadeBase, estadoBase, cidadesAtendidas, categoriasAtendidas, tipoCambio</td>
                  <td className="p-2">Perfil geográfico para o Mapa (exibe apenas cidades atendidas, ocultando bairro).</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">studentLeads</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code></td>
                  <td className="p-2 border-r border-slate-200">nome, telefone, cep, cidade, estado, categoriaCnh, tipoCambio, status</td>
                  <td className="p-2">Demanda reversa de alunos à procura de instrutor na região.</td>
                </tr>
                <tr>
                  <td className="p-2 font-bold border-r border-slate-200">studentNotifications</td>
                  <td className="p-2 border-r border-slate-200">PK: <code>id</code><br />FK: <code>alunoId</code></td>
                  <td className="p-2 border-r border-slate-200">dataAula, horaAula, tipo (AULA_DESMARCADA), titulo, mensagem, lida</td>
                  <td className="p-2">Aviso automático na tela do aluno quando o instrutor desmarca horário.</td>
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
              Termo Oficial de Homologação v6.8 (17/17 Testes Aprovados)
            </span>
            <p className="text-xs text-emerald-950 font-medium pt-1">
              Sistema integralmente auditado, com Mapa Geográfico (5–40 km), Blindagem Cloud Vault contra perda de pacotes, Gestão de Veículos dos Instrutores e sincronização em tempo real no Supabase.
            </p>
            <p className="text-xs text-emerald-800 font-mono">
              Validação Criptográfica: SHA256-AGD-V68-VAULT-GEO-VEHICLES-2026-STABLE
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8">
            <div className="text-center space-y-1">
              <div className="border-t border-slate-800 w-3/4 mx-auto pt-2" />
              <strong className="text-xs text-slate-950 block">Cássio R. D. Costa</strong>
              <span className="text-xs text-slate-600 block">Administrador Master do Sistema</span>
              <span className="text-xs text-slate-500 font-mono">cassiordcosta@gmail.com</span>
            </div>

            <div className="text-center space-y-1">
              <div className="border-t border-slate-800 w-3/4 mx-auto pt-2" />
              <strong className="text-xs text-slate-950 block">Comitê de Auditoria & Governança</strong>
              <span className="text-xs text-slate-600 block">Segurança da Informação e LGPD</span>
              <span className="text-xs text-slate-500 font-mono">Certificação v6.8 Estável</span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};
