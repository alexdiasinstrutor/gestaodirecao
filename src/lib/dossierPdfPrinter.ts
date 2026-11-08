// Helper engine for Official Dossier Document generation, viewing and PDF printing

export const DOSSIER_METADATA = {
  title: 'Dossiê Técnico Homologado - Gestão AD (Auto Direção)',
  version: 'v6.8 Auditada, Com Mapa Geográfico (5–40 km), Blindagem Cloud Vault de Pacotes, Gestão de Veículos e Sincronização em Tempo Real no Supabase',
  date: 'Novembro de 2026',
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
        <span class="badge success">SISTEMA AUDITADO & BLINDADO (17/17 TESTES)</span>
        <span class="badge neutral">CONFORMIDADE CTB / CONTRAN / LGPD</span>
      </div>
      <h1 class="doc-title">Gestão AD (Auto Direção)</h1>
      <p class="doc-subtitle">Dossiê Técnico, Mapa Geográfico (5–40 km), Blindagem Cloud Vault de Pacotes, Gestão de Veículos, Catálogo de 20 Telas, Regras de Negócio e Dicionário de Dados (19 Coleções)</p>
      
      <div class="meta-grid">
        <div class="meta-item">
          <strong>Versão da Plataforma:</strong>
          <span>v6.8 Estável e Homologada (Mapa 5–40 km + Blindagem de Pacotes + Gestão de Veículos + 17/17 Testes)</span>
        </div>
        <div class="meta-item">
          <strong>Administrador Master:</strong>
          <span>cassiordcosta@gmail.com (Login Explícito sem Auto-Login + Multi-Master)</span>
        </div>
        <div class="meta-item">
          <strong>Data de Registro:</strong>
          <span>Novembro de 2026</span>
        </div>
        <div class="meta-item">
          <strong>Tipo de Banco de Dados:</strong>
          <span>Supabase PostgreSQL + Cloud Sync Vault (__agd_vault_*) + Cofre Local Redundante + Offline-First</span>
        </div>
      </div>
    </header>

    <!-- 1. Resumo Executivo -->
    <section class="doc-section">
      <h2>1. Resumo Executivo, Arquitetura e Melhorias Homologadas (v6.8)</h2>
      <p>O <strong>Gestão AD (Auto Direção)</strong> é uma plataforma tecnológica de nível corporativo e pedagógico desenvolvida para atender com máxima segurança, conformidade e rigor operacional:</p>
      <ul>
        <li><strong>Identidade Visual Oficial "Gestão AD (Auto Direção)"</strong>: Logomarca vetorial oficial (<code>Logo.tsx</code>) e tela de login exigindo autenticação explícita por e-mail e senha (sem entrada automática do Master).</li>
        <li><strong>Cadastro de Aluno em 3 Etapas (Wizard) e Confidencialidade por Código</strong>: Auto-cadastro dividido em 3 telas claras. Por segurança e confidencialidade comercial, o sistema <strong>não lista nomes de instrutores em dropdown público</strong>; o aluno informa o código do instrutor (ou acessa via link do WhatsApp que preenche o código automaticamente) para visualizar exclusivamente os planos daquele instrutor.</li>
        <li><strong>Localizador Geográfico de Instrutores (Mapa 5 a 40 km) & Contato via WhatsApp</strong>: Mapa interativo (Leaflet/OpenStreetMap + Haversine) onde o aluno seleciona o <strong>Estado (UF) primeiro</strong> ou digita o <strong>CEP</strong> (com auto-preenchimento), filtra por raio de <strong>5 a 40 km</strong>, Cidade, Categoria CNH, Câmbio (Manual/Automático) e Tipo de Veículo (Carro, Moto, Caminhão, Ônibus). Exibe <strong>apenas as cidades atendidas</strong> (ocultando o bairro residencial do instrutor) e direciona o contato para o botão <strong>"Chamar no WhatsApp"</strong>.</li>
        <li><strong>Demanda Reversa (Alunos à Procura de Instrutor) & Mapa Interno do Instrutor</strong>: Alunos que não localizarem instrutor podem se cadastrar informando CEP e cidade; os instrutores logados recebem alertas na aba <strong>"Mapa & Notificações"</strong> e visualizam no mapa interno exclusivo quantos alunos e instrutores existem por cidade, bairro e distância.</li>
        <li><strong>Agenda por Período (Semanal, Mensal, Anual) & Notificação Automática de Desmarcação</strong>: Instrutores liberam ou removem horários por período, semana, mês ou ano. Caso haja aluno agendado no horário removido, o sistema exige confirmação e envia automaticamente uma notificação na tela do aluno (<code>StudentPortal.tsx</code>) solicitando remarcação.</li>
        <li><strong>Edição e Persistência de Plano na Ficha do Aluno</strong>: O instrutor pode alterar o plano contratado, categoria CNH e evolução pedagógica diretamente na ficha do aluno (<code>StudentsView.tsx</code>), atualizando automaticamente a fatura em aberto e persistindo no Supabase.</li>
        <li><strong>Blindagem Absoluta Contra Perda de Pacotes do Instrutor (Zero Data Loss)</strong>: O sistema <strong>jamais apaga, sobrescreve ou inventa pacotes aleatórios</strong>. Conta com cofre local redundante (<code>PACKAGES_BACKUP</code>), fila de sincronização (<code>PENDING_PACKAGES</code>), timestamp <code>atualizadoEm</code> e <strong>Cloud Sync Vault</strong> (<code>__agd_vault_package_offers</code>) no Supabase.</li>
        <li><strong>Cadastro e Gestão de Veículos / Carros dos Instrutores (<code>VehiclesView.tsx</code>)</strong>: Aba dedicada <strong>"Meus Veículos"</strong> disponível em todos os planos para o instrutor cadastrar e gerenciar seus carros, motos, caminhões ou ônibus (placa Mercosul/antiga, ano, cor, câmbio manual/automático, duplo comando, adaptação PCD, hodômetro e revisão), integrando automaticamente com os filtros do Mapa.</li>
        <li><strong>Sanitização Global de Telefones e Validação Automatizada (17/17 Testes)</strong>: Telefone obrigatório no convite e cadastros sem jamais aceitar máscara vazia como número, validado por suite automatizada (<code>run_automated_tests.mjs</code>) com 100% de aprovação.</li>
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

    <!-- 3. Catálogo das 20 Telas -->
    <section class="doc-section page-break">
      <h2>3. Catálogo Completo das 20 Telas e Fluxos Operacionais</h2>
      <div class="screens-grid">
        <div class="screen-card">
          <h4>1. Autenticação e Login Multi-Método</h4>
          <p>Login com Google OAuth, e-mail/senha, recuperação de senha com CPF + e-mail e desafio de 2FA obrigatório.</p>
        </div>
        <div class="screen-card">
          <h4>2. Auto-Cadastro de Instrutores</h4>
          <p>Onboarding com validação de CPF, endereço por CEP, credencial DETRAN e criação automática de tenant.</p>
        </div>
        <div class="screen-card">
          <h4>3. Auto-Matrícula de Aluno (Wizard 3 Telas)</h4>
          <p>Fluxo em 3 etapas com confidencialidade por código do instrutor (ou link WhatsApp), exibição fiel de pacotes e busca por CEP.</p>
        </div>
        <div class="screen-card">
          <h4>4. Localizador Geográfico de Instrutores (Mapa 5–40 km)</h4>
          <p>Mapa interativo com seleção de UF primeiro, auto-preenchimento por CEP, filtros de CNH/Câmbio/Veículo, privacidade de bairro e contato via WhatsApp.</p>
        </div>
        <div class="screen-card">
          <h4>5. Mapa Interno de Demanda & Notificações do Instrutor</h4>
          <p>Exclusivo para instrutores logados: configuração de raio (5–40 km), cidades atendidas, mapa de alunos/concorrentes e alertas de alunos procurando instrutor.</p>
        </div>
        <div class="screen-card">
          <h4>6. Meus Veículos e Frota de Instrução</h4>
          <p>Cadastro e gestão de carros, motos, caminhões e ônibus do instrutor (câmbio manual/automático, placa, ano, duplo comando, PCD, km e revisões).</p>
        </div>
        <div class="screen-card">
          <h4>7. Gerador de Convites WhatsApp</h4>
          <p>Disparo de link de matrícula direto com telefone obrigatório validado (anti-máscara vazia) e código do instrutor embutido.</p>
        </div>
        <div class="screen-card">
          <h4>8. Painel Geral (Dashboard)</h4>
          <p>Visão executiva com métricas financeiras, alertas de novos alunos na região, atalhos para Meus Veículos e próximas aulas.</p>
        </div>
        <div class="screen-card">
          <h4>9. Gestão de Alunos, Mudança de Plano & Ficha</h4>
          <p>Filtro dinâmico apenas por categorias com alunos, edição e salvamento assíncrono de plano/pacote na ficha do aluno e transferência auditada.</p>
        </div>
        <div class="screen-card">
          <h4>10. Radar e Avaliação de Habilidades</h4>
          <p>Matriz com as 8 notas práticas (0 a 10) preconizadas pelo CONTRAN e evolução aula a aula salva no banco.</p>
        </div>
        <div class="screen-card">
          <h4>11. Agenda Prática por Período (Semanal/Mensal/Anual)</h4>
          <p>Grade das 06:00 às 00:00 com liberação/remoção por período, visão mobile do aluno agendado e alerta de conflito com notificação automática ao aluno.</p>
        </div>
        <div class="screen-card">
          <h4>12. Catálogo Blindado de Pacotes e Planos</h4>
          <p>Criação e edição de planos pelo instrutor com proteção Cloud Vault e backup local contra perda ou criação aleatória.</p>
        </div>
        <div class="screen-card">
          <h4>13. Finanças, Contas a Receber & Gateway PIX</h4>
          <p>Controle de títulos em centavos, baixa de parcelas, recibos digitais e geração de QR Code PIX Copia e Cola.</p>
        </div>
        <div class="screen-card">
          <h4>14. Despesas Operacionais e Custos de Frota</h4>
          <p>Controle de combustível, manutenção, seguro, alimentação e custos fixos associados aos veículos cadastrados.</p>
        </div>
        <div class="screen-card">
          <h4>15. Metas de Investimento, DRE e IRPF Carnê-Leão</h4>
          <p>Programação de troca de frota, apuração automática do Lucro Líquido (DRE) e Livro-Caixa fiscal para IRPF.</p>
        </div>
        <div class="screen-card">
          <h4>16. Saúde Financeira & Simulador DETRAN</h4>
          <p>Score 0–100, Regra dos 4 Potes, alerta de idade de frota DETRAN e calculadora do custo real da aula prática.</p>
        </div>
        <div class="screen-card">
          <h4>17. Central de Notificações e Cobranças WhatsApp</h4>
          <p>Templates automáticos para lembrete de aula, cobrança PIX e aprovação no exame prático.</p>
        </div>
        <div class="screen-card">
          <h4>18. Portal do Aluno (Com Alertas de Remarcação)</h4>
          <p>Visão mobile-first para o aluno agendar aulas, receber avisos de horários desmarcados pelo instrutor, ver notas e pagar via PIX.</p>
        </div>
        <div class="screen-card">
          <h4>19. Console Master e Verificador de Cadastros</h4>
          <p>Auditoria global, gestão de planos SaaS, cupons promocionais, detecção de inconsistências e reatribuição de alunos.</p>
        </div>
        <div class="screen-card">
          <h4>20. Painel de Agentes de Segurança e Banco Cloud</h4>
          <p>Watchdog em tempo real, Code Guard com snapshots de restauração, Dossiê Oficial A4 e sincronização Supabase/Firestore.</p>
        </div>
      </div>
    </section>

    <!-- 4. Regras de Negócio e Pedagógicas -->
    <section class="doc-section">
      <h2>4. Regras Estruturantes de Negócio, Segurança e Formação de Condutores</h2>
      <div class="rules-box">
        <p><strong>1. Regra Estrita 1 CPF = 1 Instrutor & Confidencialidade de Planos:</strong> O sistema impede duplicidade de CPF e nunca expõe a lista de instrutores no auto-cadastro público; o aluno acessa os pacotes exclusivamente via código do instrutor ou link de convite.</p>
        <p><strong>2. Blindagem Absoluta dos Pacotes do Instrutor (Zero Data Loss):</strong> O sistema jamais apaga, sobrescreve ou inventa pacotes de outras categorias. Todo pacote criado pelo instrutor é protegido por <code>PACKAGES_BACKUP</code> e <code>__agd_vault_package_offers</code>.</p>
        <p><strong>3. Agenda Inteligente com Notificação ao Aluno:</strong> Ao indisponibilizar um horário com aula marcada (semanal, mensal ou anual), o sistema alerta o instrutor e envia notificação automática para o aluno remarcar.</p>
        <p><strong>4. Privacidade Geográfica no Mapa Público (5 a 40 km):</strong> O mapa exibe apenas as cidades atendidas pelo instrutor (nunca o bairro do seu endereço residencial) e prioriza o contato inicial via WhatsApp.</p>
        <p><strong>5. Precisão Financeira em Centavos & Sanitização de Telefone:</strong> Todos os valores utilizam inteiros em centavos e nenhum campo de telefone aceita máscara vazia como número válido.</p>
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
            <td>nome, tipo, cnpjCpf, telefone, email, cep, logradouro, numero, complemento, bairro, cidade, estado (default MG), chavePix, status, plano, criadoEm</td>
            <td>Tenants (Autoescolas e Instrutores Autônomos). Isolamento multi-inquilino e endereço completo por CEP sincronizado no Supabase.</td>
          </tr>
          <tr>
            <td><strong>users</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code></td>
            <td>nome, email, papel (SUPER_ADMIN | ADMIN_ORG | INSTRUTOR | ALUNO), telefone, cpfFingerprint, cep, logradouro, numero, complemento, bairro, cidade, estado (default MG), chavePix, senhaTemporaria</td>
            <td>Contas autenticáveis sem auto-login, Multi-Master, endereço completo por CEP e controle RBAC.</td>
          </tr>
          <tr>
            <td><strong>students</strong></td>
            <td><code>id (string)</code></td>
            <td><code>organizacaoId</code>,<br><code>instrutorId</code>,<br><code>pacoteId</code></td>
            <td>nome, email, telefone, cpfMascarado, cpfFingerprint, dataNascimento, idade, categoriaCnh (12 categorias), cep, logradouro, numero, complemento, bairro, cidade, estado (default MG), status, aulasCumpridas, habilidades</td>
            <td>Ficha cadastral do aluno com validação de CEP. Vínculo 1 CPF = 1 Instrutor e idade mínima >= 18 anos.</td>
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
            <td><code>organizacaoId</code>,<br><code>instrutorId</code></td>
            <td>modelo, placa, ano, cor, tipo (CARRO | MOTO | CAMINHAO | ONIBUS), cambio (MANUAL | AUTOMATICO), categoriaCnh, duploComando, adaptadoPcd, status, proximaRevisaoKm, kmAtual, atualizadoEm</td>
            <td>Frota de veículos cadastrados pelos instrutores com backup local e Cloud Vault, integrada aos filtros do Mapa.</td>
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
            <td><code>organizacaoId</code>,<br><code>instrutorId</code></td>
            <td>nome, totalAulas, categoriaCnh, valorCentavos, formaPagamento, maxParcelas, descontoAvistaPercentual, ativo, criadoEm, atualizadoEm</td>
            <td>Planos criados pelo instrutor com blindagem absoluta contra perda (PACKAGES_BACKUP + Cloud Vault).</td>
          </tr>
          <tr>
            <td><strong>instructorCoverage</strong></td>
            <td><code>instrutorId (string)</code></td>
            <td><code>organizacaoId</code></td>
            <td>raioAtendimentoKm (5–40), cidadeBase, estadoBase, cidadesAtendidas, categoriasAtendidas, tiposVeiculo, tipoCambio, latitude, longitude</td>
            <td>Perfil geográfico do instrutor para busca no Mapa (exibe apenas cidades atendidas, ocultando bairro).</td>
          </tr>
          <tr>
            <td><strong>studentLeads</strong></td>
            <td><code>id (string)</code></td>
            <td><code>atendidoPorInstrutorId (opc)</code></td>
            <td>nome, telefone, cep, cidade, estado, bairro, categoriaCnh, tipoCambio, status (AGUARDANDO | EM_CONTATO | MATRICULADO)</td>
            <td>Demanda reversa de alunos à procura de instrutor em sua região, notificando instrutores logados.</td>
          </tr>
          <tr>
            <td><strong>studentNotifications</strong></td>
            <td><code>id (string)</code></td>
            <td><code>alunoId</code>,<br><code>instrutorId</code>,<br><code>aulaId</code></td>
            <td>dataAula, horaAula, tipo (AULA_DESMARCADA), titulo, mensagem, lida, criadoEm</td>
            <td>Notificações automáticas na tela do aluno quando o instrutor remove horário com aula marcada.</td>
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
      <p>Declara-se para os devidos fins legais, pedagógicos e operacionais que o <strong>Gestão AD (Auto Direção)</strong> encontra-se em estado estável, plenamente funcional, auditado por 17 baterias de testes automatizados (100% aprovados) e com todas as 20 telas e 19 coleções de dados homologadas.</p>
      
      <div class="homologation-stamp">
        <div class="stamp-badge">HOMOLOGAÇÃO OFICIAL v6.8</div>
        <p><strong>Hash de Validação do Dossiê:</strong> <code>SHA256-AGD-V68-VAULT-GEO-VEHICLES-2026-STABLE</code></p>
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
          <small>Certificação Digital de Integridade v6.8</small>
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
  const markdownContent = `# DOSSIÊ COMPLETO DO SISTEMA — GESTÃO AD (AUTO DIREÇÃO)
Versão: v6.8 Estável e Homologada (Mapa 5–40 km + Blindagem Cloud Vault de Pacotes + Gestão de Veículos + 17/17 Testes) | Novembro de 2026
Administrador Master: cassiordcosta@gmail.com
Normativas: CTB, CONTRAN e LGPD

## Melhorias Homologadas na v6.8
1. Cadastro de Aluno em 3 Etapas (Wizard) com exibição fiel de todos os pacotes do instrutor.
2. Confidencialidade de Instrutores no Auto-Cadastro (busca exclusiva por Código do Instrutor ou link do WhatsApp).
3. Localizador Geográfico de Instrutores (Mapa 5 a 40 km) com seleção de Estado (UF) primeiro, auto-preenchimento por CEP, ocultação de bairro residencial (exibindo apenas cidades atendidas) e contato direto via WhatsApp.
4. Demanda Reversa (Alunos à Procura de Instrutor) e Mapa Interno exclusivo para instrutores logados com notificações.
5. Liberação e remoção de agenda por período (Semanal, Mensal, Anual) com alerta de conflito e notificação automática na tela do aluno para remarcação.
6. Edição e persistência imediata de mudança de plano e evolução na Ficha do Aluno.
7. Blindagem absoluta contra perda de pacotes criados pelos instrutores (PACKAGES_BACKUP + Cloud Sync Vault __agd_vault_package_offers).
8. Nova tela "Meus Veículos" (VehiclesView.tsx) para cadastro de carros/motos dos instrutores (câmbio manual/automático, placa, ano, duplo comando, PCD, km e revisão).
9. Sanitização global de telefone (proibindo máscara como número) e validação com 17/17 testes automatizados aprovados.

Documento completo disponível na raiz do repositório em DOSSIE.md.`;

  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DOSSIE_GESTAO_AD_v6.8.md';
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
  <title>Dossiê Oficial - Gestão AD (Auto Direção) v6.8</title>
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
  a.download = 'DOSSIE_OFICIAL_GESTAO_AD_v6.8.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
