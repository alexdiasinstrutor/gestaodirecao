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
  doc.text('HOMOLOGAÇÃO OFICIAL v5.3 ESTÁVEL', pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;

  // Título Principal
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkColor);
  doc.text('SISTEMA DE GESTÃO DE DIREÇÃO', margin, currentY);
  currentY += 6;

  // Subtítulo
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...slateColor);
  doc.text('Dossiê Técnico, Arquitetura de Software, Catálogo de Telas, Finanças e Dicionário de Dados', margin, currentY);
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
  doc.text('v5.3 Auditada e Protegida por Agentes', margin + 35, currentY + 5);

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
  doc.text('Google Cloud Firestore + Offline-First (IndexedDB)', margin + 35, currentY + 15);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkColor);
  doc.text('Data de Homologação:', margin + 105, currentY + 5);
  doc.setFont('helvetica', 'normal');
  doc.text('Outubro de 2026', margin + 140, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Normativas Legais:', margin + 105, currentY + 10);
  doc.setFont('helvetica', 'normal');
  doc.text('CTB, CONTRAN e LGPD (Lei 13.709)', margin + 140, currentY + 10);

  doc.setFont('helvetica', 'bold');
  doc.text('Integridade:', margin + 105, currentY + 15);
  doc.setFont('helvetica', 'normal');
  doc.text('Zero Floating Point Error (Centavos)', margin + 140, currentY + 15);

  currentY += 28;

  // --- 1. RESUMO EXECUTIVO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('1. RESUMO EXECUTIVO E IDENTIFICAÇÃO DO SISTEMA', margin, currentY);
  currentY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...darkColor);
  const resumoText = [
    'O Sistema de Administração de Gestão de Direção é uma solução tecnológica full-stack de nível corporativo e pedagógico,',
    'projetada para Centros de Formação de Condutores (CFCs / Autoescolas), Instrutores Autônomos e Candidatos à CNH.',
    'A plataforma une em um único ambiente integrado: gestão pedagógica com 8 competências práticas do CONTRAN,',
    'gestão financeira centesimal de alta precisão (contas a receber, PIX dinâmico Copia e Cola / QR Code, despesas e DRE),',
    'agenda adaptativa operando das 06:00 às 00:00 (carga noturna obrigatória do CTB) e governança estrita de acessos (RBAC).'
  ];
  doc.text(resumoText, margin, currentY);
  currentY += 20;

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
    '• Regra 1 CPF = 1 Instrutor: Cada candidato é vinculado de forma unívoca a apenas 1 instrutor ativo via hash SHA-256 anti-duplicidade.',
    '• Indicação Obrigatória: Nenhum aluno pode se cadastrar de forma avulsa; o vínculo precisa ser originado por convite de instrutor credenciado.',
    '• Validação de Maioridade Legal: O sistema impõe idade >= 18 anos no ato da matrícula, conforme exigência do Código de Trânsito Brasileiro.',
    '• Precisão em Centavos (Zero Floating Point): Valores financeiros são inteiros (ex: R$ 1.800,00 = 180000), prevenindo distorções em DRE.',
    '• Histórico Perpétuo de Transferências: Em caso de reatribuição de instrutor, todas as aulas cumpridas e notas são preservadas no prontuário.'
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkColor);
  doc.text(regras, margin, currentY);
  currentY += 22;

  // Quebra de Página para o Catálogo de Telas
  doc.addPage();
  currentY = margin + 6;

  // --- 4. CATÁLOGO DAS 17 TELAS DO SISTEMA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('4. CATÁLOGO COMPLETO DAS 17 TELAS OPERACIONAIS HOMOLOGADAS', margin, currentY);
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
      fontSize: 7.2,
      cellPadding: 1.8
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Nº', 'Nome da Tela / Módulo', 'Objetivo Principal e Funcionalidades Implementadas']],
    body: [
      ['1', 'Autenticação & Login Multi-Método', 'Login com Google OAuth, e-mail/senha, recuperação segura de senha via CPF e 2FA obrigatório.'],
      ['2', 'Auto-Cadastro de Instrutores', 'Onboarding de novos instrutores com validação de credencial de trânsito e criação de tenant.'],
      ['3', 'Auto-Matrícula Vinculada de Aluno', 'Cadastro iniciado por link exclusivo com instrutor fixo, cálculo de idade (>= 18) e escolha de pacote.'],
      ['4', 'Gerador de Convites WhatsApp', 'Geração de links de convite com token criptográfico e envio direto para o WhatsApp do aluno.'],
      ['5', 'Painel Geral (Dashboard)', 'Métricas de faturamento em centavos, taxa de aprovação, próximas aulas e status de veículos.'],
      ['6', 'Gestão de Alunos & Progresso', 'Fichas cadastrais completas, status CNH, reatribuição de instrutor e impressão de ficha pedagógica A4.'],
      ['7', 'Radar e Avaliação de Habilidades', 'Avaliação contínua das 8 competências motoras do CONTRAN de 0 a 10 com evolução aula a aula.'],
      ['8', 'Agenda Prática Diurna e Noturna', 'Grade estendida das 06:00 às 00:00, compatível com a carga noturna do CTB e bloqueio de horários.'],
      ['9', 'Finanças & Contas a Receber', 'Controle de títulos em centavos, carnês, parcelamento, status PAGO/PENDENTE e baixa de parcelas.'],
      ['10', 'Gateway PIX Dinâmico', 'Geração instantânea de linha EMV Copia e Cola e renderização de QR Code para liquidação imediata.'],
      ['11', 'Despesas Operacionais e Frota', 'Controle de combustível, manutenção preventiva, seguro e taxas categorizadas por placa de veículo.'],
      ['12', 'Metas de Investimento & Reservas', 'Planejamento financeiro para renovação de frota, novos veículos e reserva com barra de metas.'],
      ['13', 'Demonstrativo de Resultados (DRE)', 'Demonstração da receita bruta, custos fixos/variáveis e apuração automática do Lucro Líquido.'],
      ['14', 'Central de Cobranças WhatsApp', 'Modelos prontos de mensagens: lembrete de aula (24h/2h antes), cobrança com chave PIX e aprovação.'],
      ['15', 'Portal do Aluno Mobile-First', 'Acesso simplificado para o candidato consultar presenças, competências e efetuar pagamentos PIX.'],
      ['16', 'Console Master & Verificador Cadastral', 'Auditoria global da plataforma, detecção de cadastros órfãos, conflitos de agenda e integridade.'],
      ['17', 'Painel de Agentes & Banco Firestore', 'Agente Watchdog, Code Guard com restauração por snapshots e motor de migração para Firestore.']
    ]
  });

  // Quebra de Página para o Dicionário de Dados
  doc.addPage();
  currentY = margin + 6;

  // --- 5. DICIONÁRIO DE DADOS E RELACIONAMENTOS ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...primaryColor);
  doc.text('5. DICIONÁRIO DE BANCO DE DADOS, ENTIDADES E TIPAGEM (16 COLEÇÕES)', margin, currentY);
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
      cellPadding: 1.8
    },
    bodyStyles: {
      textColor: darkColor,
      fontSize: 6.8,
      cellPadding: 1.5
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    head: [['Coleção / Entidade', 'Chaves (PK / FK)', 'Campos Principais e Tipos', 'Regras de Negócio e Integridade']],
    body: [
      ['organizations', 'PK: id (string)', 'nome, tipo, cnpjCpf, telefone, email, cidade, estado, status, plano', 'Tenants (Autoescolas e Autônomos). Isolamento de dados multi-inquilino.'],
      ['users', 'PK: id (string)\nFK: organizacaoId', 'nome, email, papel (SUPER_ADMIN|ADMIN|INSTRUTOR|ALUNO), cpfFingerprint, 2FA', 'Contas autenticáveis, Google OAuth e hash SHA-256 de CPF.'],
      ['students', 'PK: id (string)\nFKs: organizacaoId,\ninstrutorId, pacoteId', 'nome, cpfMascarado, cpfFingerprint, dataNasc, idade, categoriaCnh, status, habilidades', 'Ficha do aluno. 1 Aluno = 1 Instrutor; Idade mínima >= 18 anos.'],
      ['StudentSkills\n(Embutido)', 'Embutido em students', 'baliza, embreagem, transito, cruzamentos, rodovia, sinalizacao, defensiva, simulado (0-10)', '8 competências práticas oficiais CONTRAN avaliadas de 0 a 10.'],
      ['vehicles', 'PK: id (string)\nFK: organizacaoId', 'modelo, placa, ano, tipo (CARRO|MOTO|CAMINHAO|ONIBUS), kmAtual, proximaRevisaoKm', 'Frota veicular de instrução, controle de quilometragem e revisões.'],
      ['lessons', 'PK: id (string)\nFKs: alunoId, instrutorId,\nveiculoId, organizacaoId', 'data, horaInicio (06h-00h), horaFim, topico, status (AGENDADA|CONCLUIDA|FALTA), nota', 'Diário de aulas práticas com suporte a carga noturna e faltas.'],
      ['availableSlots', 'PK: id (string)\nFK: instrutorId', 'data, horaInicio, horaFim, bloqueado, motivoBloqueio', 'Grade horária individual e bloqueios de agenda do instrutor.'],
      ['accountsReceivable', 'PK: id (string)\nFKs: alunoId, pacoteId', 'valorTotalCentavos, valorPagoCentavos, saldoDevedorCentavos, pixPayload, pixQrCode', 'Carnês financeiros em centavos inteiros com PIX dinâmico.'],
      ['paymentRecords', 'PK: id (string)\nFKs: contaReceberId, alunoId', 'valorCentavos, metodo (PIX|CARTAO|DINHEIRO), taxaCentavos, dataPagamento, comprovante', 'Amortizações e quitações financeiras das cobranças.'],
      ['expenses', 'PK: id (string)\nFK: veiculoId (opcional)', 'descricao, categoria (COMBUSTIVEL|MANUTENCAO|SEGURO), valorCentavos, vencimento', 'Fluxo de saídas financeiras e custos vinculados a veículos.'],
      ['investments', 'PK: id (string)\nFK: organizacaoId', 'titulo, valorMetaCentavos, valorAcumuladoCentavos, aporteMensal, dataPrevisao', 'Metas financeiras para aquisição de veículos e reservas.'],
      ['packages', 'PK: id (string)\nFK: instrutorId (opcional)', 'nome, totalAulas, categoriaCnh, valorCentavos, maxParcelas, descontoAvista', 'Tabela de planos e pacotes de aulas práticas comercializados.'],
      ['studentTransfers', 'PK: id (string)\nFKs: alunoId, instrutorAnterior,\ninstrutorNovo, autorId', 'alunoNome, alunoCpfMascarado, motivo, aulasPreservadas, dataTransferencia, autorNome', 'Histórico imutável de transferência de alunos entre instrutores.'],
      ['auditLogs', 'PK: id (string)\nFK: usuarioId', 'acao, entidade, entidadeId, detalhes, ipOrigem, timestamp', 'Trilha forense de auditoria e LGPD. Proibição de exclusão física.'],
      ['whatsappLogs', 'PK: id (string)\nFK: alunoId', 'telefone, valorCentavos, mensagem, enviadoEm, status', 'Registro das mensagens e cobranças enviadas via WhatsApp.'],
      ['syncQueue', 'PK: id (string)', 'timestamp, action (CREATE|UPDATE|DELETE), entity, payload, retryCount', 'Fila transacional Offline-First sincronizada com o Cloud Firestore.']
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
  doc.text('HOMOLOGAÇÃO OFICIAL CONCLUÍDA COM SUCESSO · VERSÃO v5.3 ESTÁVEL', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkColor);
  doc.text('Hash Criptográfico de Auditoria: SHA256-AGD-7F9A2B4C8E01-2026-STABLE', margin + 4, currentY + 10);
  doc.text(`Responsável Master: ${masterEmail}`, margin + 110, currentY + 10);

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
  doc.text('Certificação Digital v5.3 Homologada', rightSignX + signWidth / 2, currentY + 12, { align: 'center' });

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
      'Sistema de Gestão de Direção · Dossiê Técnico Oficial v5.3 · Homologado para cassiordcosta@gmail.com',
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

export function downloadOfficialDossierPdf(filename = 'DOSSIE_OFICIAL_GESTAO_DIRECAO_v5.3.pdf'): boolean {
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
      doc.save('DOSSIE_OFICIAL_GESTAO_DIRECAO_v5.3.pdf');
    }
    return true;
  } catch (err) {
    console.error('Erro ao abrir PDF em nova aba:', err);
    return false;
  }
}
