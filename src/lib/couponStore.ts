/**
 * ============================================================
 * CUPONS DE DESCONTO — Persistência local (offline-first)
 * ============================================================
 * Grava no localStorage e notifica ganchos de sincronização
 * (Supabase) configurados por storage.ts. Não importa o cliente
 * Supabase diretamente para poder ser testado isoladamente.
 * ============================================================
 */

import type { CouponRedemption, CouponScope, DiscountCoupon } from '../types';
import {
  calculateCouponDiscount,
  checkCouponApplicability,
  CouponDiscountResult,
  CouponValidationContext,
  normalizeCouponCode,
  validateCouponDefinition
} from './coupons';

export const COUPON_STORAGE_KEYS = {
  COUPONS: 'agd_discount_coupons',
  REDEMPTIONS: 'agd_coupon_redemptions'
};

export interface CouponSyncHooks {
  saveCoupon?: (c: DiscountCoupon) => Promise<void> | void;
  deleteCoupon?: (id: string) => Promise<void> | void;
  saveRedemption?: (r: CouponRedemption) => Promise<void> | void;
}

let hooks: CouponSyncHooks = {};

export function setCouponSyncHooks(h: CouponSyncHooks): void {
  hooks = h || {};
}

function safeHook(fn: (() => Promise<void> | void) | undefined): void {
  if (!fn) return;
  try {
    const r = fn();
    if (r && typeof (r as Promise<void>).catch === 'function') {
      (r as Promise<void>).catch((e) => console.error('[Cupons] Falha de sincronização remota:', e));
    }
  } catch (e) {
    console.error('[Cupons] Falha de sincronização remota:', e);
  }
}

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (e) {
    console.error(`[Cupons] Erro ao gravar ${key}:`, e);
  }
}

export interface CouponPreview {
  valid: boolean;
  error?: string;
  coupon?: DiscountCoupon;
  result?: CouponDiscountResult;
}

export interface CouponListFilter {
  escopo?: CouponScope;
  instrutorId?: string;
  organizacaoId?: string;
}

export const couponStore = {
  getAll(): DiscountCoupon[] {
    return read<DiscountCoupon>(COUPON_STORAGE_KEYS.COUPONS);
  },

  list(filter: CouponListFilter = {}): DiscountCoupon[] {
    return this.getAll()
      .filter((c) => !filter.escopo || c.escopo === filter.escopo)
      .filter((c) => !filter.instrutorId || c.instrutorId === filter.instrutorId)
      .filter((c) => !filter.organizacaoId || c.organizacaoId === filter.organizacaoId)
      .sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
  },

  getByCode(code: string): DiscountCoupon | undefined {
    const clean = normalizeCouponCode(code);
    if (!clean) return undefined;
    return this.getAll().find((c) => c.codigo === clean);
  },

  /** Cria ou atualiza um cupom. Garante código único e definição válida. */
  save(coupon: DiscountCoupon): { success: boolean; error?: string; coupon?: DiscountCoupon } {
    const normalized: DiscountCoupon = {
      ...coupon,
      codigo: normalizeCouponCode(coupon.codigo),
      usosRealizados: coupon.usosRealizados || 0,
      planosPermitidos: coupon.planosPermitidos || []
    };
    const defError = validateCouponDefinition(normalized);
    if (defError) return { success: false, error: defError };

    const list = this.getAll();
    const duplicate = list.find((c) => c.codigo === normalized.codigo && c.id !== normalized.id);
    if (duplicate) return { success: false, error: `Já existe um cupom com o código ${normalized.codigo}.` };

    const idx = list.findIndex((c) => c.id === normalized.id);
    if (idx >= 0) {
      // Nunca regride o contador de usos por edição
      normalized.usosRealizados = Math.max(list[idx].usosRealizados || 0, normalized.usosRealizados);
      list[idx] = normalized;
    } else {
      list.unshift(normalized);
    }
    write(COUPON_STORAGE_KEYS.COUPONS, list);
    safeHook(hooks.saveCoupon && (() => hooks.saveCoupon!(normalized)));
    return { success: true, coupon: normalized };
  },

  toggle(id: string): DiscountCoupon | undefined {
    const list = this.getAll();
    const c = list.find((x) => x.id === id);
    if (!c) return undefined;
    c.ativo = !c.ativo;
    write(COUPON_STORAGE_KEYS.COUPONS, list);
    safeHook(hooks.saveCoupon && (() => hooks.saveCoupon!(c)));
    return c;
  },

  /** Exclui apenas cupons nunca utilizados (preserva o histórico de resgates). */
  remove(id: string): { success: boolean; error?: string } {
    const list = this.getAll();
    const c = list.find((x) => x.id === id);
    if (!c) return { success: false, error: 'Cupom não encontrado.' };
    if ((c.usosRealizados || 0) > 0) {
      return { success: false, error: 'Cupom já utilizado não pode ser excluído. Desative-o para impedir novos usos.' };
    }
    write(COUPON_STORAGE_KEYS.COUPONS, list.filter((x) => x.id !== id));
    safeHook(hooks.deleteCoupon && (() => hooks.deleteCoupon!(id)));
    return { success: true };
  },

  /** Substitui a base local (usado na hidratação a partir do Supabase). */
  replaceAll(coupons: DiscountCoupon[], redemptions?: CouponRedemption[]): void {
    write(COUPON_STORAGE_KEYS.COUPONS, coupons);
    if (redemptions) write(COUPON_STORAGE_KEYS.REDEMPTIONS, redemptions);
  },

  getRedemptions(filter: { cupomId?: string; organizacaoId?: string; escopo?: CouponScope } = {}): CouponRedemption[] {
    return read<CouponRedemption>(COUPON_STORAGE_KEYS.REDEMPTIONS)
      .filter((r) => !filter.cupomId || r.cupomId === filter.cupomId)
      .filter((r) => !filter.organizacaoId || r.organizacaoId === filter.organizacaoId)
      .filter((r) => !filter.escopo || r.escopo === filter.escopo)
      .sort((a, b) => (b.resgatadoEm || '').localeCompare(a.resgatadoEm || ''));
  },

  /** Simula a aplicação do cupom sem consumir uso. */
  preview(code: string, ctx: CouponValidationContext, valorOriginalCentavos: number): CouponPreview {
    const coupon = this.getByCode(code);
    const check = checkCouponApplicability(coupon, ctx);
    if (!check.valid || !coupon) return { valid: false, error: check.error };
    return { valid: true, coupon, result: calculateCouponDiscount(coupon, valorOriginalCentavos) };
  },

  /** Consome 1 uso do cupom e registra o resgate. Revalida tudo antes. */
  redeem(
    code: string,
    ctx: CouponValidationContext,
    valorOriginalCentavos: number,
    meta: { organizacaoId: string; usuarioId?: string; alunoId?: string }
  ): CouponPreview & { redemption?: CouponRedemption } {
    const list = this.getAll();
    const clean = normalizeCouponCode(code);
    const coupon = list.find((c) => c.codigo === clean);
    const check = checkCouponApplicability(coupon, ctx);
    if (!check.valid || !coupon) return { valid: false, error: check.error };

    const result = calculateCouponDiscount(coupon, valorOriginalCentavos);
    coupon.usosRealizados = (coupon.usosRealizados || 0) + 1;
    write(COUPON_STORAGE_KEYS.COUPONS, list);

    const redemption: CouponRedemption = {
      id: `rdm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      cupomId: coupon.id,
      codigo: coupon.codigo,
      escopo: coupon.escopo,
      organizacaoId: meta.organizacaoId,
      usuarioId: meta.usuarioId,
      alunoId: meta.alunoId,
      referenciaId: ctx.referenciaId || '',
      valorOriginalCentavos: result.valorOriginalCentavos,
      valorDescontoCentavos: result.valorDescontoCentavos,
      valorFinalCentavos: result.valorFinalCentavos,
      mesesGratis: result.mesesGratis || undefined,
      resgatadoEm: (ctx.now || new Date()).toISOString()
    };
    const redemptions = read<CouponRedemption>(COUPON_STORAGE_KEYS.REDEMPTIONS);
    redemptions.unshift(redemption);
    write(COUPON_STORAGE_KEYS.REDEMPTIONS, redemptions);

    safeHook(hooks.saveCoupon && (() => hooks.saveCoupon!(coupon)));
    safeHook(hooks.saveRedemption && (() => hooks.saveRedemption!(redemption)));

    return { valid: true, coupon, result, redemption };
  }
};

