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
    data_cadastro: s.dataCadastro || new Date().toISOString(),
  };
}

function rowToStudent(r: any): Student {
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
  };
}

function vehicleToRow(v: Vehicle): Record<string, any> {
  return {
    id: v.id,
    organizacao_id: v.organizacaoId,
    modelo: v.modelo,
    placa: v.placa,
    ano: v.ano,
    tipo: v.tipo,
    status: v.status,
    km_atual: v.kmAtual || 0,
    proxima_revisao_km: v.proximaRevisaoKm || 10000,
  };
}

function rowToVehicle(r: any): Vehicle {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    modelo: r.modelo,
    placa: r.placa,
    ano: r.ano,
    tipo: r.tipo,
    status: r.status,
    kmAtual: r.km_atual,
    proximaRevisaoKm: r.proxima_revisao_km,
  };
}

function lessonToRow(l: Lesson): Record<string, any> {
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
    competencias_trabalhadas: l.competenciasTrabalhadas || [],
    criado_em: l.criadoEm || new Date().toISOString(),
  };
}

function rowToLesson(r: any): Lesson {
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
    competenciasTrabalhadas: r.competencias_trabalhadas,
    criadoEm: r.criado_em,
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
  };
}

function rowToPackage(r: any): PackageOffer {
  return {
    id: r.id,
    organizacaoId: r.organizacao_id,
    instrutorId: r.instrutor_id,
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

// ─── Helper genérico de upsert no Supabase ──────────────────────────────────

async function supabaseUpsert(table: string, row: Record<string, any>): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
  if (error) {
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
      }
      const retry = await supabase.from(table).upsert(fallbackRow, { onConflict: 'id' });
      if (retry.error) {
        if (table === 'students' && (retry.error.message?.includes('column') || retry.error.code === 'PGRST204')) {
          delete fallbackRow.pacote_id;
          delete fallbackRow.pacote_nome;
          delete fallbackRow.historico_transferencias;
          const retry2 = await supabase.from(table).upsert(fallbackRow, { onConflict: 'id' });
          if (retry2.error) {
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
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) {
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
  const { data, error } = await q;
  if (error) {
    console.error(`[Supabase] Erro ao ler "${table}":`, error.message);
    return [];
  }
  return (data || []).map(mapper);
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
    if (!supabase) return undefined;
    const { data } = await supabase.from('students').select('*').eq('cpf_fingerprint', cpfFingerprint).limit(1);
    return data?.[0] ? rowToStudent(data[0]) : undefined;
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
        console.error('[Supabase] Erro ao ler "available_slots":', error.message);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
      if (from >= 15000) break; // safety cap
    }
    return allRows.map(rowToSlot);
  },
  async saveSlot(slot: AvailableSlot): Promise<void> {
    await supabaseUpsert('available_slots', slotToRow(slot));
  },
  async saveSlotsBatch(slots: AvailableSlot[]): Promise<void> {
    if (!supabase || slots.length === 0) return;
    const chunkSize = 400;
    for (let i = 0; i < slots.length; i += chunkSize) {
      const chunk = slots.slice(i, i + chunkSize).map(slotToRow);
      const { error } = await supabase.from('available_slots').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error('[Supabase] Erro em saveSlotsBatch:', error.message);
      }
    }
  },
  async deleteSlot(id: string): Promise<void> {
    await supabaseDelete('available_slots', id);
  },
  async deleteSlotsBatch(ids: string[]): Promise<void> {
    if (!supabase || ids.length === 0) return;
    const chunkSize = 200;
    for (let i = 0; i < ids.length; i += chunkSize) {
      const chunk = ids.slice(i, i + chunkSize);
      const { error } = await supabase.from('available_slots').delete().in('id', chunk);
      if (error) {
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
  async deletePackage(id: string): Promise<void> {
    await supabaseDelete('package_offers', id);
  },

  // Audit Logs
  async getAuditLogs(orgId: string): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('organizacao_id', orgId)
      .order('timestamp', { ascending: false })
      .limit(500);
    return (data || []).map(rowToAudit);
  },
  async getNotificationAuditLogs(): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'StudentNotification')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) {
      return [];
    }
    return (data || []).map(rowToAudit);
  },
  async getCoverageAuditLogs(): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'InstructorCoverage')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) {
      return [];
    }
    return (data || []).map(rowToAudit);
  },
  async getStudentLeadAuditLogs(): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'StudentLeadRequest')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) {
      return [];
    }
    return (data || []).map(rowToAudit);
  },
  async getPackageMetaAuditLogs(): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'PackageOfferMeta')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) {
      return [];
    }
    return (data || []).map(rowToAudit);
  },
  async getStudentMetaAuditLogs(): Promise<AuditLog[]> {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entidade', 'StudentFichaMeta')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) {
      return [];
    }
    return (data || []).map(rowToAudit);
  },
  async addAuditLog(log: AuditLog): Promise<void> {
    await supabaseUpsert('audit_logs', auditToRow(log));
  },

  // WhatsApp Logs
  async getWhatsAppLogs(orgId: string): Promise<WhatsAppReminderLog[]> {
    if (!supabase) return [];
    const { data } = await supabase
      .from('whatsapp_logs')
      .select('*')
      .eq('organizacao_id', orgId)
      .order('enviado_em', { ascending: false });
    return (data || []).map((r: any) => ({
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
    }));
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

