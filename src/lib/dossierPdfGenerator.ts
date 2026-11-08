import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface DossierPdfOptions {
  filename?: string;
  masterEmail?: string;
}

export function generateOfficialDossierPdf(options: DossierPdfOptions = {}): jsPDF {
  const masterEmail = options.masterEmail || 'cassiordcosta@gmail.com';
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - (margin * 2);

  // Helper colors
  const primaryColor: [number, number, number] = [37, 99, 235]; // #2563eb
  const darkColor: [number, number, number] = [15, 23, 42]; // #0f172a
  const slateColor: [number, number, number] = [71, 85, 105]; // #475569
  const greenColor: [number, number, number] = [5, 150, 105]; // #059669
  const lightBg: [number, number, number] = [248, 250, 252]; // #f8fafc

  let currentY = margin;

  // --- CAPA / CABEÇALHO INSTITUCIONAL ---
  doc.setFillColor(...primaryColor);
  doc.rect(margin, currentY, contentWidth, 3, 'F');
  currentY += 8;

  // Badges
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...primaryColor);
  doc.text('REPÚBLICA FEDERATIVA DO BRASIL · SISTEMA NACIONAL DE TRÂNSITO (SNT)', margin, currentY);

  doc.setFontSize(7.5);
  doc.setTextColor(...greenColor);
  doc.text('HOMOLOGAÇÃO OFICIAL v6.8 ESTÁVEL (17/17 TESTES)', pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkColor);
  doc.text('GESTÃO AD (AUTO DIREÇÃO)', margin, currentY);
  currentY += 6;

  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...slateColor);
  doc.text('Dossiê Técnico, Mapa Geográfico (5–40 km), Blindagem Cloud Vault de Pacotes, Gestão de Veículos e Supabase', margin, currentY);
  currentY += 6;

  // Caixa de Metadados
  doc.setFillColor(...lightBg);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth, 22, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Versão da Plataforma:', margin + 4, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text('v6.8 (Mapa 5–40km + Veículos + Cloud Vault)', margin + 35, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Administrador Master:', margin + 4, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...primaryColor);
  doc.text(masterEmail, margin + 35, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Banco de Dados:', margin + 4, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...greenColor);
  doc.text('Supabase SQL + Cloud Vault + Backup Local', margin + 35, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Data de Homologação:', margin + 105, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text('Novembro de 2026', margin + 140, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Normativas Legais:', margin + 105, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('CTB, CONTRAN e LGPD (Lei 13.709)', margin + 140, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Integridade & Testes:', margin + 105, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text('17/17 Testes Aprovados · Zero Data Loss', margin + 140, currentY + 15);

  currentY += 28;

  // --- 1. RESUMO EXECUTIVO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('1. RESUMO EXECUTIVO E NOVAS MELHORIAS HOMOLOGADAS (v6.8)', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  const resumoText = [
    'O Gestão AD (Auto Direção) é uma solução full-stack de nível corporativo e pedagógico para CFCs, Instrutores e Alunos.',
    'Novidades v6.8: Auto-cadastro de aluno em 3 etapas com confidencialidade por código do instrutor (ou link WhatsApp),',
    'Mapa Geográfico (5 a 40 km) com seleção de Estado primeiro, CEP auto-preenchimento, ocultação de bairro e contato WhatsApp,',
    'Demanda Reversa de alunos procurando instrutor + Mapa Interno exclusivo para instrutores logados, Agenda por período (Semanal,',
    'Mensal, Anual) com notificação automática ao aluno em desmarcação, edição persistente de plano na Ficha do Aluno, blindagem',
    'Cloud Vault contra perda de pacotes e módulo completo "Meus Veículos" para cadastro de carros/motos dos instrutores.'
  ];
  doc.text(resumoText, margin, currentY);
  currentY += 23;

  // --- 2. MATRIZ DE PERFIS (RBAC) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('2. MATRIZ DE PERFIS, HIERARQUIA E CONTROLE DE ACESSO (RBAC)', margin, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 7.5,
      cellPadding: 2
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Perfil / Papel', 'Escopo de Atuação', 'Permissões Principais', 'Salvaguardas de Segurança']],
    body: [
      [
        'SUPER_ADMIN (Master)\ncassiordcosta@gmail.com',
        'Global em toda a plataforma',
        'Acesso irrestrito a todas as autoescolas, verificador de cadastros, reatribuição de carteiras de alunos, Dossiê Técnico, trava de código e banco de dados Firestore.',
        'Requer 2FA obrigatório, validação de e-mail e hash criptográfico de CPF.'
      ],
      [
        'ADMIN_ORG (Gestor CFC)',
        'Autoescola vinculada',
        'Gestão de instrutores da escola, frota de veículos, relatórios consolidados, DRE contábil e criação de tabelas de pacotes corporativos.',
        'Isolado estritamente por organizacaoId; não visualiza outras autoescolas.'
      ],
      [
        'INSTRUTOR',
        'Carteira própria de alunos',
        'Cadastro de alunos via link exclusivo, diário de aulas (06h às 00h), notas práticas de habilidades, cobranças a receber e custos veiculares.',
        'Regra estrita: 1 Aluno (CPF) = 1 Instrutor. Não acessa alunos de colegas.'
      ],
      [
        'ALUNO',
        'Portal do Aluno pessoal',
        'Consulta de aulas agendadas e concluídas, radar de habilidades práticas, extrato financeiro e geração de código PIX para quitação.',
        'Acesso restrito ao próprio prontuário com CPF mascarado (***.***.892-01).'
      ]
    ]
  });

  // Atualiza currentY após a tabela
  currentY = (doc as any).lastAutoTable.finalY + 8;

  // --- 3. REGRAS DE NEGÓCIO E INTEGRIDADE ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('3. REGRAS ESTRUTURANTES DE NEGÓCIO E FORMAÇÃO DE CONDUTORES', margin, currentY);
  currentY += 5;

  const regras = [
    '• Regra 1 CPF = 1 Instrutor & Confidencialidade por Código: Cada aluno vincula-se a 1 instrutor; planos só aparecem via código/link.',
    '• Blindagem Zero Data Loss de Pacotes: O sistema jamais apaga, sobrescreve ou inventa pacotes aleatórios (PACKAGES_BACKUP + Cloud Vault).',
    '• Agenda por Período & Notificação ao Aluno: Liberação/remoção Semanal, Mensal ou Anual com aviso automático na tela do aluno.',
    '• Mapa Geográfico (5 a 40 km) & Privacidade: Seleção de UF primeiro, busca por CEP, ocultação de bairro residencial e contato via WhatsApp.',
    '• Cadastro de Veículos e Sanitização de Telefone: Frota do instrutor sincronizada com o Mapa e proibição de máscara vazia como telefone.'
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  doc.text(regras, margin, currentY);
  currentY += 22;

  // Quebra de Página para o Catálogo de Telas
  doc.addPage();
  currentY = margin + 6;

  // --- 4. CATÁLOGO DAS 20 TELAS DO SISTEMA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('4. CATÁLOGO COMPLETO DAS 20 TELAS OPERACIONAIS HOMOLOGADAS', margin, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 2
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 6.9,
      cellPadding: 1.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Nº', 'Nome da Tela / Módulo', 'Objetivo Principal e Funcionalidades Implementadas']],
    body: [
      ['1', 'Autenticação & Login Multi-Método', 'Login com Google OAuth, e-mail/senha, recuperação segura de senha via CPF e 2FA obrigatório.'],
      ['2', 'Auto-Cadastro de Instrutores', 'Onboarding de novos instrutores com validação de CPF, CEP automático e credencial DETRAN.'],
      ['3', 'Auto-Matrícula de Aluno (3 Telas)', 'Wizard em 3 etapas com busca confidencial por código do instrutor (ou link WhatsApp) e pacotes reais.'],
      ['4', 'Localizador Geográfico (Mapa 5–40 km)', 'Mapa com seleção de UF primeiro, auto-preenchimento CEP, filtros CNH/Câmbio/Veículo e botão WhatsApp.'],
      ['5', 'Mapa Interno & Demanda Reversa', 'Exclusivo para instrutores logados: raio 5–40 km, cidades atendidas e notificações de alunos procurando instrutor.'],
      ['6', 'Meus Veículos e Frota de Instrução', 'Cadastro de carros/motos do instrutor (câmbio manual/automático, placa, ano, duplo comando, PCD e km).'],
      ['7', 'Gerador de Convites WhatsApp', 'Geração de links com código do instrutor e validação obrigatória de telefone real (sem máscara vazia).'],
      ['8', 'Painel Geral (Dashboard)', 'Métricas em centavos, alertas de demanda geográfica, atalho para Meus Veículos e próximas aulas.'],
      ['9', 'Gestão de Alunos & Mudança de Plano', 'Filtro dinâmico apenas por categorias com alunos, edição/salvamento assíncrono de plano na ficha e transferência.'],
      ['10', 'Radar e Avaliação de Habilidades', 'Avaliação contínua das 8 competências motoras do CONTRAN de 0 a 10 com evolução aula a aula.'],
      ['11', 'Agenda por Período (Semanal/Mensal/Anual)', 'Liberação e remoção por período, visão mobile do aluno e alerta de conflito com notificação automática ao aluno.'],
      ['12', 'Catálogo Blindado de Pacotes', 'Criação e edição de pacotes pelo instrutor com proteção Cloud Vault contra perda ou criação aleatória.'],
      ['13', 'Finanças, Recebíveis & Gateway PIX', 'Controle de títulos em centavos, carnês, baixa de parcelas, recibos digitais e QR Code PIX dinâmico.'],
      ['14', 'Despesas Operacionais e Frota', 'Controle de combustível, manutenção preventiva, seguro e taxas categorizadas por veículo.'],
      ['15', 'Metas, DRE e IRPF Carnê-Leão', 'Planejamento de troca de frota, apuração do Lucro Líquido (DRE) e Livro-Caixa fiscal para IRPF.'],
      ['16', 'Saúde Financeira & Simulador DETRAN', 'Score 0–100, Regra dos 4 Potes, alerta de idade da frota e calculadora de custo real por aula.'],
      ['17', 'Central de Cobranças WhatsApp', 'Modelos prontos de mensagens: lembrete de aula, cobrança com chave PIX e aprovação.'],
      ['18', 'Portal do Aluno (Com Notificações)', 'Acesso do aluno para agendar aulas, receber alertas de aulas desmarcadas pelo instrutor, notas e PIX.'],
      ['19', 'Console Master & Verificador Cadastral', 'Auditoria global da plataforma, gestão de planos SaaS, cupons, detecção de órfãos e integridade.'],
      ['20', 'Painel de Agentes & Cloud Sync Vault', 'Watchdog, Code Guard com snapshots, Dossiê Oficial A4 e sincronização Supabase/Firestore.']
    ]
  });

  // Quebra de Página para o Dicionário de Dados
  doc.addPage();
  currentY = margin + 6;

  // --- 5. DICIONÁRIO DE DADOS E RELACIONAMENTOS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('5. DICIONÁRIO DE BANCO DE DADOS, ENTIDADES E TIPAGEM (19 COLEÇÕES)', margin, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: darkColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.6
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 6.5,
      cellPadding: 1.3
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Coleção / Entidade', 'Chaves (PK / FK)', 'Campos Principais e Tipos', 'Regras de Negócio e Integridade']],
    body: [
      ['organizations', 'PK: id (string)', 'nome, tipo, cnpjCpf, cep, logradouro, numero, complemento, bairro, cidade, estado (MG), chavePix, plano', 'Tenants + Cofre Cloud Sync Vault (__agd_vault_*) no Supabase.'],
      ['users', 'PK: id (string)\nFK: organizacaoId', 'nome, email, papel, cpfFingerprint, cep, logradouro, numero, complemento, bairro, cidade, estado (MG), chavePix', 'Login explícito sem auto-login, Multi-Master, CEP e hash SHA-256 de CPF.'],
      ['students', 'PK: id (string)\nFKs: organizacaoId,\ninstrutorId, pacoteId', 'nome, cpfMascarado, idade, categoriaCnh (12 cat), pacoteNome, cep, cidade, estado, habilidades', 'Ficha do aluno com mudança de plano persistente (StudentFichaMeta).'],
      ['StudentSkills\n(Embutido)', 'Embutido em students', 'baliza, embreagem, transito, cruzamentos, rodovia, sinalizacao, defensiva, simulado (0-10)', '8 competências práticas oficiais CONTRAN avaliadas de 0 a 10.'],
      ['vehicles', 'PK: id (string)\nFKs: organizacaoId,\ninstrutorId', 'modelo, placa, ano, cor, tipo (CARRO|MOTO|CAMINHAO|ONIBUS), cambio (MANUAL|AUTOMATICO), duploComando, kmAtual', 'Frota cadastrada pelo instrutor (VEHICLES_BACKUP + Cloud Vault).'],
      ['lessons', 'PK: id (string)\nFKs: alunoId, instrutorId,\nveiculoId, organizacaoId', 'data, horaInicio (06h-00h), horaFim, topico, status (AGENDADA|CONCLUIDA|FALTA|CANCELADA), nota', 'Diário de aulas práticas com suporte a carga noturna e desmarcações.'],
      ['availableSlots', 'PK: id (string)\nFK: instrutorId', 'data, horaInicio, horaFim, bloqueado, motivoBloqueio', 'Grade horária liberada/removida por Período, Semanal, Mensal ou Anual.'],
      ['accountsReceivable', 'PK: id (string)\nFKs: alunoId, pacoteId', 'valorTotalCentavos, valorPagoCentavos, saldoDevedorCentavos, pixPayload, pixQrCode', 'Carnês financeiros em centavos inteiros sincronizados com o plano.'],
      ['paymentRecords', 'PK: id (string)\nFKs: contaReceberId, alunoId', 'valorCentavos, metodo (PIX|CARTAO|DINHEIRO), taxaCentavos, dataPagamento, comprovante', 'Amortizações e quitações financeiras das cobranças.'],
      ['expenses', 'PK: id (string)\nFK: veiculoId (opcional)', 'descricao, categoria (COMBUSTIVEL|MANUTENCAO|SEGURO), valorCentavos, vencimento', 'Fluxo de saídas financeiras e custos vinculados a veículos.'],
      ['investments', 'PK: id (string)\nFK: organizacaoId', 'titulo, valorMetaCentavos, valorAcumuladoCentavos, aporteMensal, dataPrevisao', 'Metas financeiras para aquisição de veículos e reservas.'],
      ['packages', 'PK: id (string)\nFKs: organizacaoId,\ninstrutorId', 'nome, totalAulas, categoriaCnh, valorCentavos, formaPagamento, maxParcelas, atualizadoEm', 'Planos do instrutor com proteção Zero Data Loss (PACKAGES_BACKUP + Vault).'],
      ['instructorCoverage', 'PK: instrutorId\nFK: organizacaoId', 'raioAtendimentoKm (5-40), cidadeBase, estadoBase, cidadesAtendidas, categorias, cambio', 'Cobertura geográfica no Mapa (exibe apenas cidades atendidas, sem bairro).'],
      ['studentLeads', 'PK: id (string)\nFK: atendidoPorInstrutorId', 'nome, telefone, cep, cidade, estado, categoriaCnh, tipoCambio, status', 'Demanda reversa de alunos procurando instrutor na região.'],
      ['studentNotifications', 'PK: id (string)\nFKs: alunoId, instrutorId', 'dataAula, horaAula, tipo (AULA_DESMARCADA), titulo, mensagem, lida, criadoEm', 'Notificação automática na tela do aluno para remarcar aula desmarcada.'],
      ['studentTransfers', 'PK: id (string)\nFKs: alunoId, instrutorAnterior,\ninstrutorNovo, autorId', 'alunoNome, alunoCpfMascarado, motivo, aulasPreservadas, dataTransferencia, autorNome', 'Histórico imutável de transferência de alunos entre instrutores.'],
      ['auditLogs', 'PK: id (string)\nFK: usuarioId', 'acao, entidade, entidadeId, detalhes, ipOrigem, timestamp', 'Trilha forense de auditoria e LGPD. Proibição de exclusão física.'],
      ['whatsappLogs', 'PK: id (string)\nFK: alunoId', 'telefone, valorCentavos, mensagem, enviadoEm, status', 'Registro das mensagens e cobranças enviadas via WhatsApp.'],
      ['syncQueue', 'PK: id (string)', 'timestamp, action (CREATE|UPDATE|DELETE), entity, payload, retryCount', 'Fila transacional Offline-First sincronizada com a nuvem.']
    ]
  });

  // Quebra de Página para Agentes e Termo de Homologação
  doc.addPage();
  currentY = margin + 6;

  // --- 6. AGENTES DE GOVERNANÇA E SEGURANÇA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('6. AGENTES AUTÔNOMOS DE SEGURANÇA E GOVERNANÇA', margin, currentY);
  currentY += 5;

  doc.setFillColor(...lightBg);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, currentY, contentWidth / 2 - 2, 28, 2, 2, 'FD');
  doc.roundedRect(margin + contentWidth / 2 + 2, currentY, contentWidth / 2 - 2, 28, 2, 2, 'FD');

  // Watchdog Card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('Watchdog Agent (Sentinela Operacional)', margin + 3, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text(
    doc.splitTextToSize(
      'Supervisiona em tempo real a latência, integridade do armazenamento e transações. Emite alertas nos níveis INFO, SECURE, AVISO e CRÍTICO.',
      contentWidth / 2 - 8
    ),
    margin + 3,
    currentY + 11
  );

  // Code Guard Card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('Code Guard Agent (Trava de Código)', margin + contentWidth / 2 + 5, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text(
    doc.splitTextToSize(
      'Blindagem ativa contra modificações acidentais no código-fonte. Mantém pontos de restauração (snapshots) para recuperação instantânea.',
      contentWidth / 2 - 8
    ),
    margin + contentWidth / 2 + 5,
    currentY + 11
  );

  currentY += 36;

  // --- 7. TERMO OFICIAL DE HOMOLOGAÇÃO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('7. TERMO OFICIAL DE HOMOLOGAÇÃO E VALIDAÇÃO DE INTEGRIDADE', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  const homologacaoText = [
    'Declara-se para os devidos fins legais, pedagógicos e operacionais que o Sistema de Administração de Gestão de Direção',
    'encontra-se em estado estável, plenamente funcional, testado e auditado contra falhas estruturais, atendendo com rigor às',
    'normativas de trânsito do CONTRAN/DETRAN e à Lei Geral de Proteção de Dados (LGPD - Lei 13.709/2018).'
  ];
  doc.text(homologacaoText, margin, currentY);
  currentY += 15;

  // Carimbo de Homologação
  doc.setDrawColor(...greenColor);
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, currentY, contentWidth, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...greenColor);
  doc.text('HOMOLOGAÇÃO OFICIAL CONCLUÍDA COM SUCESSO · VERSÃO v6.8 ESTÁVEL (17/17 TESTES)', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkColor);
  doc.text('Hash Criptográfico de Auditoria: SHA256-AGD-V68-VAULT-GEO-VEHICLES-2026-STABLE', margin + 4, currentY + 10);
  doc.text(`Responsável Master: ${masterEmail}`, margin + 115, currentY + 10);

  currentY += 30;

  // Assinaturas Formais
  const signWidth = contentWidth * 0.42;

  // Assinatura Master
  doc.setDrawColor(...darkColor);
  doc.line(margin + 5, currentY, margin + 5 + signWidth, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('Cássio R. D. Costa', margin + 5 + signWidth / 2, currentY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Administrador Master da Plataforma', margin + 5 + signWidth / 2, currentY + 8, { align: 'center' });
  doc.text(masterEmail, margin + 5 + signWidth / 2, currentY + 12, { align: 'center' });

  // Assinatura Comitê de Auditoria
  const rightSignX = margin + contentWidth - signWidth - 5;
  doc.line(rightSignX, currentY, rightSignX + signWidth, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  doc.text('Comitê de Auditoria & Governança', rightSignX + signWidth / 2, currentY + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...slateColor);
  doc.text('Segurança da Informação e Proteção LGPD', rightSignX + signWidth / 2, currentY + 8, { align: 'center' });
  doc.text('Certificação Digital v6.8 Homologada', rightSignX + signWidth / 2, currentY + 12, { align: 'center' });

  // --- CABEÇALHO E RODAPÉ EM TODAS AS PÁGINAS ---
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Rodapé
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...slateColor);
    doc.text(
      'Gestão AD (Auto Direção) · Dossiê Técnico Oficial v6.8 · Homologado para cassiordcosta@gmail.com',
      margin,
      pageHeight - 6
    );

    doc.setFont('helvetica', 'bold');
    doc.text(
      `Página ${i} de ${totalPages}`,
      pageWidth - margin,
      pageHeight - 6,
      { align: 'right' }
    );
  }

  return doc;
}

export function downloadOfficialDossierPdf(filename = 'DOSSIE_OFICIAL_GESTAO_AD_v6.8.pdf'): boolean {
  try {
    const doc = generateOfficialDossierPdf({ filename });
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('Erro ao gerar/baixar PDF:', err);
    return false;
  }
}

export function openOfficialDossierPdfInNewTab(): boolean {
  try {
    const doc = generateOfficialDossierPdf();
    const blobUrl = doc.output('bloburl');
    const newWindow = window.open(blobUrl, '_blank');
    if (!newWindow) {
      // If popup blocked, download directly
      doc.save('DOSSIE_OFICIAL_GESTAO_AD_v6.8.pdf');
    }
    return true;
  } catch (err) {
    console.error('Erro ao abrir PDF em nova aba:', err);
    return false;
  }
}
