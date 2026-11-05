/**
 * ============================================================
 * CUPONS DE DESCONTO — Regras de negócio puras (sem I/O)
 * ============================================================
 * Dois tipos de seção de desconto:
 *  - PLATAFORMA: criado pelo Master para a assinatura SaaS do instrutor/autoescola
 *      · PERIODO_GRATIS (3, 6, 12 meses de teste…)
 *      · PERCENTUAL / VALOR_FIXO sobre a mensalidade
 *  - ALUNO: criado pelo instrutor para os pacotes de aulas dele
 *      · PERCENTUAL / VALOR_FIXO sobre o valor do pacote
 *
 * Este módulo não acessa localStorage nem Supabase, para ser
 * 100% testável de forma automatizada (tests/coupons.test.ts).
 * ============================================================
 */

import type { CouponScope, DiscountCoupon } from '../types';

export const FREE_PERIOD_PRESETS = [3, 6, 12];

export interface CouponValidationContext {
  escopo: CouponScope;
  referenciaId?: string; // ID do plano SaaS (PLATAFORMA) ou do pacote (ALUNO)
  instrutorId?: string; // ALUNO: instrutor dono do pacote
  organizacaoId?: string; // ALUNO: organização do pacote
  now?: Date;
}

export interface CouponDiscountResult {
  valorOriginalCentavos: number;
  valorDescontoCentavos: number;
  valorFinalCentavos: number;
  mesesGratis: number;
  resumo: string;
}

export interface PlatformSubscriptionResult {
  status: 'ATIVO' | 'TESTE';
  dataVencimentoPlano: string; // YYYY-MM-DD
  valorMensalidadeCentavos: number;
  resumo: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function normalizeCouponCode(raw: string): string {
  return (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '');
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateCouponCode(prefix = 'CUPOM', random: () => number = Math.random): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += CODE_CHARS[Math.floor(random() * CODE_CHARS.length) % CODE_CHARS.length];
  }
  const cleanPrefix = normalizeCouponCode(prefix).slice(0, 12) || 'CUPOM';
  return `${cleanPrefix}-${suffix}`;
}

/** Data local no formato YYYY-MM-DD (evita deslocamento de fuso do toISOString). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Soma meses mantendo o dia (ajusta para o último dia do mês quando necessário). */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(base.getDate(), lastDay));
  return d;
}

export function addDays(base: Date, days: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0, 0);
  d.setDate(d.getDate() + days);
  return d;
}

function brl(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

// ─── Validação da definição (formulário de criação) ─────────────────────────

export function validateCouponDefinition(c: Partial<DiscountCoupon>): string | null {
  const code = normalizeCouponCode(c.codigo || '');
  if (code.length < 3 || code.length > 30) {
    return 'O código do cupom deve ter entre 3 e 30 caracteres (letras, números, "-" ou "_").';
  }
  if (c.escopo !== 'PLATAFORMA' && c.escopo !== 'ALUNO') {
    return 'Escopo do cupom inválido.';
  }
  if (c.escopo === 'ALUNO') {
    if (c.tipoDesconto === 'PERIODO_GRATIS') {
      return 'Cupons de aluno aceitam apenas desconto percentual ou em valor sobre o pacote.';
    }
    if (!c.instrutorId || !c.organizacaoId) {
      return 'Cupom de aluno precisa estar vinculado a um instrutor e organização.';
    }
  }
  switch (c.tipoDesconto) {
    case 'PERIODO_GRATIS': {
      const m = Number(c.mesesGratis);
      if (!Number.isInteger(m) || m < 1 || m > 36) return 'Informe de 1 a 36 meses de período grátis.';
      break;
    }
    case 'PERCENTUAL': {
      const p = Number(c.percentual);
      if (!Number.isFinite(p) || p <= 0 || p > 100) return 'O percentual de desconto deve estar entre 1% e 100%.';
      break;
    }
    case 'VALOR_FIXO': {
      const v = Number(c.valorCentavos);
      if (!Number.isInteger(v) || v <= 0) return 'Informe um valor de desconto maior que zero.';
      break;
    }
    default:
      return 'Tipo de desconto inválido.';
  }
  if (c.limiteUsos !== undefined && (Number(c.limiteUsos) < 0 || !Number.isInteger(Number(c.limiteUsos)))) {
    return 'O limite de usos deve ser um número inteiro (0 = ilimitado).';
  }
  if (c.duracaoMeses !== undefined && (Number(c.duracaoMeses) < 0 || !Number.isInteger(Number(c.duracaoMeses)))) {
    return 'A duração do desconto deve ser um número inteiro de meses (0 = permanente).';
  }
  if (c.validoAte && !/^\d{4}-\d{2}-\d{2}$/.test(c.validoAte)) {
    return 'Data de validade inválida.';
  }
  return null;
}

// ─── Aplicabilidade (no momento do uso) ─────────────────────────────────────

export function checkCouponApplicability(
  coupon: DiscountCoupon | undefined | null,
  ctx: CouponValidationContext
): { valid: boolean; error?: string } {
  if (!coupon) return { valid: false, error: 'Cupom não encontrado. Verifique o código digitado.' };
  if (!coupon.ativo) return { valid: false, error: 'Este cupom está desativado.' };
  if (coupon.escopo !== ctx.escopo) {
    return {
      valid: false,
      error:
        ctx.escopo === 'PLATAFORMA'
          ? 'Este cupom é de pacote de aluno e não vale para a assinatura do sistema.'
          : 'Este cupom é da assinatura do sistema e não vale para pacotes de aulas.'
    };
  }

  const today = toLocalISODate(ctx.now || new Date());
  if (coupon.validoAte && today > coupon.validoAte) {
    return { valid: false, error: 'Este cupom expirou.' };
  }

  const limite = Number(coupon.limiteUsos || 0);
  if (limite > 0 && (coupon.usosRealizados || 0) >= limite) {
    return { valid: false, error: 'Este cupom atingiu o limite de utilizações.' };
  }

  if (coupon.escopo === 'ALUNO') {
    if (ctx.instrutorId && coupon.instrutorId !== ctx.instrutorId) {
      return { valid: false, error: 'Este cupom não pertence ao instrutor selecionado.' };
    }
    if (ctx.organizacaoId && coupon.organizacaoId && coupon.organizacaoId !== ctx.organizacaoId) {
      return { valid: false, error: 'Este cupom não pertence a esta autoescola.' };
    }
  }

  const permitidos = coupon.planosPermitidos || [];
  if (permitidos.length > 0 && (!ctx.referenciaId || !permitidos.includes(ctx.referenciaId))) {
    return {
      valid: false,
      error: coupon.escopo === 'PLATAFORMA'
        ? 'Este cupom não é válido para o plano selecionado.'
        : 'Este cupom não é válido para o pacote selecionado.'
    };
  }

  return { valid: true };
}

// ─── Cálculo do desconto ────────────────────────────────────────────────────

export function calculateCouponDiscount(coupon: DiscountCoupon, valorOriginalCentavos: number): CouponDiscountResult {
  const original = Math.max(0, Math.round(valorOriginalCentavos || 0));

  if (coupon.tipoDesconto === 'PERIODO_GRATIS') {
    const meses = Math.max(0, Math.round(coupon.mesesGratis || 0));
    return {
      valorOriginalCentavos: original,
      valorDescontoCentavos: original * meses,
      valorFinalCentavos: original,
      mesesGratis: meses,
      resumo: `${meses} ${meses === 1 ? 'mês' : 'meses'} grátis; depois ${brl(original)}/mês`
    };
  }

  let desconto = 0;
  if (coupon.tipoDesconto === 'PERCENTUAL') {
    const pct = Math.min(100, Math.max(0, Number(coupon.percentual) || 0));
    desconto = Math.round((original * pct) / 100);
  } else if (coupon.tipoDesconto === 'VALOR_FIXO') {
    desconto = Math.max(0, Math.round(coupon.valorCentavos || 0));
  }
  desconto = Math.min(desconto, original);
  const final = original - desconto;

  const label = coupon.tipoDesconto === 'PERCENTUAL' ? `${Number(coupon.percentual)}% de desconto` : `${brl(desconto)} de desconto`;
  const duracao =
    coupon.escopo === 'PLATAFORMA' && coupon.duracaoMeses && coupon.duracaoMeses > 0
      ? ` por ${coupon.duracaoMeses} ${coupon.duracaoMeses === 1 ? 'mês' : 'meses'}`
      : '';

  return {
    valorOriginalCentavos: original,
    valorDescontoCentavos: desconto,
    valorFinalCentavos: final,
    mesesGratis: 0,
    resumo: `${label}${duracao}: ${brl(original)} → ${brl(final)}`
  };
}

/** Descrição curta do benefício para listagens. */
export function describeCoupon(coupon: DiscountCoupon): string {
  if (coupon.tipoDesconto === 'PERIODO_GRATIS') {
    return `${coupon.mesesGratis} ${coupon.mesesGratis === 1 ? 'mês' : 'meses'} de teste grátis`;
  }
  const base = coupon.tipoDesconto === 'PERCENTUAL' ? `${coupon.percentual}% off` : `${brl(coupon.valorCentavos || 0)} off`;
  const alvo = coupon.escopo === 'PLATAFORMA' ? ' na mensalidade' : ' no pacote';
  const duracao =
    coupon.escopo === 'PLATAFORMA' && coupon.duracaoMeses && coupon.duracaoMeses > 0
      ? ` (${coupon.duracaoMeses} ${coupon.duracaoMeses === 1 ? 'mês' : 'meses'})`
      : '';
  return `${base}${alvo}${duracao}`;
}

// ─── Assinatura SaaS (cadastro do instrutor) ────────────────────────────────

/**
 * Define status, vencimento e mensalidade da organização recém-cadastrada
 * a partir do plano escolhido e (opcionalmente) de um cupom PLATAFORMA já validado.
 */
export function buildPlatformSubscription(params: {
  planPriceCentavos: number;
  planDays: number;
  coupon?: DiscountCoupon | null;
  now?: Date;
}): PlatformSubscriptionResult {
  const now = params.now || new Date();
  const price = Math.max(0, Math.round(params.planPriceCentavos || 0));
  const days = Math.max(1, Math.round(params.planDays || 30));

  if (!params.coupon) {
    return {
      status: 'ATIVO',
      dataVencimentoPlano: toLocalISODate(addDays(now, days)),
      valorMensalidadeCentavos: price,
      resumo: `Mensalidade de ${brl(price)}`
    };
  }

  const result = calculateCouponDiscount(params.coupon, price);

  if (params.coupon.tipoDesconto === 'PERIODO_GRATIS') {
    return {
      status: 'TESTE',
      dataVencimentoPlano: toLocalISODate(addMonths(now, result.mesesGratis)),
      valorMensalidadeCentavos: price,
      resumo: result.resumo
    };
  }

  return {
    status: 'ATIVO',
    dataVencimentoPlano: toLocalISODate(addDays(now, days)),
    valorMensalidadeCentavos: result.valorFinalCentavos,
    resumo: result.resumo
  };
}

