/**
 * ============================================================
 * ADAPTADOR SUPABASE — Sistema de Gestão de Direção v5.6
 * ============================================================
 * Este módulo espelha toda a interface do `db` em storage.ts,
 * porém gravando e lendo do Supabase (PostgreSQL) em vez do localStorage.
 *
 * Estratégia: Dual-write (grava em ambos) durante a transição.
 * Assim o sistema funciona mesmo sem conexão (fallback localStorage).
 * ============================================================
 */

import { supabase, isSupabaseEnabled } from './supabaseClient';
import {
  Organization, User, Student, Vehicle, Lesson, AvailableSlot,
  AccountReceivable, PaymentRecord, Expense, Investment, PackageOffer,
  AuditLog, WhatsAppReminderLog, StudentTransferHistory,
  DiscountCoupon, CouponRedemption,
} from '../types';

// ─── Helpers de mapeamento: TypeScript camelCase → SQL snake_case ───────────

function orgToRow(o: Organization): Record<string, any> {
  return {
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    cnpj_cpf: o.cnpjCpf,
    telefone: o.telefone,
    email: o.email,
    cep: o.cep || null,
    logradouro: o.logradouro || null,
    numero: o.numero || null,
    complemento: o.complemento || null,
    bairro: o.bairro || null,
    cidade: o.cidade,
    estado: o.estado,
    status: o.status,
    plano: o.plano,
    data_vencimento_plano: o.dataVencimentoPlano || null,
    valor_mensalidade_centavos: o.valorMensalidadeCentavos || 0,
    chave_acesso: o.chaveAcesso || null,
    chave_acesso_gerada_em: o.chaveAcessoGeradaEm || null,
    modulos_customizados: o.modulosCustomizados || [],
    limite_alunos: o.limiteAlunos || 0,
    limite_instrutores: o.limiteInstrutores || 0,
    motivo_bloqueio: o.motivoBloqueio || null,
    chave_pix: o.chavePix || null,
    tipo_chave_pix: o.tipoChavePix || null,
    beneficiario_pix: o.beneficiarioPix || null,
    cidade_pix: o.cidadePix || null,
    criado_em: o.criadoEm || new Date().toISOString(),
  };
}

function rowToOrg(r: any): Organization {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    cnpjCpf: r.cnpj_cpf,
    telefone: r.telefone,
    email: r.email,
    cep: r.cep || undefined,
    logradouro: r.logradouro || undefined,
    numero: r.numero || undefined,
    complemento: r.complemento || undefined,
    bairro: r.bairro || undefined,
    cidade: r.cidade,
    estado: r.estado,
    status: r.status,
    plano: r.plano,
    criadoEm: r.criado_em,
    dataVencimentoPlano: r.data_vencimento_plano,
    valorMensalidadeCentavos: r.valor_mensalidade_centavos,
    chaveAcesso: r.chave_acesso,
    chaveAcessoGeradaEm: r.chave_acesso_gerada_em,
    modulosCustomizados: r.modulos_customizados || [],
    limiteAlunos: r.limite_alunos,
    limiteInstrutores: r.limite_instrutores,
    motivoBloqueio: r.motivo_bloqueio,
    chavePix: r.chave_pix,
    tipoChavePix: r.tipo_chave_pix,
    beneficiarioPix: r.beneficiario_pix,
    cidadePix: r.cidade_pix,
  };
}

function userToRow(u: User): Record<string, any> {
  return {
    id: u.id,
    organizacao_id: u.organizacaoId,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    telefone: u.telefone,
    cpf_ultimos_4: u.cpfUltimos4,
    cpf_fingerprint: u.cpfFingerprint,
    cpf_mascarado: u.cpfMascarado || null,
    cpf_completo: u.cpfCompleto || null,
    cep: u.cep || null,
    estado: u.estado || null,
    cidade: u.cidade || null,
    bairro: u.bairro || null,
    logradouro: u.logradouro || null,
    numero: u.numero || null,
    complemento: u.complemento || null,
    two_factor_ativo: u.twoFactorAtivo || false,
    two_factor_secret: u.twoFactorSecret || null,
    ultimo_acesso: u.ultimoAcesso || null,
    avatar_url: u.avatarUrl || null,
    assinatura_url: u.assinaturaUrl || null,
    senha_temporaria: u.senhaTemporaria || null,
    chave_pix: u.chavePix || null,
    tipo_chave_pix: u.tipoChavePix || null,
    beneficiario_pix: u.beneficiarioPix || null,
    cidade_pix: u.cidadePix || null,
  };
}

function rowToUser(r: any): User {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    nome: r.nome,
    email: r.email,
    papel: r.papel,
    telefone: r.telefone,
    cpfUltimos4: r.cpf_ultimos_4,
    cpfFingerprint: r.cpf_fingerprint,
    cpfMascarado: r.cpf_mascarado,
    cpfCompleto: r.cpf_completo,
    cep: r.cep || undefined,
    estado: r.estado || undefined,
    cidade: r.cidade || undefined,
    bairro: r.bairro || undefined,
    logradouro: r.logradouro || undefined,
    numero: r.numero || undefined,
    complemento: r.complemento || undefined,
    twoFactorAtivo: r.two_factor_ativo,
    twoFactorSecret: r.two_factor_secret,
    ultimoAcesso: r.ultimo_acesso,
    avatarUrl: r.avatar_url,
    assinaturaUrl: r.assinatura_url || (r.avatar_url && typeof r.avatar_url === 'string' && r.avatar_url.startsWith('data:image') ? r.avatar_url : undefined),
    senhaTemporaria: r.senha_temporaria,
    chavePix: r.chave_pix,
    tipoChavePix: r.tipo_chave_pix,
    beneficiarioPix: r.beneficiario_pix,
    cidadePix: r.cidade_pix,
  };
}

function studentToRow(s: Student): Record<string, any> {
  return {
    id: s.id,
    organizacao_id: s.organizacaoId,
    instrutor_id: s.instrutorId,
    nome: s.nome,
    email: s.email || null,
    telefone: s.telefone || null,
    cpf_mascarado: s.cpfMascarado,
    cpf_fingerprint: s.cpfFingerprint,
    data_nascimento: s.dataNascimento,
    idade: s.idade || 18,
    categoria_cnh: s.categoriaCnh,
    cep: s.cep || null,
    estado: s.estado || null,
    cidade: s.cidade || null,
    bairro: s.bairro || null,
    logradouro: s.logradouro || null,
    numero: s.numero || null,
    complemento: s.complemento || null,
    status: s.status,
    aulas_cumpridas: s.aulasCumpridas || 0,
    total_aulas_contratadas: s.totalAulasContratadas || 20,
    habilidades: s.habilidades || {},
    observacoes_instrutor: s.observacoesInstrutor || null,
    pacote_id: s.pacoteId || null,
    pacote_nome: s.pacoteNome || null,
    historico_transferencias: s.historicoTransferencias || [],
    contratos_pacotes: s.contratosPacotes || [],
    data_cadastro: s.dataCadastro || new Date().toISOString(),
  };
}

function rowToStudent(r: any): Student {
  let parsedContracts: StudentPackageContract[] = [];
  if (Array.isArray(r.contratos_pacotes)) {
    parsedContracts = r.contratos_pacotes;
  } else if (typeof r.contratos_pacotes === 'string' && r.contratos_pacotes.trim().startsWith('[')) {
    try {
      const p = JSON.parse(r.contratos_pacotes);
      if (Array.isArray(p)) parsedContracts = p;
    } catch {}
  } else if (Array.isArray(r.contratosPacotes)) {
    parsedContracts = r.contratosPacotes;
  }

  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    instrutorId: r.instrutor_id,
    nome: r.nome,
    email: r.email,
    telefone: r.telefone,
    cpfMascarado: r.cpf_mascarado,
    cpfFingerprint: r.cpf_fingerprint,
    dataNascimento: r.data_nascimento,
    idade: r.idade,
    categoriaCnh: r.categoria_cnh,
    cep: r.cep || undefined,
    estado: r.estado || undefined,
    cidade: r.cidade || undefined,
    bairro: r.bairro || undefined,
    logradouro: r.logradouro || undefined,
    numero: r.numero || undefined,
    complemento: r.complemento || undefined,
    status: r.status,
    aulasCumpridas: r.aulas_cumpridas,
    totalAulasContratadas: r.total_aulas_contratadas,
    habilidades: r.habilidades,
    observacoesInstrutor: r.observacoes_instrutor,
    dataCadastro: r.data_cadastro,
    pacoteId: r.pacote_id,
    pacoteNome: r.pacote_nome,
    historicoTransferencias: r.historico_transferencias || [],
    contratosPacotes: parsedContracts,
  };
}

function vehicleToRow(v: Vehicle): Record<string, any> {
  return {
    id: v.id,
    organizacao_id: v.organizacaoId,
    instrutor_id: v.instrutorId || null,
    instrutor_nome: v.instrutorNome || null,
    modelo: v.modelo,
    placa: v.placa,
    ano: v.ano,
    tipo: v.tipo,
    cambio: v.cambio || 'MANUAL',
    categoria_cnh: v.categoriaCnh || (v.tipo === 'MOTO' ? 'A' : v.tipo === 'CAMINHAO' ? 'C' : v.tipo === 'ONIBUS' ? 'D' : 'B'),
    duplo_comando: v.duploComando !== undefined ? v.duploComando : true,
    adaptado_pcd: v.adaptadoPcd || false,
    cor: v.cor || null,
    status: v.status,
    km_atual: v.kmAtual || 0,
    proxima_revisao_km: v.proximaRevisaoKm || 10000,
    atualizado_em: v.atualizadoEm || new Date().toISOString(),
  };
}

function rowToVehicle(r: any): Vehicle {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    instrutorId: r.instrutor_id || undefined,
    instrutorNome: r.instrutor_nome || undefined,
    modelo: r.modelo,
    placa: r.placa,
    ano: r.ano,
    tipo: r.tipo,
    cambio: r.cambio || 'MANUAL',
    categoriaCnh: r.categoria_cnh || undefined,
    duploComando: r.duplo_comando !== undefined ? Boolean(r.duplo_comando) : true,
    adaptadoPcd: Boolean(r.adaptado_pcd),
    cor: r.cor || undefined,
    status: r.status,
    kmAtual: r.km_atual,
    proximaRevisaoKm: r.proxima_revisao_km,
    atualizadoEm: r.atualizado_em || undefined,
  };
}

// Metadados de agenda (recorrência, remarcações, registro automático) são persistidos
// dentro de competencias_trabalhadas com o prefixo abaixo, evitando migração de schema.
const LESSON_META_PREFIX = '__agd_meta__:';

function lessonToRow(l: Lesson): Record<string, any> {
  const competencias = (l.competenciasTrabalhadas || []).filter(
    (c) => typeof c === 'string' && !c.startsWith(LESSON_META_PREFIX)
  );
  const meta: Record<string, any> = {};
  if (l.recorrenciaId) meta.recorrenciaId = l.recorrenciaId;
  if (l.recorrenciaTipo) meta.recorrenciaTipo = l.recorrenciaTipo;
  if (l.historicoRemarcacoes && l.historicoRemarcacoes.length > 0) meta.historicoRemarcacoes = l.historicoRemarcacoes;
  if (l.concluidaAutomaticamente) meta.concluidaAutomaticamente = true;
  if (l.concluidaEm) meta.concluidaEm = l.concluidaEm;
  if (Object.keys(meta).length > 0) {
    competencias.push(LESSON_META_PREFIX + JSON.stringify(meta));
  }
  return {
    id: l.id,
    organizacao_id: l.organizacaoId,
    aluno_id: l.alunoId,
    instrutor_id: l.instrutorId,
    veiculo_id: l.veiculoId || null,
    data: l.data,
    hora_inicio: l.horaInicio,
    hora_fim: l.horaFim,
    topico: l.topico,
    status: l.status,
    nota_aula: l.notaAula || null,
    observacao_instrutor: l.observacaoInstrutor || null,
    competencias_trabalhadas: competencias,
    criado_em: l.criadoEm || new Date().toISOString(),
  };
}

function rowToLesson(r: any): Lesson {
  let rawComp: any = r.competencias_trabalhadas;
  if (typeof rawComp === 'string') {
    try {
      rawComp = JSON.parse(rawComp);
    } catch {
      rawComp = [];
    }
  }
  const compList: string[] = Array.isArray(rawComp) ? rawComp.filter((c: any) => typeof c === 'string') : [];
  let meta: Record<string, any> = {};
  const competencias = compList.filter((c) => {
    if (c.startsWith(LESSON_META_PREFIX)) {
      try {
        meta = { ...meta, ...JSON.parse(c.slice(LESSON_META_PREFIX.length)) };
      } catch {
        // ignora metadado corrompido
      }
      return false;
    }
    return true;
  });
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    alunoId: r.aluno_id,
    instrutorId: r.instrutor_id,
    veiculoId: r.veiculo_id,
    data: r.data,
    horaInicio: r.hora_inicio,
    horaFim: r.hora_fim,
    topico: r.topico,
    status: r.status,
    notaAula: r.nota_aula,
    observacaoInstrutor: r.observacao_instrutor,
    competenciasTrabalhadas: competencias,
    criadoEm: r.criado_em,
    recorrenciaId: meta.recorrenciaId,
    recorrenciaTipo: meta.recorrenciaTipo,
    historicoRemarcacoes: Array.isArray(meta.historicoRemarcacoes) ? meta.historicoRemarcacoes : undefined,
    concluidaAutomaticamente: meta.concluidaAutomaticamente === true ? true : undefined,
    concluidaEm: meta.concluidaEm,
  };
}

function slotToRow(s: AvailableSlot): Record<string, any> {
  return {
    id: s.id,
    organizacao_id: s.organizacaoId,
    instrutor_id: s.instrutorId,
    data: s.data,
    hora_inicio: s.horaInicio,
    hora_fim: s.horaFim,
    bloqueado: s.bloqueado,
    motivo_bloqueio: s.motivoBloqueio || null,
  };
}

function rowToSlot(r: any): AvailableSlot {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    instrutorId: r.instrutor_id,
    data: r.data,
    horaInicio: r.hora_inicio,
    horaFim: r.hora_fim,
    bloqueado: r.bloqueado,
    motivoBloqueio: r.motivo_bloqueio,
  };
}

function accountToRow(a: AccountReceivable): Record<string, any> {
  return {
    id: a.id,
    organizacao_id: a.organizacaoId,
    aluno_id: a.alunoId,
    pacote_id: a.pacoteId || null,
    descricao: a.descricao,
    valor_total_centavos: a.valorTotalCentavos,
    valor_pago_centavos: a.valorPagoCentavos,
    saldo_devedor_centavos: a.saldoDevedorCentavos,
    data_vencimento: a.dataVencimento,
    status: a.status,
    pix_payload: a.pixPayload || null,
    pix_qr_code_url: a.pixQrCodeUrl || null,
    parcelas_total: a.parcelasTotal || 1,
    criado_em: a.criadoEm || new Date().toISOString(),
  };
}

function rowToAccount(r: any): AccountReceivable {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    alunoId: r.aluno_id,
    pacoteId: r.pacote_id,
    descricao: r.descricao,
    valorTotalCentavos: r.valor_total_centavos,
    valorPagoCentavos: r.valor_pago_centavos,
    saldoDevedorCentavos: r.saldo_devedor_centavos,
    dataVencimento: r.data_vencimento,
    status: r.status,
    pixPayload: r.pix_payload,
    pixQrCodeUrl: r.pix_qr_code_url,
    parcelasTotal: r.parcelas_total,
    criadoEm: r.criado_em,
  };
}

function paymentToRow(p: PaymentRecord): Record<string, any> {
  return {
    id: p.id,
    organizacao_id: p.organizacaoId,
    conta_receber_id: p.contaReceberId,
    aluno_id: p.alunoId,
    valor_centavos: p.valorCentavos,
    metodo: p.metodo,
    parcelas: p.parcelas || 1,
    taxa_centavos: p.taxaCentavos || 0,
    data_pagamento: p.dataPagamento,
    comprovante_numero: p.comprovanteNumero || null,
    observacao: p.observacao || null,
  };
}

function rowToPayment(r: any): PaymentRecord {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    contaReceberId: r.conta_receber_id,
    alunoId: r.aluno_id,
    valorCentavos: r.valor_centavos,
    metodo: r.metodo,
    parcelas: r.parcelas,
    taxaCentavos: r.taxa_centavos,
    dataPagamento: r.data_pagamento,
    comprovanteNumero: r.comprovante_numero,
    observacao: r.observacao,
  };
}

function expenseToRow(e: Expense): Record<string, any> {
  return {
    id: e.id,
    organizacao_id: e.organizacaoId,
    descricao: e.descricao,
    categoria: e.categoria,
    veiculo_id: e.veiculoId || null,
    valor_centavos: e.valorCentavos,
    data_vencimento: e.dataVencimento,
    data_pagamento: e.dataPagamento || null,
    status: e.status,
  };
}

function rowToExpense(r: any): Expense {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    descricao: r.descricao,
    categoria: r.categoria,
    veiculoId: r.veiculo_id,
    valorCentavos: r.valor_centavos,
    dataVencimento: r.data_vencimento,
    dataPagamento: r.data_pagamento,
    status: r.status,
  };
}

function investmentToRow(i: Investment): Record<string, any> {
  return {
    id: i.id,
    organizacao_id: i.organizacaoId,
    titulo: i.titulo,
    categoria: i.categoria,
    valor_meta_centavos: i.valorMetaCentavos,
    valor_acumulado_centavos: i.valorAcumuladoCentavos,
    aporte_mensal_sugerido_centavos: i.aporteMensalCentavos || 0,
    data_inicio: i.dataInicio || null,
    data_prevista_conclusao: i.dataPrevisao || null,
    anotacoes: i.notas || null,
  };
}

function rowToInvestment(r: any): Investment {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    titulo: r.titulo,
    categoria: r.categoria,
    valorMetaCentavos: r.valor_meta_centavos,
    valorAcumuladoCentavos: r.valor_acumulado_centavos,
    aporteMensalCentavos: r.aporte_mensal_sugerido_centavos,
    dataInicio: r.data_inicio,
    dataPrevisao: r.data_prevista_conclusao,
    notas: r.anotacoes,
  };
}

function packageToRow(pk: PackageOffer): Record<string, any> {
  return {
    id: pk.id,
    organizacao_id: pk.organizacaoId,
    instrutor_id: pk.instrutorId || null,
    instrutor_nome: pk.instrutorNome || null,
    nome: pk.nome,
    categoria_cnh: pk.categoriaCnh,
    quantidade_aulas: pk.totalAulas || 20,
    valor_centavos: pk.valorCentavos,
    formas_pagamento_permitidas: pk.formaPagamento,
    maximo_parcelas_cartao: pk.maxParcelas || 12,
    desconto_a_vista_percentual: pk.descontoAvistaPercentual || 0,
    descricao: pk.descricao,
    ativo: pk.ativo,
    criado_em: pk.criadoEm || new Date().toISOString(),
    atualizado_em: pk.atualizadoEm || pk.criadoEm || new Date().toISOString(),
  };
}

function rowToPackage(r: any): PackageOffer {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    instrutorId: r.instrutor_id || undefined,
    instrutorNome: r.instrutor_nome || undefined,
    nome: r.nome,
    categoriaCnh: r.categoria_cnh,
    totalAulas: r.quantidade_aulas,
    valorCentavos: r.valor_centavos,
    formaPagamento: r.formas_pagamento_permitidas,
    maxParcelas: r.maximo_parcelas_cartao,
    descontoAvistaPercentual: r.desconto_a_vista_percentual,
    descricao: r.descricao,
    ativo: r.ativo,
    criadoEm: r.criado_em,
    atualizadoEm: r.atualizado_em || r.criado_em || undefined,
  };
}

function auditToRow(a: AuditLog): Record<string, any> {
  return {
    id: a.id,
    organizacao_id: a.organizacaoId,
    usuario_id: a.usuarioId || null,
    usuario_nome: a.usuarioNome || null,
    acao: a.acao,
    entidade: a.entidade,
    entidade_id: a.entidadeId || null,
    detalhes: a.detalhes || null,
    ip_origem: a.ipOrigem || null,
    timestamp: a.timestamp || new Date().toISOString(),
  };
}

function rowToAudit(r: any): AuditLog {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    usuarioId: r.usuario_id,
    usuarioNome: r.usuario_nome,
    acao: r.acao,
    entidade: r.entidade,
    entidadeId: r.entidade_id,
    detalhes: r.detalhes,
    ipOrigem: r.ip_origem,
    timestamp: r.timestamp,
  };
}

function whatsappToRow(w: WhatsAppReminderLog): Record<string, any> {
  return {
    id: w.id,
    organizacao_id: w.organizacaoId,
    aluno_id: w.alunoId,
    aluno_nome: w.alunoNome,
    telefone: w.telefone,
    valor_centavos: w.valorCentavos || 0,
    data_vencimento: w.dataVencimento || null,
    mensagem: w.mensagem,
    enviado_em: w.enviadoEm || new Date().toISOString(),
    status: w.status,
  };
}

function couponToRow(c: DiscountCoupon): Record<string, any> {
  return {
    id: c.id,
    codigo: c.codigo,
    escopo: c.escopo,
    tipo_desconto: c.tipoDesconto,
    meses_gratis: c.mesesGratis ?? null,
    percentual: c.percentual ?? null,
    valor_centavos: c.valorCentavos ?? null,
    duracao_meses: c.duracaoMeses ?? null,
    planos_permitidos: c.planosPermitidos || [],
    organizacao_id: c.organizacaoId || null,
    instrutor_id: c.instrutorId || null,
    criado_por_id: c.criadoPorId || null,
    criado_por_nome: c.criadoPorNome || null,
    valido_ate: c.validoAte || null,
    limite_usos: c.limiteUsos || 0,
    usos_realizados: c.usosRealizados || 0,
    ativo: c.ativo,
    descricao: c.descricao || null,
    criado_em: c.criadoEm || new Date().toISOString(),
  };
}

function rowToCoupon(r: any): DiscountCoupon {
  return {
    id: r.id,
    codigo: r.codigo,
    escopo: r.escopo,
    tipoDesconto: r.tipo_desconto,
    mesesGratis: r.meses_gratis ?? undefined,
    percentual: r.percentual !== null && r.percentual !== undefined ? Number(r.percentual) : undefined,
    valorCentavos: r.valor_centavos ?? undefined,
    duracaoMeses: r.duracao_meses ?? undefined,
    planosPermitidos: r.planos_permitidos || [],
    organizacaoId: r.organizacao_id || undefined,
    instrutorId: r.instrutor_id || undefined,
    criadoPorId: r.criado_por_id,
    criadoPorNome: r.criado_por_nome,
    validoAte: r.valido_ate || undefined,
    limiteUsos: r.limite_usos || 0,
    usosRealizados: r.usos_realizados || 0,
    ativo: r.ativo,
    descricao: r.descricao || undefined,
    criadoEm: r.criado_em,
  };
}

function redemptionToRow(x: CouponRedemption): Record<string, any> {
  return {
    id: x.id,
    cupom_id: x.cupomId,
    codigo: x.codigo,
    escopo: x.escopo,
    organizacao_id: x.organizacaoId,
    usuario_id: x.usuarioId || null,
    aluno_id: x.alunoId || null,
    referencia_id: x.referenciaId,
    valor_original_centavos: x.valorOriginalCentavos,
    valor_desconto_centavos: x.valorDescontoCentavos,
    valor_final_centavos: x.valorFinalCentavos,
    meses_gratis: x.mesesGratis ?? null,
    resgatado_em: x.resgatadoEm,
  };
}

function rowToRedemption(r: any): CouponRedemption {
  return {
    id: r.id,
    cupomId: r.cupom_id,
    codigo: r.codigo,
    escopo: r.escopo,
    organizacaoId: r.organizacao_id,
    usuarioId: r.usuario_id || undefined,
    alunoId: r.aluno_id || undefined,
    referenciaId: r.referencia_id,
    valorOriginalCentavos: r.valor_original_centavos,
    valorDescontoCentavos: r.valor_desconto_centavos,
    valorFinalCentavos: r.valor_final_centavos,
    mesesGratis: r.meses_gratis ?? undefined,
    resgatadoEm: r.resgatado_em,
  };
}

// ─── Cloud Sync Vault (Sincronização Resiliente p/ Tabelas com RLS Estrito) ───
export const VAULT_PREFIX = '__agd_vault_';

const VAULT_TABLES = new Set([
  'package_offers',
  'students',
  'vehicles',
  'available_slots',
  'lessons',
  'accounts_receivable',
  'payment_records',
  'expenses',
  'investments',
  'audit_logs',
  'whatsapp_logs',
  'student_transfers',
]);

const vaultWriteQueues = new Map<string, Promise<void>>();

function enqueueVaultOp(table: string, task: () => Promise<void>): Promise<void> {
  const prev = vaultWriteQueues.get(table) || Promise.resolve();
  const next = prev.then(task, task);
  vaultWriteQueues.set(table, next);
  return next;
}

async function readVaultRows(table: string): Promise<any[]> {
  if (!supabase || !VAULT_TABLES.has(table)) return [];
  try {
    const vaultId = `${VAULT_PREFIX}${table}`;
    const { data, error } = await supabase
      .from('organizations')
      .select('modulos_customizados')
      .eq('id', vaultId)
      .limit(1);
    if (error || !data || data.length === 0) return [];
    const raw = data[0]?.modulos_customizados;
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function writeVaultRows(table: string, rows: any[]): Promise<void> {
  if (!supabase || !VAULT_TABLES.has(table)) return;
  const vaultId = `${VAULT_PREFIX}${table}`;
  const cappedRows = table === 'audit_logs' ? rows.slice(0, 600) : rows;
  const payload = {
    id: vaultId,
    nome: '__AGD_CLOUD_VAULT__',
    tipo: 'INSTRUTOR_AUTONOMO',
    cnpj_cpf: `VAULT_${table.toUpperCase()}`,
    telefone: '0000000000',
    email: `vault_${table}@sistema.local`,
    cidade: 'VAULT',
    estado: 'MG',
    status: 'ATIVO',
    plano: 'MASTER',
    modulos_customizados: cappedRows,
    criado_em: new Date().toISOString(),
  };
  await supabase.from('organizations').upsert(payload, { onConflict: 'id' });
}

async function upsertVaultRowsBatch(table: string, newRows: Record<string, any>[]): Promise<void> {
  if (!supabase || !VAULT_TABLES.has(table) || newRows.length === 0) return;
  await enqueueVaultOp(table, async () => {
    const current = await readVaultRows(table);
    const map = new Map<string, any>();
    for (const item of current) {
      if (item && item.id) map.set(String(item.id), item);
    }
    for (const row of newRows) {
      if (row && row.id) {
        const existing = map.get(String(row.id)) || {};
        map.set(String(row.id), { ...existing, ...row });
      }
    }
    let merged = Array.from(map.values());
    if (table === 'audit_logs') {
      merged.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));
      merged = merged.slice(0, 600);
    }
    await writeVaultRows(table, merged);
  });
}

async function recordVaultDeletedIds(table: string, ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const vaultId = `${VAULT_PREFIX}deleted_${table}`;
  try {
    const { data } = await supabase
      .from('organizations')
      .select('modulos_customizados')
      .eq('id', vaultId)
      .limit(1);
    const raw = data?.[0]?.modulos_customizados;
    const existing: string[] = Array.isArray(raw) ? raw : [];
    const set = new Set([...existing, ...ids.map(String)]);
    const payload = {
      id: vaultId,
      nome: '__AGD_CLOUD_VAULT__',
      tipo: 'INSTRUTOR_AUTONOMO',
      cnpj_cpf: `VAULT_DEL_${table.toUpperCase()}`.slice(0, 14),
      telefone: '0000000000',
      email: `vault_del_${table}@sistema.local`,
      cidade: 'VAULT',
      estado: 'MG',
      status: 'ATIVO',
      plano: 'MASTER',
      modulos_customizados: Array.from(set),
      criado_em: new Date().toISOString(),
    };
    await supabase.from('organizations').upsert(payload, { onConflict: 'id' });
  } catch (err) {
    console.warn(`[Supabase] Erro ao registrar IDs deletados para ${table}:`, err);
  }
}

async function readVaultDeletedIds(table: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  try {
    const vaultId = `${VAULT_PREFIX}deleted_${table}`;
    const { data } = await supabase
      .from('organizations')
      .select('modulos_customizados')
      .eq('id', vaultId)
      .limit(1);
    const raw = data?.[0]?.modulos_customizados;
    if (Array.isArray(raw)) {
      return new Set(raw.map(String));
    }
  } catch {
    // ignore
  }
  return new Set();
}

async function unmarkVaultDeletedIds(table: string, ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  const vaultId = `${VAULT_PREFIX}deleted_${table}`;
  try {
    const { data } = await supabase
      .from('organizations')
      .select('modulos_customizados')
      .eq('id', vaultId)
      .limit(1);
    const raw = data?.[0]?.modulos_customizados;
    if (Array.isArray(raw)) {
      const idSet = new Set(ids.map(String));
      const filtered = raw.filter((id) => !idSet.has(String(id)));
      if (filtered.length !== raw.length) {
        await supabase.from('organizations').update({ modulos_customizados: filtered }).eq('id', vaultId);
      }
    }
  } catch {
    // ignore
  }
}

async function deleteVaultRowsBatch(table: string, ids: string[]): Promise<void> {
  if (!supabase || !VAULT_TABLES.has(table) || ids.length === 0) return;
  const idSet = new Set(ids.map(String));
  await recordVaultDeletedIds(table, ids);
  await enqueueVaultOp(table, async () => {
    const current = await readVaultRows(table);
    const filtered = current.filter((item) => item && !idSet.has(String(item.id)));
    if (filtered.length !== current.length) {
      await writeVaultRows(table, filtered);
    }
  });
}

// ─── Helper genérico de upsert no Supabase ──────────────────────────────────

async function supabaseUpsert(table: string, row: Record<string, any>): Promise<void> {
  if (!supabase) return;
  if (VAULT_TABLES.has(table)) {
    await upsertVaultRowsBatch(table, [row]);
  }
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) {
    // Se a tabela possui RLS restritivo p/ chave anon (42501), o dado já está persistido com segurança no Cloud Vault
    if (error.code === '42501' || (error.message && error.message.includes('row-level security'))) {
      return;
    }

    // 1. Tratamento para violação de unicidade (ex: email já existente em users ou CNPJ/CPF em organizations)
    if (error.code === '23505' || (error.message && error.message.toLowerCase().includes('unique'))) {
      if (table === 'users' && row.email) {
        const updateRes = await supabase.from('users').update(row).eq('email', String(row.email).toLowerCase());
        if (!updateRes.error) return;
      } else if (table === 'organizations' && row.cnpj_cpf) {
        const updateRes = await supabase.from('organizations').update(row).eq('cnpj_cpf', row.cnpj_cpf);
        if (!updateRes.error) return;
      }
    }

    // 2. Se a tabela remota no Supabase ainda não executou o ALTER TABLE com os campos extras de endereço,
    // faz fallback automático removendo apenas as colunas de endereço estendidas para não perder a gravação.
    if (error.message && (error.message.includes('column') || error.code === 'PGRST204')) {
      const fallbackRow = { ...row };
      delete fallbackRow.cep;
      delete fallbackRow.logradouro;
      delete fallbackRow.numero;
      delete fallbackRow.complemento;
      delete fallbackRow.bairro;
      if (table !== 'organizations') {
        delete fallbackRow.cidade;
        delete fallbackRow.estado;
      }
      if (table === 'package_offers') {
        delete fallbackRow.instrutor_id;
        delete fallbackRow.instrutor_nome;
        delete fallbackRow.atualizado_em;
      }
      if (table === 'students') {
        delete fallbackRow.contratos_pacotes;
      }
      if (table === 'vehicles') {
        delete fallbackRow.instrutor_id;
        delete fallbackRow.instrutor_nome;
        delete fallbackRow.cambio;
        delete fallbackRow.categoria_cnh;
        delete fallbackRow.duplo_comando;
        delete fallbackRow.adaptado_pcd;
        delete fallbackRow.cor;
        delete fallbackRow.atualizado_em;
      }
      const retry = await supabase.from(table).upsert(fallbackRow, { onConflict: 'id' });
      if (retry.error) {
        if (retry.error.code === '42501' || retry.error.message?.includes('row-level security')) {
          return;
        }
        if (table === 'students' && (retry.error.message?.includes('column') || retry.error.code === 'PGRST204')) {
          delete fallbackRow.pacote_id;
          delete fallbackRow.pacote_nome;
          delete fallbackRow.historico_transferencias;
          const retry2 = await supabase.from(table).upsert(fallbackRow, { onConflict: 'id' });
          if (retry2.error && retry2.error.code !== '42501') {
            console.error(`[Supabase] Erro ao salvar em "${table}" (fallback 2):`, retry2.error.message);
          }
          return;
        }
        console.error(`[Supabase] Erro ao salvar em "${table}" (fallback):`, retry.error.message);
      }
      return;
    }
    console.error(`[Supabase] Erro ao salvar em "${table}":`, error.message);
  }
}

async function supabaseDelete(table: string, id: string): Promise<void> {
  if (!supabase) return;
  if (VAULT_TABLES.has(table)) {
    await deleteVaultRowsBatch(table, [id]);
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error && error.code !== '42501') {
    console.error(`[Supabase] Erro ao deletar de "${table}" id=${id}:`, error.message);
  }
}

async function supabaseSelect<T>(
  table: string,
  mapper: (r: any) => T,
  filters?: Record<string, string>
): Promise<T[]> {
  if (!supabase) return [];
  let q = supabase.from(table).select('*');
  if (filters) {
    for (const [col, val] of Object.entries(filters)) {
      q = q.eq(col, val);
    }
  }
  const [{ data, error }, vaultRows, vaultDeletedIds] = await Promise.all([
    q,
    VAULT_TABLES.has(table) ? readVaultRows(table) : Promise.resolve([]),
    VAULT_TABLES.has(table) ? readVaultDeletedIds(table) : Promise.resolve(new Set<string>()),
  ]);

  if (error && !VAULT_TABLES.has(table)) {
    console.error(`[Supabase] Erro ao ler "${table}":`, error.message);
    return [];
  }

  const nativeRows = (data || []).filter((r: any) => {
    if (table === 'organizations') {
      return !String(r.id || '').startsWith(VAULT_PREFIX) && r.nome !== '__AGD_CLOUD_VAULT__';
    }
    // Descarta registros cujo ID foi marcado como deletado no cofre definitivo
    if (vaultDeletedIds.has(String(r.id))) {
      return false;
    }
    return true;
  });

  if (!VAULT_TABLES.has(table)) {
    return nativeRows.map(mapper);
  }

  const mergedMap = new Map<string, any>();
  for (const r of nativeRows) {
    if (r && r.id && !vaultDeletedIds.has(String(r.id))) mergedMap.set(String(r.id), r);
  }
  for (const vr of vaultRows) {
    if (vr && vr.id && !vaultDeletedIds.has(String(vr.id))) {
      if (filters) {
        let match = true;
        for (const [col, val] of Object.entries(filters)) {
          if (String(vr[col] ?? '') !== String(val)) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }
      const existing = mergedMap.get(String(vr.id)) || {};
      mergedMap.set(String(vr.id), { ...existing, ...vr });
    }
  }

  return Array.from(mergedMap.values()).map(mapper);
}

// ─── API pública do adaptador ────────────────────────────────────────────────

/**
 * Adaptador Supabase — mesma interface do `db` em storage.ts.
 * Use junto com a camada localStorage como dual-write durante a transição.
 */
export const supabaseAdapter = {
  get enabled(): boolean {
    return isSupabaseEnabled();
  },

  // Organizações
  async getOrganizations(): Promise<Organization[]> {
    return supabaseSelect('organizations', rowToOrg);
  },
  async getOrganization(orgId: string): Promise<Organization | undefined> {
    if (orgId.startsWith(VAULT_PREFIX)) return undefined;
    const list = await supabaseSelect('organizations', rowToOrg, { id: orgId });
    return list[0];
  },
  async saveOrganization(org: Organization): Promise<void> {
    await supabaseUpsert('organizations', orgToRow(org));
  },
  async deleteOrganization(orgId: string): Promise<void> {
    await supabaseDelete('organizations', orgId);
  },

  // Usuários
  async getUsers(orgId?: string): Promise<User[]> {
    return supabaseSelect('users', rowToUser, orgId ? { organizacao_id: orgId } : undefined);
  },
  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!supabase) return undefined;
    const { data } = await supabase.from('users').select('*').eq('email', email.toLowerCase()).limit(1);
    return data?.[0] ? rowToUser(data[0]) : undefined;
  },
  async saveUser(user: User): Promise<void> {
    await supabaseUpsert('users', userToRow(user));
  },

  // Alunos
  async getStudents(orgId?: string): Promise<Student[]> {
    return supabaseSelect('students', rowToStudent, orgId ? { organizacao_id: orgId } : undefined);
  },
  async getStudentById(studentId: string): Promise<Student | undefined> {
    const list = await supabaseSelect('students', rowToStudent, { id: studentId });
    return list[0];
  },
  async getStudentByCPFFingerprint(cpfFingerprint: string): Promise<Student | undefined> {
    const list = await supabaseSelect('students', rowToStudent, { cpf_fingerprint: cpfFingerprint });
    return list[0];
  },
  async saveStudent(student: Student): Promise<void> {
    await supabaseUpsert('students', studentToRow(student));
  },

  // Veículos
  async getVehicles(orgId?: string): Promise<Vehicle[]> {
    return supabaseSelect('vehicles', rowToVehicle, orgId ? { organizacao_id: orgId } : undefined);
  },
  async saveVehicle(vehicle: Vehicle): Promise<void> {
    await supabaseUpsert('vehicles', vehicleToRow(vehicle));
  },
  async saveVehiclesBatch(vehicles: Vehicle[]): Promise<void> {
    if (!supabase || vehicles.length === 0) return;
    await upsertVaultRowsBatch('vehicles', vehicles.map(vehicleToRow));
  },
  async deleteVehicle(id: string): Promise<void> {
    await supabaseDelete('vehicles', id);
  },
  async deleteVehiclesBatch(ids: string[]): Promise<void> {
    if (!supabase || ids.length === 0) return;
    await deleteVaultRowsBatch('vehicles', ids);
  },
  async getDeletedVehicleIds(): Promise<string[]> {
    const set = await readVaultDeletedIds('vehicles');
    return Array.from(set);
  },

  // Slots de Agenda
  async getSlots(orgId?: string): Promise<AvailableSlot[]> {
    if (!supabase) return [];
    const pageSize = 1000;
    let allRows: any[] = [];
    let from = 0;
    while (true) {
      let q = supabase
        .from('available_slots')
        .select('*')
        .range(from, from + pageSize - 1);
      if (orgId) {
        q = q.eq('organizacao_id', orgId);
      }
      const { data, error } = await q;
      if (error) {
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
      if (from >= 15000) break; // safety cap
    }
    const vaultRows = await readVaultRows('available_slots');
    const mergedMap = new Map<string, any>();
    for (const r of allRows) {
      if (r && r.id) mergedMap.set(String(r.id), r);
    }
    for (const vr of vaultRows) {
      if (vr && vr.id) {
        if (orgId && String(vr.organizacao_id || '') !== orgId) continue;
        mergedMap.set(String(vr.id), { ...(mergedMap.get(String(vr.id)) || {}), ...vr });
      }
    }
    return Array.from(mergedMap.values()).map(rowToSlot);
  },
  async saveSlot(slot: AvailableSlot): Promise<void> {
    await supabaseUpsert('available_slots', slotToRow(slot));
  },
  async saveSlotsBatch(slots: AvailableSlot[]): Promise<void> {
    if (!supabase || slots.length === 0) return;
    const rows = slots.map(slotToRow);
    await upsertVaultRowsBatch('available_slots', rows);
    const chunkSize = 400;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const { error } = await supabase.from('available_slots').upsert(chunk, { onConflict: 'id' });
      if (error && error.code !== '42501') {
        console.error('[Supabase] Erro em saveSlotsBatch:', error.message);
      }
    }
  },
  async deleteSlot(id: string): Promise<void> {
    await supabaseDelete('available_slots', id);
  },
  async deleteSlotsBatch(ids: string[]): Promise<void> {
    if (!supabase || ids.length === 0) return;
    await deleteVaultRowsBatch('available_slots', ids);
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await supabase.from('available_slots').delete().in('id', chunk);
      if (error && error.code !== '42501') {
        console.error('[Supabase] Erro em deleteSlotsBatch:', error.message);
      }
    }
  },

  // Aulas
  async getLessons(orgId?: string): Promise<Lesson[]> {
    return supabaseSelect('lessons', rowToLesson, orgId ? { organizacao_id: orgId } : undefined);
  },
  async getLessonsByStudent(studentId: string): Promise<Lesson[]> {
    return supabaseSelect('lessons', rowToLesson, { aluno_id: studentId });
  },
  async saveLesson(lesson: Lesson): Promise<void> {
    await supabaseUpsert('lessons', lessonToRow(lesson));
  },

  // Contas a Receber
  async getAccountsReceivable(orgId?: string): Promise<AccountReceivable[]> {
    return supabaseSelect('accounts_receivable', rowToAccount, orgId ? { organizacao_id: orgId } : undefined);
  },
  async saveAccountReceivable(account: AccountReceivable): Promise<void> {
    await supabaseUpsert('accounts_receivable', accountToRow(account));
  },

  // Pagamentos
  async getPayments(orgId?: string): Promise<PaymentRecord[]> {
    return supabaseSelect('payment_records', rowToPayment, orgId ? { organizacao_id: orgId } : undefined);
  },
  async savePayment(payment: PaymentRecord): Promise<void> {
    await supabaseUpsert('payment_records', paymentToRow(payment));
  },

  // Despesas
  async getExpenses(orgId?: string): Promise<Expense[]> {
    return supabaseSelect('expenses', rowToExpense, orgId ? { organizacao_id: orgId } : undefined);
  },
  async saveExpense(expense: Expense): Promise<void> {
    await supabaseUpsert('expenses', expenseToRow(expense));
  },
  async deleteExpense(id: string): Promise<void> {
    await supabaseDelete('expenses', id);
  },

  // Investimentos
  async getInvestments(orgId?: string): Promise<Investment[]> {
    return supabaseSelect('investments', rowToInvestment, orgId ? { organizacao_id: orgId } : undefined);
  },
  async saveInvestment(investment: Investment): Promise<void> {
    await supabaseUpsert('investments', investmentToRow(investment));
  },
  async deleteInvestment(id: string): Promise<void> {
    await supabaseDelete('investments', id);
  },

  // Pacotes
  async getPackages(orgId?: string): Promise<PackageOffer[]> {
    return supabaseSelect('package_offers', rowToPackage, orgId ? { organizacao_id: orgId } : undefined);
  },
  async savePackage(pkg: PackageOffer): Promise<void> {
    await supabaseUpsert('package_offers', packageToRow(pkg));
  },
  async savePackagesBatch(pkgs: PackageOffer[]): Promise<void> {
    if (!supabase || pkgs.length === 0) return;
    await upsertVaultRowsBatch('package_offers', pkgs.map(packageToRow));
  },
  async deletePackage(id: string): Promise<void> {
    await supabaseDelete('package_offers', id);
  },
  async deletePackagesBatch(ids: string[]): Promise<void> {
    if (!supabase || ids.length === 0) return;
    await deleteVaultRowsBatch('package_offers', ids);
  },

  // Audit Logs
  async getAuditLogs(orgId: string): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { organizacao_id: orgId });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getNotificationAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'StudentNotification' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getCoverageAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'InstructorCoverage' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getStudentLeadAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'StudentLeadRequest' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getPackageMetaAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'PackageOfferMeta' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getStudentMetaAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'StudentFichaMeta' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async getSignatureMetaAuditLogs(): Promise<AuditLog[]> {
    const list = await supabaseSelect('audit_logs', rowToAudit, { entidade: 'InstructorSignatureMeta' });
    return list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || '')).slice(0, 500);
  },
  async addAuditLog(log: AuditLog): Promise<void> {
    await supabaseUpsert('audit_logs', auditToRow(log));
  },

  // WhatsApp Logs
  async getWhatsAppLogs(orgId: string): Promise<WhatsAppReminderLog[]> {
    const list = await supabaseSelect(
      'whatsapp_logs',
      (r: any): WhatsAppReminderLog => ({
        id: r.id,
        organizacaoId: r.organizacao_id,
        alunoId: r.aluno_id,
        alunoNome: r.aluno_nome,
        telefone: r.telefone,
        valorCentavos: r.valor_centavos,
        dataVencimento: r.data_vencimento,
        mensagem: r.mensagem,
        enviadoEm: r.enviado_em,
        status: r.status,
      }),
      { organizacao_id: orgId }
    );
    return list.sort((a, b) => (b.enviadoEm || '').localeCompare(a.enviadoEm || ''));
  },
  async logWhatsApp(log: WhatsAppReminderLog): Promise<void> {
    await supabaseUpsert('whatsapp_logs', whatsappToRow(log));
  },

  // Student Transfers
  async saveTransfer(transfer: StudentTransferHistory): Promise<void> {
    await supabaseUpsert('student_transfers', {
      id: transfer.id,
      organizacao_id: transfer.organizacaoId,
      aluno_id: transfer.alunoId,
      aluno_nome: transfer.alunoNome,
      aluno_cpf_mascarado: transfer.alunoCpfMascarado,
      instrutor_anterior_id: transfer.instrutorAnteriorId,
      instrutor_anterior_nome: transfer.instrutorAnteriorNome,
      instrutor_novo_id: transfer.instrutorNovoId,
      instrutor_novo_nome: transfer.instrutorNovoNome,
      motivo: transfer.motivo,
      aulas_cumpridas_ate_transferencia: transfer.aulasCumpridasAteTransferencia,
      data_transferencia: transfer.dataTransferencia,
      autor_id: transfer.autorId,
      autor_nome: transfer.autorNome,
    });
  },

  // Cupons de Desconto (PLATAFORMA e ALUNO)
  async getCoupons(): Promise<DiscountCoupon[]> {
    return supabaseSelect('discount_coupons', rowToCoupon);
  },
  async saveCoupon(coupon: DiscountCoupon): Promise<void> {
    await supabaseUpsert('discount_coupons', couponToRow(coupon));
  },
  async deleteCoupon(id: string): Promise<void> {
    await supabaseDelete('discount_coupons', id);
  },
  async getCouponRedemptions(): Promise<CouponRedemption[]> {
    return supabaseSelect('coupon_redemptions', rowToRedemption);
  },
  async saveCouponRedemption(redemption: CouponRedemption): Promise<void> {
    await supabaseUpsert('coupon_redemptions', redemptionToRow(redemption));
  },

  // Limpeza total de dados para ambiente de produção
  async wipeAllData(options?: { keepMasterAdmin?: boolean }): Promise<void> {
    if (!supabase) return;
    try {
      // Remove todos os vaults de sincronização
      const vaultIds = Array.from(VAULT_TABLES).map((t) => `${VAULT_PREFIX}${t}`);
      await supabase.from('organizations').delete().in('id', vaultIds);

      // Ordem reversa de integridade referencial:
      await supabase.from('coupon_redemptions').delete().neq('id', '___none___');
      await supabase.from('discount_coupons').delete().neq('id', '___none___');
      await supabase.from('whatsapp_logs').delete().neq('id', '___none___');
      await supabase.from('student_transfers').delete().neq('id', '___none___');
      await supabase.from('audit_logs').delete().neq('id', '___none___');
      await supabase.from('payment_records').delete().neq('id', '___none___');
      await supabase.from('accounts_receivable').delete().neq('id', '___none___');
      await supabase.from('lessons').delete().neq('id', '___none___');
      await supabase.from('available_slots').delete().neq('id', '___none___');
      await supabase.from('package_offers').delete().neq('id', '___none___');
      await supabase.from('investments').delete().neq('id', '___none___');
      await supabase.from('expenses').delete().neq('id', '___none___');
      await supabase.from('vehicles').delete().neq('id', '___none___');
      await supabase.from('students').delete().neq('id', '___none___');

      if (!options?.keepMasterAdmin) {
        await supabase.from('users').delete().neq('id', '___none___');
        await supabase.from('organizations').delete().neq('id', '___none___');
      } else {
        await supabase.from('users').delete().neq('email', 'cassiordcosta@gmail.com');
      }
    } catch (e) {
      console.error('[Supabase] Erro ao limpar tabelas no Supabase:', e);
    }
  },
};

export default supabaseAdapter;

