import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Mock browser globals for Node automated testing
const memStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (memStorage.has(k) ? memStorage.get(k)! : null),
  setItem: (k: string, v: string) => memStorage.set(k, String(v)),
  removeItem: (k: string) => memStorage.delete(k),
  clear: () => memStorage.clear(),
  get length() {
    return memStorage.size;
  },
  key: (i: number) => Array.from(memStorage.keys())[i] ?? null
};

import {
  legalContractValuesMulti,
  renderLegalDocument,
  legalHash
} from '../src/legal/documents';
import {
  registerAndAcceptLegalContract,
  loadLegalAcceptances,
  loadLegalContracts
} from '../src/legal/contractStore';
import {
  readContractReminder,
  hasAcceptedCurrentContracts
} from '../src/legal/contractReminder';
import {
  analyzePackageChange,
  applyPackageChangeDecision,
  resolvePendingReceiptAmount
} from '../src/lib/packageChangeLogic';
import type { AccountReceivable, PackageOffer, Student, User, StudentPackageContract } from '../src/types';

const templateDir = path.resolve(
  'g:/My Drive/Alexdiasinstrutor/site-alex/src/legal/documentos_juridicos_plataforma'
);

const customSources: Record<string, string> = {
  './documentos_juridicos_plataforma/01_contrato_prestacao_servicos.md': fs.readFileSync(
    path.join(templateDir, '01_contrato_prestacao_servicos.md'),
    'utf8'
  ),
  './documentos_juridicos_plataforma/02_termos_de_uso_plataforma.md': fs.readFileSync(
    path.join(templateDir, '02_termos_de_uso_plataforma.md'),
    'utf8'
  ),
  './documentos_juridicos_plataforma/03_politica_privacidade_lgpd.md': fs.readFileSync(
    path.join(templateDir, '03_politica_privacidade_lgpd.md'),
    'utf8'
  )
};

async function runTests() {
  console.log('=== Iniciando Testes Automatizados do Modulo de Contratos ===');

  const instructor: User = {
    id: 'usr_inst_1',
    organizacaoId: 'org_1',
    nome: 'Alexsandro Dias da Silva',
    email: 'alex@autoescola.com',
    papel: 'INSTRUTOR',
    telefone: '(31) 98796-9608',
    cpfUltimos4: '3643',
    cpfFingerprint: 'fp_inst_1',
    cpfCompleto: '040.253.336-43',
    registroDetran: '506',
    cidade: 'Betim',
    estado: 'MG',
    twoFactorAtivo: false
  };

  const studentUser: User = {
    id: 'usr_stu_1',
    organizacaoId: 'org_1',
    nome: 'Cassio Rodrigues Diniz Costa',
    email: 'cassio@aluno.com',
    papel: 'ALUNO',
    telefone: '(31) 99999-8888',
    cpfUltimos4: '5670',
    cpfFingerprint: 'fp_stu_1',
    cpfCompleto: '000.699.356-70',
    cidade: 'Betim',
    estado: 'MG',
    twoFactorAtivo: false
  };

  const student: Student = {
    id: 'stu_1',
    organizacaoId: 'org_1',
    instrutorId: 'usr_inst_1',
    nome: 'Cassio Rodrigues Diniz Costa',
    email: 'cassio@aluno.com',
    telefone: '(31) 99999-8888',
    cpfMascarado: '***.***.356-70',
    cpfFingerprint: 'fp_stu_1',
    dataNascimento: '1990-05-10',
    idade: 36,
    categoriaCnh: 'B',
    cidade: 'Betim',
    estado: 'MG',
    status: 'EM_ANDAMENTO',
    aulasCumpridas: 0,
    totalAulasContratadas: 4,
    habilidades: {
      baliza: 0,
      controleEmbreagem: 0,
      transitoPesado: 0,
      conversoesCruzamentos: 0,
      rodoviaVelocidade: 0,
      sinalizacaoPreferencia: 0,
      posturaDefensiva: 0,
      simuladoExame: 0
    },
    observacoesInstrutor: '',
    dataCadastro: '2026-11-17'
  };

  const plan1: StudentPackageContract = {
    id: 'cnt_1',
    alunoId: 'stu_1',
    organizacaoId: 'org_1',
    tipo: 'PACOTE_BASE',
    nome: 'Aula personalizada',
    categoriaCnh: 'B',
    quantidadeAulas: 4,
    valorCentavos: 75000,
    valorAulasCentavos: 75000,
    valorLocacaoExameCentavos: 0,
    locacaoExameContratada: false,
    dataContratacao: '2026-11-17',
    formaPagamento: 'A_VISTA'
  };

  const plan2: StudentPackageContract = {
    id: 'cnt_2',
    alunoId: 'stu_1',
    organizacaoId: 'org_1',
    tipo: 'PACOTE_ADICIONAL',
    nome: 'Treino de Baliza & Exame',
    categoriaCnh: 'B',
    quantidadeAulas: 6,
    valorCentavos: 115000,
    valorAulasCentavos: 90000,
    valorLocacaoExameCentavos: 25000,
    locacaoExameContratada: true,
    dataContratacao: '2026-11-17',
    formaPagamento: 'PIX'
  };

  // TEST 1: Contrato com 1 plano
  const vals1 = legalContractValuesMulti(instructor, student, studentUser, [plan1]);
  const doc1 = renderLegalDocument('CONTRATO_AULA_PRATICA', vals1, customSources);
  assert.equal(vals1.MODALIDADE_CONTRATO, 'Aula personalizada');
  assert.equal(vals1.QTD_AULAS, '4');
  assert.equal(vals1.VALOR_TOTAL, '750,00');
  assert.equal(doc1.missing.length, 0, 'Nenhum dado pendente quando cadastro completo');
  assert.ok(doc1.content.includes('Aula personalizada'));
  assert.ok(!doc1.content.includes('{{'), 'Nao pode sobrar placeholder sem substituicao');
  console.log('✓ Teste 1 (Contrato com 1 plano): OK');

  // TEST 2: Contrato com 2 planos listados e somados
  const vals2 = legalContractValuesMulti(
    instructor,
    { ...student, totalAulasContratadas: 10, contratosPacotes: [plan1, plan2] },
    studentUser,
    [plan1, plan2]
  );
  const doc2 = renderLegalDocument('CONTRATO_AULA_PRATICA', vals2, customSources);
  assert.ok(vals2.MODALIDADE_CONTRATO.includes('1) Aula personalizada'), 'Deve listar plano 1');
  assert.ok(vals2.MODALIDADE_CONTRATO.includes('2) Treino de Baliza & Exame'), 'Deve listar plano 2');
  assert.equal(vals2.QTD_AULAS, '10', 'Deve somar 4 + 6 = 10 aulas');
  assert.equal(vals2.SUBTOTAL_AULAS, '1650,00', 'Deve somar subtotal das aulas');
  assert.equal(vals2.VALOR_ALUGUEL_EXAME, '250,00', 'Deve somar valor de locacao de exame');
  assert.equal(vals2.VALOR_TOTAL, '1900,00', 'Deve somar total R$ 1.900,00');
  assert.equal(vals2.STATUS_EXAME, 'Incluso no total do contrato');
  assert.ok(doc2.content.includes('Treino de Baliza & Exame'));
  console.log('✓ Teste 2 (Contrato com multiplos planos listados e somados): OK');

  // TEST 3: Dados faltantes nao impedem geracao/aceite, mas geram notificacao amigavel
  const incompleteInstructor: User = { ...instructor, registroDetran: '' };
  const valsIncomplete = legalContractValuesMulti(incompleteInstructor, student, studentUser, [plan1]);
  const docIncomplete = renderLegalDocument('CONTRATO_AULA_PRATICA', valsIncomplete, customSources);
  assert.ok(docIncomplete.missing.includes('REGISTRO_DETRAN'));
  assert.ok(docIncomplete.missingLabels.includes('Registro / Credencial DETRAN do Instrutor'));
  assert.ok(!docIncomplete.content.includes('[PREENCHER'), 'Nao deve exibir marcador bruto [PREENCHER]');
  assert.ok(docIncomplete.content.includes('Não informado no cadastro'));
  console.log('✓ Teste 3 (Dados faltantes geram notificacao sem bloquear): OK');

  // TEST 4: Aceite antes de confirmar deve retornar pendente, e apos confirmar deve persistir no banco
  const studentWithMulti: Student = {
    ...student,
    totalAulasContratadas: 10,
    contratosPacotes: [plan1, plan2]
  };
  const reminderBefore = await readContractReminder(studentWithMulti, studentUser);
  assert.equal(reminderBefore.accepted, false, 'Antes do aceite deve estar pendente');
  assert.equal(reminderBefore.available, true, 'Contrato deve estar sempre disponivel para aceite');

  // Tentativa sem marcar os dois termos deve falhar
  await assert.rejects(
    () =>
      registerAndAcceptLegalContract({
        actor: studentUser,
        organizationId: 'org_1',
        studentId: studentWithMulti.id,
        instructorUserId: instructor.id,
        studentUserId: studentUser.id,
        packageContractIds: [plan1.id, plan2.id],
        content: docIncomplete.content,
        generalAccepted: true,
        clausesAccepted: false
      }),
    /dois termos de aceite/i
  );

  // Aceite valido mesmo com dados pendentes (nao-bloqueante!)
  const { version, receipt } = await registerAndAcceptLegalContract({
    actor: studentUser,
    organizationId: 'org_1',
    studentId: studentWithMulti.id,
    instructorUserId: instructor.id,
    studentUserId: studentUser.id,
    packageContractIds: [plan1.id, plan2.id],
    content: docIncomplete.content,
    generalAccepted: true,
    clausesAccepted: true
  });

  const expectedHash = await legalHash(docIncomplete.content);
  assert.equal(version.content_sha256, expectedHash);
  assert.equal(receipt.content_sha256, expectedHash);
  assert.equal(receipt.signer_role, 'ALUNO');
  assert.deepEqual(receipt.package_contract_ids, [plan1.id, plan2.id]);

  const savedVersions = await loadLegalContracts();
  const savedAcceptances = await loadLegalAcceptances(studentWithMulti.id, studentUser.id);
  assert.ok(savedVersions.some((v) => v.id === version.id), 'Versao salva no armazenamento');
  assert.ok(savedAcceptances.some((a) => a.id === receipt.id), 'Aceite salvo no armazenamento');

  const reminderAfter = await readContractReminder(studentWithMulti, studentUser);
  assert.equal(reminderAfter.accepted, true, 'Apos aceite, lembrete deve marcar accepted = true');
  assert.equal(
    hasAcceptedCurrentContracts(studentWithMulti, studentUser, savedVersions, savedAcceptances),
    true
  );
  console.log('✓ Teste 4 (Aceite eletronico gravado e validado): OK');

  // TEST 5: Troca de pacote ja PAGO cobrando apenas a diferenca + recibo pelo valor pendente atual
  const paidAccount: AccountReceivable = {
    id: 'acc_paid_1',
    organizacaoId: 'org_1',
    alunoId: student.id,
    pacoteId: 'pkg_1',
    descricao: 'Aula personalizada',
    valorTotalCentavos: 75000,
    valorPagoCentavos: 75000,
    saldoDevedorCentavos: 0,
    dataVencimento: '2026-11-17',
    status: 'PAGO',
    criadoEm: '2026-11-17T10:00:00Z'
  };
  const basePaidContract: StudentPackageContract = {
    ...plan1,
    pacoteId: 'pkg_1',
    contaReceberId: paidAccount.id
  };
  const newHigherPkg: PackageOffer = {
    id: 'pkg_2',
    organizacaoId: 'org_1',
    nome: 'Pacote Completo 10 Aulas',
    totalAulas: 10,
    categoriaCnh: 'B',
    valorCentavos: 120000,
    formaPagamento: 'PIX',
    descricao: '10 aulas praticas',
    ativo: true
  };
  const infoPaid = analyzePackageChange({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [basePaidContract],
    studentAccounts: [paidAccount],
    newPkg: newHigherPkg
  });
  assert.ok(infoPaid && infoPaid.isPaid, 'Deve identificar pacote anterior como PAGO');
  assert.equal(infoPaid.diffFromPaidCents, 45000, 'Diferenca deve ser R$ 1.200 - R$ 750 = R$ 450');

  const resPaidDiff = applyPackageChangeDecision({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [basePaidContract],
    info: infoPaid,
    decision: 'PAGO_TROCAR_DIFERENCA',
    actorId: instructor.id,
    actorName: instructor.nome
  });
  assert.equal(resPaidDiff.contracts.length, 2, 'Deve manter o anterior + criar novo');
  assert.equal(resPaidDiff.contracts[0].status, 'ALTERADO', 'Anterior passa para ALTERADO para auditoria');
  assert.equal(resPaidDiff.contracts[1].status, 'ATIVO', 'Novo passa para ATIVO');
  assert.equal(resPaidDiff.contracts[1].valorDiferencaCentavos, 45000);
  assert.ok(resPaidDiff.newAccount);
  assert.equal(resPaidDiff.newAccount!.saldoDevedorCentavos, 45000, 'Cobranca criada apenas com a diferenca');
  assert.equal(
    resolvePendingReceiptAmount(resPaidDiff.contracts[1], [paidAccount, resPaidDiff.newAccount!]),
    45000,
    'Recibo deve sair pelo valor pendente atual (R$ 450,00)'
  );
  console.log('✓ Teste 5 (Troca de pacote PAGO com diferenca e recibo pendente): OK');

  // TEST 6: Manter pacote anterior PAGO e adicionar novo pacote
  const resPaidAdd = applyPackageChangeDecision({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [basePaidContract],
    info: infoPaid,
    decision: 'PAGO_ADICIONAR_NOVO',
    actorId: instructor.id
  });
  assert.equal(resPaidAdd.contracts.filter((c) => c.status === 'ATIVO').length, 2, 'Ambos permanecem ATIVOS');
  assert.equal(resPaidAdd.newTotalLessons, 14, 'Soma 4 + 10 = 14 aulas');
  assert.equal(resPaidAdd.newAccount!.valorTotalCentavos, 120000);
  console.log('✓ Teste 6 (Manter pacote anterior pago + adicionar novo): OK');

  // TEST 7: Pacote EM ABERTO -> Troca Integral (cancela anterior para auditoria e cobra novo valor)
  const openAccount: AccountReceivable = {
    ...paidAccount,
    id: 'acc_open_1',
    valorPagoCentavos: 0,
    saldoDevedorCentavos: 75000,
    status: 'PENDENTE'
  };
  const baseOpenContract: StudentPackageContract = {
    ...plan1,
    pacoteId: 'pkg_1',
    contaReceberId: openAccount.id
  };
  const infoOpen = analyzePackageChange({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [baseOpenContract],
    studentAccounts: [openAccount],
    newPkg: newHigherPkg
  });
  assert.ok(infoOpen && !infoOpen.isPaid, 'Deve identificar pacote anterior como EM ABERTO');

  const resOpenIntegral = applyPackageChangeDecision({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [baseOpenContract],
    info: infoOpen,
    decision: 'ABERTO_TROCA_INTEGRAL',
    actorId: instructor.id
  });
  assert.equal(resOpenIntegral.contracts[0].status, 'CANCELADO', 'Contrato anterior fica CANCELADO para auditoria');
  assert.equal(resOpenIntegral.contracts[1].status, 'ATIVO');
  assert.equal(resOpenIntegral.updatedPrevAccount?.status, 'CANCELADO', 'Fatura anterior fica CANCELADA');
  assert.equal(resOpenIntegral.updatedPrevAccount?.saldoDevedorCentavos, 0);
  assert.equal(resOpenIntegral.newAccount?.valorTotalCentavos, 120000);
  console.log('✓ Teste 7 (Pacote EM ABERTO -> Troca Integral com cancelamento de auditoria): OK');

  // TEST 8: Pacote EM ABERTO -> Registrar apenas a diferenca
  const resOpenDiff = applyPackageChangeDecision({
    student: { ...student, pacoteId: 'pkg_1', pacoteNome: 'Aula personalizada' },
    resolvedContracts: [baseOpenContract],
    info: infoOpen,
    decision: 'ABERTO_REGISTRAR_DIFERENCA',
    actorId: instructor.id
  });
  assert.equal(resOpenDiff.contracts[0].status, 'ALTERADO');
  assert.equal(resOpenDiff.contracts[1].status, 'ATIVO');
  assert.equal(resOpenDiff.updatedPrevAccount, undefined, 'Mantem fatura original em aberto');
  assert.equal(resOpenDiff.newAccount?.saldoDevedorCentavos, 45000, 'Lanca apenas a diferenca');
  console.log('✓ Teste 8 (Pacote EM ABERTO -> Atualizar e registrar diferenca): OK');

  console.log('=== Todos os 8 testes automatizados passaram! ===');
}

runTests().catch((err) => {
  console.error('FALHA NOS TESTES:', err);
  process.exit(1);
});
