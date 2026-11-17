import type {
  AccountReceivable,
  PackageOffer,
  Student,
  StudentPackageContract
} from '../types';

export type PackageChangeDecision =
  | 'PAGO_TROCAR_DIFERENCA'
  | 'PAGO_ADICIONAR_NOVO'
  | 'ABERTO_TROCA_INTEGRAL'
  | 'ABERTO_REGISTRAR_DIFERENCA';

export interface PendingPackageChangeInfo {
  prevContract: StudentPackageContract;
  prevAccount?: AccountReceivable;
  newPkg: PackageOffer;
  isPaid: boolean;
  paidCents: number;
  prevTotalCents: number;
  diffFromPaidCents: number;
  diffFromPrevTotalCents: number;
}

export interface PackageChangeResult {
  contracts: StudentPackageContract[];
  updatedPrevAccount?: AccountReceivable;
  newAccount?: AccountReceivable;
  newTotalLessons: number;
  activePackageId: string;
  activePackageName: string;
  activeCategory: Student['categoriaCnh'];
}

export function analyzePackageChange(params: {
  student: Student;
  resolvedContracts: StudentPackageContract[];
  studentAccounts: AccountReceivable[];
  newPkg: PackageOffer;
}): PendingPackageChangeInfo | null {
  const { student, resolvedContracts, studentAccounts, newPkg } = params;

  const activeContracts = resolvedContracts.filter(
    (c) => !c.status || c.status === 'ATIVO'
  );
  const prevContract =
    activeContracts.find((c) => c.tipo === 'PACOTE_BASE') ||
    activeContracts[activeContracts.length - 1] ||
    resolvedContracts[0];

  if (!prevContract) return null;

  const prevAccount =
    (prevContract.contaReceberId
      ? studentAccounts.find((a) => a.id === prevContract.contaReceberId)
      : undefined) ||
    studentAccounts.find(
      (a) =>
        a.pacoteId === (prevContract.pacoteId || student.pacoteId) &&
        a.status !== 'CANCELADO'
    );

  const prevTotalCents =
    prevAccount?.valorTotalCentavos ?? prevContract.valorCentavos ?? 0;

  const paidCents = prevAccount
    ? prevAccount.valorPagoCentavos ||
      (prevAccount.status === 'PAGO' ? prevAccount.valorTotalCentavos : 0)
    : 0;

  const isPaid = Boolean(
    prevAccount &&
      (prevAccount.status === 'PAGO' ||
        (prevAccount.valorTotalCentavos > 0 &&
          paidCents >= prevAccount.valorTotalCentavos))
  );

  const diffFromPaidCents = Math.max(0, newPkg.valorCentavos - paidCents);
  const diffFromPrevTotalCents = Math.max(0, newPkg.valorCentavos - prevTotalCents);

  return {
    prevContract,
    prevAccount,
    newPkg,
    isPaid,
    paidCents,
    prevTotalCents,
    diffFromPaidCents,
    diffFromPrevTotalCents
  };
}

export function applyPackageChangeDecision(params: {
  student: Student;
  resolvedContracts: StudentPackageContract[];
  info: PendingPackageChangeInfo;
  decision: PackageChangeDecision;
  actorId: string;
  actorName?: string;
}): PackageChangeResult {
  const { student, resolvedContracts, info, decision, actorId, actorName } = params;
  const { prevContract, prevAccount, newPkg, paidCents, prevTotalCents } = info;
  const nowIso = new Date().toISOString();
  const today = nowIso.slice(0, 10);
  const dueDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  let updatedPrevAccount: AccountReceivable | undefined;
  let newAccount: AccountReceivable | undefined;
  let contracts: StudentPackageContract[] = [];

  const buildNewContract = (
    overrides: Partial<StudentPackageContract>
  ): StudentPackageContract => ({
    id: `cnt_chg_${suffix}`,
    alunoId: student.id,
    organizacaoId: student.organizacaoId,
    tipo: 'PACOTE_BASE',
    status: 'ATIVO',
    pacoteId: newPkg.id,
    nome: newPkg.nome,
    categoriaCnh: newPkg.categoriaCnh,
    quantidadeAulas: newPkg.totalAulas,
    valorCentavos: newPkg.valorCentavos,
    valorAulasCentavos: newPkg.valorCentavos,
    dataContratacao: today,
    formaPagamento: newPkg.formaPagamento,
    criadoPorId: actorId,
    criadoPorNome: actorName || 'Instrutor',
    criadoEm: nowIso,
    ...newPkg.condicoesContratuais,
    ...overrides
  });

  if (decision === 'PAGO_TROCAR_DIFERENCA') {
    const diffCents = Math.max(0, newPkg.valorCentavos - paidCents);
    if (diffCents > 0) {
      newAccount = {
        id: `acc_diff_${suffix}`,
        organizacaoId: student.organizacaoId,
        alunoId: student.id,
        pacoteId: newPkg.id,
        descricao: `${newPkg.nome} (Diferença de troca do pacote ${prevContract.nome})`,
        valorTotalCentavos: diffCents,
        valorPagoCentavos: 0,
        saldoDevedorCentavos: diffCents,
        dataVencimento: dueDate,
        status: 'PENDENTE',
        parcelasTotal: 1,
        criadoEm: nowIso
      };
    }

    const mapped = resolvedContracts.map((c) =>
      c.id === prevContract.id
        ? {
            ...c,
            status: 'ALTERADO' as const,
            observacoes: `Pacote alterado para ${newPkg.nome} (Pago R$ ${(paidCents / 100).toFixed(2).replace('.', ',')} · Auditoria)`
          }
        : c
    );

    const newContract = buildNewContract({
      valorAnteriorPagoCentavos: paidCents,
      valorDiferencaCentavos: diffCents,
      substituiuContratoId: prevContract.id,
      contaReceberId: newAccount?.id,
      observacoes:
        diffCents > 0
          ? `Substituiu "${prevContract.nome}". Diferença pendente a pagar: R$ ${(diffCents / 100).toFixed(2).replace('.', ',')}`
          : `Substituiu "${prevContract.nome}" sem diferença adicional a pagar.`
    });

    contracts = [...mapped, newContract];
  } else if (decision === 'PAGO_ADICIONAR_NOVO') {
    if (newPkg.valorCentavos > 0) {
      newAccount = {
        id: `acc_add_${suffix}`,
        organizacaoId: student.organizacaoId,
        alunoId: student.id,
        pacoteId: newPkg.id,
        descricao: newPkg.nome,
        valorTotalCentavos: newPkg.valorCentavos,
        valorPagoCentavos: 0,
        saldoDevedorCentavos: newPkg.valorCentavos,
        dataVencimento: dueDate,
        status: 'PENDENTE',
        parcelasTotal: 1,
        criadoEm: nowIso
      };
    }

    const mapped = resolvedContracts.map((c) =>
      c.id === prevContract.id ? { ...c, status: 'ATIVO' as const } : c
    );

    const newContract = buildNewContract({
      tipo: 'PACOTE_ADICIONAL',
      status: 'ATIVO',
      contaReceberId: newAccount?.id,
      observacoes: `Novo pacote adicionado ao cadastro (mantido pacote anterior pago "${prevContract.nome}").`
    });

    contracts = [...mapped, newContract];
  } else if (decision === 'ABERTO_TROCA_INTEGRAL') {
    const alreadyAmortized = prevAccount?.valorPagoCentavos || 0;
    const novoSaldo = Math.max(0, newPkg.valorCentavos - alreadyAmortized);

    if (prevAccount) {
      updatedPrevAccount = {
        ...prevAccount,
        status: 'CANCELADO',
        saldoDevedorCentavos: 0,
        descricao: prevAccount.descricao.includes('[CANCELADO')
          ? prevAccount.descricao
          : `${prevAccount.descricao} [CANCELADO - Troca Integral]`
      };
    }

    if (newPkg.valorCentavos > 0) {
      newAccount = {
        id: `acc_int_${suffix}`,
        organizacaoId: student.organizacaoId,
        alunoId: student.id,
        pacoteId: newPkg.id,
        descricao: newPkg.nome,
        valorTotalCentavos: newPkg.valorCentavos,
        valorPagoCentavos: alreadyAmortized,
        saldoDevedorCentavos: novoSaldo,
        dataVencimento: dueDate,
        status: novoSaldo === 0 ? 'PAGO' : alreadyAmortized > 0 ? 'PARCIAL' : 'PENDENTE',
        parcelasTotal: 1,
        criadoEm: nowIso
      };
    }

    const mapped = resolvedContracts.map((c) =>
      c.id === prevContract.id
        ? {
            ...c,
            status: 'CANCELADO' as const,
            observacoes: `Cancelado por troca integral para ${newPkg.nome} (Auditoria)`
          }
        : c
    );

    const newContract = buildNewContract({
      valorDiferencaCentavos: novoSaldo,
      substituiuContratoId: prevContract.id,
      contaReceberId: newAccount?.id,
      observacoes: `Troca integral substituindo "${prevContract.nome}".`
    });

    contracts = [...mapped, newContract];
  } else {
    // ABERTO_REGISTRAR_DIFERENCA
    const diffCents = Math.max(0, newPkg.valorCentavos - prevTotalCents);
    if (diffCents > 0) {
      newAccount = {
        id: `acc_up_${suffix}`,
        organizacaoId: student.organizacaoId,
        alunoId: student.id,
        pacoteId: newPkg.id,
        descricao: `${newPkg.nome} (Diferença de atualização do pacote ${prevContract.nome})`,
        valorTotalCentavos: diffCents,
        valorPagoCentavos: 0,
        saldoDevedorCentavos: diffCents,
        dataVencimento: dueDate,
        status: 'PENDENTE',
        parcelasTotal: 1,
        criadoEm: nowIso
      };
    }

    const mapped = resolvedContracts.map((c) =>
      c.id === prevContract.id
        ? {
            ...c,
            status: 'ALTERADO' as const,
            observacoes: `Alterado com lançamento de diferença para ${newPkg.nome} (Auditoria)`
          }
        : c
    );

    const newContract = buildNewContract({
      valorAnteriorPagoCentavos: prevTotalCents,
      valorDiferencaCentavos: diffCents,
      substituiuContratoId: prevContract.id,
      contaReceberId: newAccount?.id,
      observacoes:
        diffCents > 0
          ? `Atualização do pacote "${prevContract.nome}". Lançada diferença pendente de R$ ${(diffCents / 100).toFixed(2).replace('.', ',')}.`
          : `Atualização do pacote "${prevContract.nome}" sem diferença de valor.`
    });

    contracts = [...mapped, newContract];
  }

  const activeContracts = contracts.filter(
    (c) => !c.status || c.status === 'ATIVO'
  );
  const newTotalLessons = activeContracts.reduce(
    (sum, c) => sum + (Number(c.quantidadeAulas) || 0),
    0
  );

  const isAddingExtra = decision === 'PAGO_ADICIONAR_NOVO';

  return {
    contracts,
    updatedPrevAccount,
    newAccount,
    newTotalLessons: Math.max(1, newTotalLessons),
    activePackageId: isAddingExtra ? (prevContract.pacoteId || student.pacoteId || newPkg.id) : newPkg.id,
    activePackageName: isAddingExtra ? prevContract.nome : newPkg.nome,
    activeCategory: isAddingExtra ? (prevContract.categoriaCnh || student.categoriaCnh) : newPkg.categoriaCnh
  };
}

/**
 * Calcula o valor pendente atual para emissão de recibo referente a um contrato/pacote.
 */
export function resolvePendingReceiptAmount(
  contract: StudentPackageContract,
  studentAccounts: AccountReceivable[]
): number {
  const linkedAccount =
    (contract.contaReceberId
      ? studentAccounts.find((a) => a.id === contract.contaReceberId)
      : undefined) ||
    studentAccounts.find(
      (a) =>
        a.pacoteId === contract.pacoteId &&
        a.status !== 'CANCELADO' &&
        a.saldoDevedorCentavos > 0
    );

  if (linkedAccount) {
    if (linkedAccount.saldoDevedorCentavos > 0) {
      return linkedAccount.saldoDevedorCentavos;
    }
    if (
      contract.valorDiferencaCentavos !== undefined &&
      contract.valorDiferencaCentavos > 0
    ) {
      return contract.valorDiferencaCentavos;
    }
    return linkedAccount.valorTotalCentavos;
  }

  if (
    contract.valorDiferencaCentavos !== undefined &&
    contract.valorDiferencaCentavos > 0
  ) {
    return contract.valorDiferencaCentavos;
  }

  return contract.valorCentavos;
}
