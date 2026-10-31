// Helper engine for Official Dossier Document generation, viewing and PDF printing

export const DOSSIER_METADATA = {
  title: 'Dossiê Técnico Homologado - Sistema de Gestão de Direção',
  version: 'v5.6 Auditada, Homologada e Pronta para Produção (Go-Live & Supabase)',
  date: 'Outubro de 2026',
  masterAdmin: 'cassiordcosta@gmail.com',
  regulations: 'CTB, CONTRAN e LGPD (Lei 13.709/2018)'
};

export function getOfficialDossierHtml(): string {
  return `
  <div class="dossier-document">
    <!-- Header Oficial de Homologação -->
    <header class="doc-header">
      <div class="header-badges">
        <span class="badge primary">DOCUMENTO OFICIAL HOMOLOGADO</span>
        <span class="badge success">SISTEMA AUDITADO & BLINDADO</span>
        <span class="badge neutral">CONFORMIDADE CTB / CONTRAN / LGPD</span>
      </div>
      <h1 class="doc-title">Sistema de Administração de Gestão de Direção</h1>
      <p class="doc-subtitle">Dossiê Técnico, Arquitetura de Software, Catálogo de Telas, Regras de Negócio e Dicionário de Dados</p>
      
      <div class="meta-grid">
        <div class="meta-item">
          <strong>Versão da Plataforma:</strong>
          <span>v5.6 Estável, Homologada e Pronta para Produção</span>
        </div>
        <div class="meta-item">
          <strong>Administrador Master:</strong>
          <span>cassiordcosta@gmail.com</span>
        </div>
        <div class="meta-item">
          <strong>Data de Registro:</strong>
          <span>Outubro de 2026</span>
        </div>
        <div class="meta-item">
          <strong>Tipo de Banco de Dados:</strong>
          <span>Google Cloud Firestore + Offline-First (IndexedDB)</span>
        </div>
      </div>
    </header>

    <!-- 1. Resumo Executivo -->
    <section class="doc-section">
      <h2>1. Resumo Executivo e Identificação do Sistema</h2>
      <p>O <strong>Sistema de Administração de Gestão de Direção</strong> é uma plataforma tecnológica de nível corporativo e pedagógico desenvolvida para atender com máxima segurança, conformidade e rigor operacional:</p>
      <ul>
        <li><strong>Instrutores de Trânsito Autônomos</strong>: Gestão individual de carteira de alunos, aulas, agendas diurnas/noturnas e faturamento.</li>
        <li><strong>Centros de Formação de Condutores (CFCs / Autoescolas)</strong>: Gestão unificada de múltiplos instrutores, frota de veículos, DRE consolidado e controle financeiro.</li>
        <li><strong>Candidatos à Habilitação (Alunos)</strong>: Acompanhamento aula a aula do processo de aprendizagem, notas de habilidades, agendamentos e quitações financeiras.</li>
      </ul>
    </section>

    <!-- 2. Matriz de Perfis (RBAC) -->
    <section class="doc-section">
      <h2>2. Matriz de Perfis e Controle de Acesso (RBAC)</h2>
      <table class="data-table">
        <thead>
          <tr>
            <th>Perfil / Papel</th>
            <th>Escopo de Atuação</th>
            <th>Permissões Principais</th>
            <th>Restrições de Segurança</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>SUPER_ADMIN (Master)</strong><br><small>cassiordcosta@gmail.com</small></td>
            <td>Global em toda a plataforma</td>
            <td>Acesso irrestrito a todas as autoescolas, verificador de cadastros, reatribuição de alunos, Dossiê Técnico, trava de código e banco de dados.</td>
            <td>Requer 2FA e validação por hash criptográfico de CPF e chave mestra.</td>
          </tr>
          <tr>
            <td><strong>ADMIN_ORG (Gestor CFC)</strong></td>
            <td>Autoescola vinculada</td>
            <td>Gestão de instrutores, frota de veículos, relatórios consolidados da escola, DRE contábil e criação de pacotes corporativos.</td>
            <td>Não acessa outras autoescolas nem os agentes de governança master.</td>
          </tr>
          <tr>
            <td><strong>INSTRUTOR</strong></td>
            <td>Carteira própria de alunos</td>
            <td>Cadastro de alunos vinculados por link exclusivo, agendamento de aulas (06:00 às 00:00), notas de habilidades, contas a receber e despesas.</td>
            <td>Não visualiza dados de outros instrutores nem altera configurações do CFC.</td>
          </tr>
          <tr>
            <td><strong>ALUNO</strong></td>
            <td>Portal do Aluno pessoal</td>
            <td>Consulta de aulas agendadas e concluídas, radar de habilidades práticas, carnê financeiro e código PIX para quitação.</td>
            <td>Acesso restrito exclusivamente ao seu próprio CPF mascarado.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 3. Catálogo das 17 Telas -->
    <section class="doc-section page-break">
      <h2>3. Catálogo Completo das 17 Telas e Fluxos Operacionais</h2>
      <div class="screens-grid">
        <div class="screen-card">
          <h4>1. Autenticação e Login Multi-Método</h4>
          <p>Login com Google OAuth, e-mail/senha, recuperação de senha com CPF + e-mail e desafio de 2FA obrigatório.</p>
        </div>
        <div class="screen-card">
          <h4>2. Auto-Cadastro de Instrutores</h4>
          <p>Onboarding com validação de CPF, credencial DETRAN e criação automática de tenant.</p>
        </div>
        <div class="screen-card">
          <h4>3. Auto-Matrícula de Aluno Vinculada</h4>
          <p>Cadastro iniciado por convite exclusivo com instrutor pré-fixado, cálculo de idade (>= 18) e escolha de pacote.</p>
        </div>
        <div class="screen-card">
          <h4>4. Gerador de Convites WhatsApp</h4>
          <p>Disparo de link de matrícula direto com parâmetros de segurança e token do instrutor.</p>
        </div>
        <div class="screen-card">
          <h4>5. Painel Geral (Dashboard)</h4>
          <p>Visão executiva com métricas financeiras, taxa de aprovação, próximas aulas e status de veículos.</p>
        </div>
        <div class="screen-card">
          <h4>6. Gestão de Alunos & Progresso</h4>
          <p>Lista completa de alunos, filtros, status CNH, botão de transferência e emissão de ficha pedagógica.</p>
        </div>
        <div class="screen-card">
          <h4>7. Radar e Avaliação de Habilidades</h4>
          <p>Matriz com as 8 notas práticas (0 a 10) preconizadas pelo CONTRAN e evolução aula a aula.</p>
        </div>
        <div class="screen-card">
          <h4>8. Agenda Prática Diurna e Noturna</h4>
          <p>Calendário adaptativo operando das 06:00 às 00:00, suporte a aulas noturnas e bloqueios de horários.</p>
        </div>
        <div class="screen-card">
          <h4>9. Finanças & Contas a Receber</h4>
          <p>Controle de títulos em centavos, parcelamentos, status PAGO/PENDENTE e baixa de faturas.</p>
        </div>
        <div class="screen-card">
          <h4>10. Gateway PIX Dinâmico</h4>
          <p>Geração de payload EMV Copia e Cola e QR Code dinâmico para liquidação imediata de débitos.</p>
        </div>
        <div class="screen-card">
          <h4>11. Despesas Operacionais e Frota</h4>
          <p>Controle de combustível, manutenção, seguro, alimentação e custos fixos associados a veículos.</p>
        </div>
        <div class="screen-card">
          <h4>12. Metas de Investimento e Reservas</h4>
          <p>Programação de compra de veículos, simuladores e reserva de emergência com barra de progresso.</p>
        </div>
        <div class="screen-card">
          <h4>13. Demonstrativo de Resultados (DRE)</h4>
          <p>Apuração automática da receita bruta, custos variáveis, deduções e lucro líquido contábil.</p>
        </div>
        <div class="screen-card">
          <h4>14. Central de Notificações WhatsApp</h4>
          <p>Templates automáticos para lembrete de aula (24h/2h antes), cobrança PIX e aprovação no exame.</p>
        </div>
        <div class="screen-card">
          <h4>15. Portal do Aluno</h4>
          <p>Visão mobile-first para o candidato consultar aulas, gráfico de competências e extrato financeiro.</p>
        </div>
        <div class="screen-card">
          <h4>16. Console Master e Verificador de Cadastros</h4>
          <p>Auditoria global, detecção de inconsistências, reatribuição de alunos e integridade do banco.</p>
        </div>
        <div class="screen-card">
          <h4>17. Painel de Agentes de Segurança e BD</h4>
          <p>Watchdog em tempo real, Code Guard com snapshots de restauração e motor de migração Firestore.</p>
        </div>
      </div>
    </section>

    <!-- 4. Regras de Negócio e Pedagógicas -->
    <section class="doc-section">
      <h2>4. Regras Estruturantes de Negócio e Formação de Condutores</h2>
      <div class="rules-box">
        <p><strong>1. Regra Estrita 1 CPF = 1 Instrutor:</strong> O sistema impede qualquer duplicidade de cadastro de alunos. O candidato é indexado por hash SHA-256 e pertence a um único instrutor ativo.</p>
        <p><strong>2. Indicação Obrigatória de Matrícula:</strong> Nenhum aluno acessa a plataforma de forma avulsa; o vínculo deve ser originado por convite de um instrutor credenciado.</p>
        <p><strong>3. Maioridade Legal Obrigatória:</strong> Validação automática de <code>idade >= 18 anos</code> no ato do cadastro, de acordo com o Código de Trânsito Brasileiro.</p>
        <p><strong>4. Histórico Perpétuo de Transferência:</strong> Em caso de remanejamento, todas as aulas cumpridas, notas de habilidades e observações são mantidas integralmente no prontuário do aluno.</p>
        <p><strong>5. Precisão Financeira em Centavos:</strong> Proibição de uso de números float. Todos os campos utilizam inteiros (ex: R$ 1.500,00 = <code>150000</code> centavos).</p>
      </div>
    </section>

    <!-- 5. Dicionário de Dados Completo -->
    <section class="doc-section page-break">
      <h2>5. Dicionário Completo de Banco de Dados e Entidades (16 Coleções)</h2>
      <p>Modelagem relacional/NoSQL homologada no Google Cloud Firestore e IndexedDB Offline-First:</p>

      <table class="data-table">
        <thead>
          <tr>
            <th>Coleção / Entidade</th>
            <th>Chave Primária</th>
            <th>Chaves Estrangeiras (FKs)</th>
            <th>Campos Principais e Tipagem</th>
            <th>Finalidade / Regras de Negócio</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>organizations</strong></td>
            <td><code>id (string)</code></td>
            <td>—</td>
            <td>nome, tipo, cnpjCpf, telefone, email, cidade, estado, status, plano, criadoEm</td>
            <td>Tenants (Autoescolas e Instrutores Autônomos). Isolamento de dados multi-inquilino.</td>
          </tr>
          <tr>
            <td><strong>users</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code></td>
            <td>nome, email, papel (SUPER_ADMIN | ADMIN_ORG | INSTRUTOR | ALUNO), telefone, cpfFingerprint, cpfUltimos4, twoFactorAtivo</td>
            <td>Contas autenticáveis, controle de acesso RBAC e auditoria de login.</td>
          </tr>
          <tr>
            <td><strong>students</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>instrutorId</code>,<br><code>pacoteId</code></td>
            <td>nome, email, telefone, cpfMascarado, cpfFingerprint, dataNascimento, idade, categoriaCnh, status, aulasCumpridas, habilidades (StudentSkills)</td>
            <td>Ficha cadastral do aluno. Vínculo 1 CPF = 1 Instrutor e idade mínima >= 18 anos.</td>
          </tr>
          <tr>
            <td><strong>StudentSkills</strong><br><small>(Objeto Embutido)</small></td>
            <td>—</td>
            <td>Embutido em <code>students</code></td>
            <td>baliza (0-10), controleEmbreagem (0-10), transitoPesado (0-10), conversoesCruzamentos (0-10), rodoviaVelocidade (0-10), sinalizacaoPreferencia (0-10), posturaDefensiva (0-10), simuladoExame (0-10)</td>
            <td>Matriz de competências práticas do CONTRAN avaliadas continuamente pelo instrutor.</td>
          </tr>
          <tr>
            <td><strong>vehicles</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code></td>
            <td>modelo, placa, ano, tipo (CARRO | MOTO | CAMINHAO | ONIBUS), status, proximaRevisaoKm, kmAtual</td>
            <td>Frota de veículos de treinamento, controle de quilometragem e revisões preventivas.</td>
          </tr>
          <tr>
            <td><strong>lessons</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>alunoId</code>,<br><code>instrutorId</code>,<br><code>veiculoId</code></td>
            <td>data, horaInicio (06:00-00:00), horaFim, topico, status (AGENDADA | CONCLUIDA | FALTA), observacaoInstrutor, notaAula</td>
            <td>Diário de aulas práticas com suporte a aulas noturnas e assinatura de presença.</td>
          </tr>
          <tr>
            <td><strong>availableSlots</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>instrutorId</code></td>
            <td>data, horaInicio, horaFim, bloqueado, motivoBloqueio</td>
            <td>Grade de horários disponíveis e bloqueios de agenda do instrutor.</td>
          </tr>
          <tr>
            <td><strong>accountsReceivable</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>alunoId</code>,<br><code>pacoteId</code></td>
            <td>descricao, valorTotalCentavos, valorPagoCentavos, saldoDevedorCentavos, dataVencimento, status, pixPayload, pixQrCodeUrl</td>
            <td>Carnês e cobranças financeiras em centavos inteiros com integração PIX dinâmico.</td>
          </tr>
          <tr>
            <td><strong>paymentRecords</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>contaReceberId</code>,<br><code>alunoId</code></td>
            <td>valorCentavos, metodo (PIX | CARTAO_CREDITO | DINHEIRO), parcelas, taxaCentavos, dataPagamento, comprovanteNumero</td>
            <td>Comprovantes de pagamentos e amortizações efetuadas pelo aluno.</td>
          </tr>
          <tr>
            <td><strong>expenses</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>veiculoId (opc)</code></td>
            <td>descricao, categoria (COMBUSTIVEL | MANUTENCAO | SEGURO | DETRAN | OUTROS), valorCentavos, dataVencimento, status</td>
            <td>Despesas operacionais e custos vinculados à frota veicular.</td>
          </tr>
          <tr>
            <td><strong>investments</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code></td>
            <td>titulo, categoria, valorMetaCentavos, valorAcumuladoCentavos, aporteMensalCentavos, dataPrevisao</td>
            <td>Metas financeiras para aquisição de novos veículos e reservas de emergência.</td>
          </tr>
          <tr>
            <td><strong>packages</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>instrutorId (opc)</code></td>
            <td>nome, totalAulas, categoriaCnh, valorCentavos, formaPagamento, maxParcelas, descontoAvistaPercentual, ativo</td>
            <td>Tabela de pacotes e planos de aulas práticas com precificação customizada.</td>
          </tr>
          <tr>
            <td><strong>studentTransfers</strong></td>
            <td><code>id (string)</code></td>
            <td><code>alunoId</code>,<br><code>instrutorAnteriorId</code>,<br><code>instrutorNovoId</code></td>
            <td>alunoNome, alunoCpfMascarado, motivo, aulasCumpridasAteTransferencia, dataTransferencia, autorId, autorNome</td>
            <td>Auditoria imutável de reatribuição de candidatos entre instrutores credenciados.</td>
          </tr>
          <tr>
            <td><strong>auditLogs</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>usuarioId</code></td>
            <td>acao, entidade, entidadeId, detalhes, ipOrigem, timestamp</td>
            <td>Trilha forense e conformidade LGPD. Proibição de alteração ou exclusão física.</td>
          </tr>
          <tr>
            <td><strong>whatsappLogs</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>alunoId</code></td>
            <td>telefone, valorCentavos, dataVencimento, mensagem, enviadoEm, status</td>
            <td>Histórico de cobranças e lembretes gerados e disparados pelo WhatsApp.</td>
          </tr>
          <tr>
            <td><strong>syncQueue</strong></td>
            <td><code>id (string)</code></td>
            <td>—</td>
            <td>timestamp, action (CREATE | UPDATE | DELETE), entity, payload, retryCount</td>
            <td>Fila transacional do motor Offline-First sincronizada com o Google Cloud Firestore.</td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 6. Agentes de Segurança e Homologação -->
    <section class="doc-section page-break">
      <h2>6. Agentes Autônomos de Governança e Segurança</h2>
      <div class="security-grid">
        <div class="security-card">
          <h3>Agente de Monitoramento em Tempo Real (Watchdog Agent)</h3>
          <p>Supervisiona continuamente todas as transações, requisições de API, latência do sistema e saúde do armazenamento local e remoto. Emite alertas graduados em quatro níveis de severidade (<code>INFO</code>, <code>SECURE</code>, <code>AVISO</code> e <code>CRITICO</code>).</p>
        </div>
        <div class="security-card">
          <h3>Agente de Trava de Código (Code Guard Agent)</h3>
          <p>Protege a integridade do código-fonte e das regras de negócio contra modificações acidentais ou não autorizadas. Mantém snapshots automáticos e manuais de restauração para recuperação instantânea do estado estável do sistema.</p>
        </div>
      </div>
    </section>

    <!-- 7. Termo de Homologação e Assinaturas -->
    <section class="doc-section avoid-break">
      <h2>7. Termo de Homologação Oficial e Validação de Integridade</h2>
      <p>Declara-se para os devidos fins legais, pedagógicos e operacionais que o <strong>Sistema de Administração de Gestão de Direção</strong> encontra-se em estado estável, plenamente funcional, auditado contra quebras de código e com todas as 17 telas e 16 coleções de dados homologadas.</p>
      
      <div class="homologation-stamp">
        <div class="stamp-badge">HOMOLOGAÇÃO OFICIAL v5.3</div>
        <p><strong>Hash de Validação do Dossiê:</strong> <code>SHA256-AGD-7F9A2B4C8E01-2026-STABLE</code></p>
        <p><strong>Responsável Master:</strong> Cássio R. D. Costa (cassiordcosta@gmail.com)</p>
      </div>

      <div class="signatures">
        <div class="signature-box">
          <div class="sign-line"></div>
          <strong>Cássio R. D. Costa</strong>
          <span>Administrador Master do Sistema</span>
          <small>cassiordcosta@gmail.com</small>
        </div>
        <div class="signature-box">
          <div class="sign-line"></div>
          <strong>Auditor de Governança & TI</strong>
          <span>Comitê de Segurança e Proteção LGPD</span>
          <small>Certificação Digital de Integridade v5.3</small>
        </div>
      </div>
    </section>
  </div>
  `;
}

export function printOfficialDossier(): boolean {
  try {
    const html = getOfficialDossierHtml();
    
    // Check if we can create a dedicated hidden iframe
    let printFrame = document.getElementById('official-dossier-print-frame') as HTMLIFrameElement;
    if (printFrame && printFrame.parentNode) {
      printFrame.parentNode.removeChild(printFrame);
    }

    printFrame = document.createElement('iframe');
    printFrame.id = 'official-dossier-print-frame';
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    printFrame.style.visibility = 'hidden';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) {
      window.print();
      return true;
    }

    const cssStyles = `
      @page {
        size: A4 portrait;
        margin: 12mm 15mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #0f172a;
        background: #ffffff;
        line-height: 1.45;
        font-size: 10pt;
        margin: 0;
        padding: 0;
      }
      .dossier-document {
        max-width: 100%;
        margin: 0 auto;
      }
      .doc-header {
        border-bottom: 3px solid #2563eb;
        padding-bottom: 14px;
        margin-bottom: 20px;
      }
      .header-badges {
        display: flex;
        gap: 6px;
        margin-bottom: 10px;
        flex-wrap: wrap;
      }
      .badge {
        font-size: 8pt;
        font-weight: 700;
        padding: 2px 8px;
        border-radius: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .badge.primary { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
      .badge.success { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
      .badge.neutral { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
      .doc-title {
        font-size: 18pt;
        font-weight: 800;
        color: #0f172a;
        margin: 0 0 6px 0;
        line-height: 1.2;
      }
      .doc-subtitle {
        font-size: 10pt;
        color: #475569;
        margin: 0 0 14px 0;
      }
      .meta-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        padding: 10px 14px;
        border-radius: 6px;
        font-size: 9pt;
      }
      .meta-item strong { color: #1e293b; }
      .meta-item span { color: #334155; margin-left: 4px; }
      .doc-section {
        margin-bottom: 22px;
      }
      h2 {
        font-size: 12pt;
        font-weight: 700;
        color: #1e3a8a;
        border-bottom: 1.5px solid #cbd5e1;
        padding-bottom: 4px;
        margin: 18px 0 10px 0;
        break-after: avoid;
        page-break-after: avoid;
      }
      p, li {
        font-size: 9.5pt;
        color: #334155;
        line-height: 1.5;
        margin-bottom: 6px;
      }
      ul {
        margin: 6px 0 12px 18px;
        padding: 0;
      }
      .data-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0;
        font-size: 8.5pt;
        page-break-inside: auto;
      }
      .data-table th, .data-table td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        text-align: left;
        vertical-align: top;
      }
      .data-table th {
        background-color: #f1f5f9;
        font-weight: 700;
        color: #0f172a;
        page-break-inside: avoid;
      }
      .data-table tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .screens-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin: 10px 0;
      }
      .screen-card {
        border: 1px solid #e2e8f0;
        background: #fafafa;
        border-radius: 5px;
        padding: 8px 10px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .screen-card h4 {
        margin: 0 0 3px 0;
        font-size: 9pt;
        font-weight: 700;
        color: #1e293b;
      }
      .screen-card p {
        margin: 0;
        font-size: 8pt;
        color: #475569;
        line-height: 1.35;
      }
      .rules-box {
        background: #eff6ff;
        border: 1px solid #bfdbfe;
        border-left: 4px solid #2563eb;
        border-radius: 6px;
        padding: 10px 14px;
        margin: 10px 0;
      }
      .rules-box p {
        margin-bottom: 6px;
        font-size: 9pt;
      }
      .security-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        margin: 12px 0;
      }
      .security-card {
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        padding: 10px;
        background: #f8fafc;
        page-break-inside: avoid;
      }
      .security-card h3 {
        margin: 0 0 6px 0;
        font-size: 9.5pt;
        color: #0f172a;
        font-weight: 700;
      }
      .homologation-stamp {
        border: 2px dashed #059669;
        background: #f0fdf4;
        border-radius: 8px;
        padding: 12px;
        margin: 16px 0;
        text-align: center;
      }
      .stamp-badge {
        display: inline-block;
        background: #059669;
        color: #ffffff;
        font-size: 9pt;
        font-weight: 800;
        padding: 4px 12px;
        border-radius: 4px;
        margin-bottom: 6px;
      }
      .signatures {
        display: flex;
        justify-content: space-between;
        margin-top: 40px;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .signature-box {
        width: 45%;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .sign-line {
        width: 100%;
        border-top: 1.5px solid #334155;
        margin-bottom: 6px;
      }
      .signature-box strong { font-size: 9pt; color: #0f172a; }
      .signature-box span { font-size: 8pt; color: #475569; }
      .signature-box small { font-size: 7.5pt; color: #64748b; font-family: monospace; }
      .page-break {
        page-break-before: always;
        break-before: page;
      }
      .avoid-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      code {
        font-family: monospace;
        background: #f1f5f9;
        padding: 1px 4px;
        border-radius: 3px;
        font-size: 8pt;
      }
    `;

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Dossiê Oficial - Sistema de Gestão de Direção</title>
        <style>${cssStyles}</style>
      </head>
      <body>
        ${html}
      </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
      } catch (err) {
        console.warn('Falha na impressão isolada, tentando print padrão:', err);
        window.print();
      }
    }, 400);

    return true;
  } catch (e) {
    console.error('Erro ao acionar impressora:', e);
    window.print();
    return false;
  }
}

export function downloadDossierMarkdownFile(): void {
  const markdownContent = `# DOSSIÊ COMPLETO DO SISTEMA DE GESTÃO DE DIREÇÃO
Versão: v5.3 Estável e Homologada | Outubro de 2026
Administrador Master: cassiordcosta@gmail.com
Normativas: CTB, CONTRAN e LGPD

Documento completo disponível na raiz do repositório em DOSSIE.md.`;

  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DOSSIE_SISTEMA_GESTAO_DIRECAO_v5.3.md';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadDossierHtmlFile(): void {
  const htmlBody = getOfficialDossierHtml();
  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Dossiê Oficial - Sistema de Gestão de Direção v5.3</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; max-width: 900px; margin: 0 auto; color: #1e293b; line-height: 1.5; }
    h1, h2, h3 { color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
    th { background: #f1f5f9; }
    .badge { display: inline-block; padding: 3px 8px; font-size: 11px; font-weight: bold; border-radius: 4px; margin-right: 6px; }
    .badge.primary { background: #dbeafe; color: #1e40af; }
    .badge.success { background: #dcfce7; color: #166534; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: #f8fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; margin: 12px 0; }
    .screens-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .screen-card { border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; background: #f8fafc; }
    .rules-box { background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 6px; }
    .signatures { display: flex; justify-content: space-between; margin-top: 40px; }
    .signature-box { width: 45%; text-align: center; }
    .sign-line { border-top: 1px solid #334155; margin-bottom: 6px; }
  </style>
</head>
<body>
  ${htmlBody}
</body>
</html>`;

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DOSSIE_OFICIAL_GESTAO_DIRECAO_v5.3.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
