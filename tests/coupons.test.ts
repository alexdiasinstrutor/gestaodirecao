/**
 * ============================================================
 * TESTE AUTOMATIZADO DE VALIDAÇÃO: CUPONS & CADASTROS
 * Sistema de Gestão AD (Auto Direção)
 * ============================================================
 * Executa uma suíte abrangente de testes unitários e de integração
 * para garantir que o fluxo de cupons (Master e Instrutor) e
 * o cadastro não sofram regressões e respeitem todas as regras.
 * ============================================================
 */

import {
  normalizeCouponCode,
  generateCouponCode,
  addMonths,
  addDays,
  validateCouponDefinition,
  checkCouponApplicability,
  calculateCouponDiscount,
  buildPlatformSubscription
} from '../src/lib/coupons.ts';
import { couponStore } from '../src/lib/couponStore.ts';
import type { DiscountCoupon } from '../src/types/index.ts';

// Mock de localStorage simples para Node runner
const memoryStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => memoryStorage.get(k) ?? null,
  setItem: (k: string, v: string) => memoryStorage.set(k, String(v)),
  removeItem: (k: string) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear()
};

let passed = 0;
let failed = 0;
const results: { name: string; ok: boolean; error?: string }[] = [];

function assert(condition: boolean, msg: string) {
  if (!condition) {
    throw new Error(msg);
  }
}

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    results.push({ name, ok: true });
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    results.push({ name, ok: false, error: err?.message || String(err) });
    console.error(`  ✗ ${name} -> ${err?.message}`);
  }
}

console.log('\n=== INICIANDO SUÍTE DE TESTES AUTOMATIZADOS: CUPONS & CADASTRO ===\n');

// 1. Normalização e geração de códigos
test('normalizeCouponCode deve converter para uppercase sem acentos e remover caracteres inválidos', () => {
  assert(normalizeCouponCode('  promoção-100!  ') === 'PROMOCAO-100', 'Falha na normalização');
  assert(normalizeCouponCode('cupom_especial') === 'CUPOM_ESPECIAL', 'Falha com underline');
});

test('generateCouponCode deve gerar código formatado com prefixo limpo', () => {
  const code = generateCouponCode('GESTAOAD');
  assert(code.startsWith('GESTAOAD-'), 'Prefixo incorreto');
  assert(code.length >= 10, 'Tamanho insuficiente');
});

// 2. Manipulação de datas seguras
test('addMonths deve somar meses de teste corretamente', () => {
  const base = new Date(2026, 0, 15); // 15 Jan 2026
  const plus3 = addMonths(base, 3);
  assert(plus3.getMonth() === 3, 'Deveria ser Abril');
  assert(plus3.getDate() === 15, 'Deveria manter o dia 15');
});

// 3. Validação de Definições de Cupons
test('validateCouponDefinition deve validar limites e regras de escopo', () => {
  const invalidCoupon: Partial<DiscountCoupon> = {
    codigo: 'AB', // muito curto
    escopo: 'PLATAFORMA',
    tipoDesconto: 'PERCENTUAL',
    percentual: 150 // inválido
  };
  const err = validateCouponDefinition(invalidCoupon);
  assert(err !== null, 'Deveria ter detectado erro de código curto');

  const alunoPeriodoGratis: Partial<DiscountCoupon> = {
    codigo: 'ALUNO10',
    escopo: 'ALUNO',
    tipoDesconto: 'PERIODO_GRATIS',
    mesesGratis: 3
  };
  assert(validateCouponDefinition(alunoPeriodoGratis) !== null, 'Cupom de aluno não pode ser período grátis');
});

// 4. Teste de Desconto Período Grátis (Master)
test('calculateCouponDiscount com PERIODO_GRATIS deve calcular meses corretos', () => {
  const coupon: DiscountCoupon = {
    id: 'c1',
    codigo: 'TESTE-3M',
    escopo: 'PLATAFORMA',
    tipoDesconto: 'PERIODO_GRATIS',
    mesesGratis: 3,
    usosRealizados: 0,
    ativo: true,
    criadoPorId: 'master',
    criadoPorNome: 'Master',
    criadoEm: '2026-01-01'
  };
  const res = calculateCouponDiscount(coupon, 13990); // R$ 139,90
  assert(res.mesesGratis === 3, 'Meses grátis incorreto');
  assert(res.valorFinalCentavos === 13990, 'Valor final da mensalidade após o teste deve ser preservado');
});

// 5. Teste de Desconto Percentual e Fixo no Plano SaaS
test('calculateCouponDiscount percentual e valor fixo', () => {
  const cPct: DiscountCoupon = {
    id: 'c2',
    codigo: 'DESC-20',
    escopo: 'PLATAFORMA',
    tipoDesconto: 'PERCENTUAL',
    percentual: 20,
    usosRealizados: 0,
    ativo: true,
    criadoPorId: 'master',
    criadoPorNome: 'Master',
    criadoEm: '2026-01-01'
  };
  const resPct = calculateCouponDiscount(cPct, 10000); // R$ 100,00
  assert(resPct.valorDescontoCentavos === 2000, 'Desconto percentual incorreto');
  assert(resPct.valorFinalCentavos === 8000, 'Valor final percentual incorreto');

  const cFixo: DiscountCoupon = {
    id: 'c3',
    codigo: 'FIXO-30',
    escopo: 'ALUNO',
    tipoDesconto: 'VALOR_FIXO',
    valorCentavos: 3000, // R$ 30,00
    usosRealizados: 0,
    ativo: true,
    criadoPorId: 'inst',
    criadoPorNome: 'Instrutor',
    criadoEm: '2026-01-01'
  };
  const resFixo = calculateCouponDiscount(cFixo, 180000); // R$ 1.800,00
  assert(resFixo.valorDescontoCentavos === 3000, 'Desconto fixo incorreto');
  assert(resFixo.valorFinalCentavos === 177000, 'Valor final fixo incorreto');
});

// 6. Teste de Aplicabilidade (Expiração, Limite de Usos e Escopo)
test('checkCouponApplicability deve barrar cupom inativo, expirado ou com limite esgotado', () => {
  const cInativo: DiscountCoupon = {
    id: 'c4',
    codigo: 'OFF',
    escopo: 'PLATAFORMA',
    tipoDesconto: 'PERCENTUAL',
    percentual: 10,
    ativo: false,
    usosRealizados: 0,
    criadoPorId: 'm',
    criadoPorNome: 'M',
    criadoEm: '2026-01-01'
  };
  const resInativo = checkCouponApplicability(cInativo, { escopo: 'PLATAFORMA' });
  assert(!resInativo.valid, 'Deveria barrar inativo');

  const cExpirado: DiscountCoupon = {
    ...cInativo,
    ativo: true,
    validoAte: '2025-01-01'
  };
  const resExpirado = checkCouponApplicability(cExpirado, { escopo: 'PLATAFORMA', now: new Date(2026, 0, 1) });
  assert(!resExpirado.valid, 'Deveria barrar expirado');

  const cEsgotado: DiscountCoupon = {
    ...cInativo,
    ativo: true,
    limiteUsos: 5,
    usosRealizados: 5
  };
  assert(!checkCouponApplicability(cEsgotado, { escopo: 'PLATAFORMA' }).valid, 'Deveria barrar esgotado');
});

// 7. Teste de Construção de Assinatura com Cupom de Teste (buildPlatformSubscription)
test('buildPlatformSubscription deve criar assinatura em status TESTE com data estendida', () => {
  const cTeste: DiscountCoupon = {
    id: 'ct',
    codigo: 'TESTE-6M',
    escopo: 'PLATAFORMA',
    tipoDesconto: 'PERIODO_GRATIS',
    mesesGratis: 6,
    usosRealizados: 0,
    ativo: true,
    criadoPorId: 'm',
    criadoPorNome: 'Master',
    criadoEm: '2026-01-01'
  };
  const now = new Date(2026, 2, 1); // 01 Março 2026
  const sub = buildPlatformSubscription({
    planPriceCentavos: 13990,
    planDays: 30,
    coupon: cTeste,
    now
  });
  assert(sub.status === 'TESTE', 'Status deveria ser TESTE');
  assert(sub.dataVencimentoPlano === '2026-09-01', 'Data de vencimento deveria ser em Setembro');
  assert(sub.valorMensalidadeCentavos === 13990, 'Mensalidade regular mantida para após o teste');
});

// 8. Teste de Integração com couponStore (Save, List, Preview, Redeem)
test('couponStore deve persistir, auditar contagem de usos e registrar resgate', () => {
  couponStore.replaceAll([]); // limpa memória
  const saveRes = couponStore.save({
    id: 'cp_integ',
    codigo: 'BOASVINDAS-50',
    escopo: 'PLATAFORMA',
    tipoDesconto: 'VALOR_FIXO',
    valorCentavos: 5000,
    limiteUsos: 2,
    usosRealizados: 0,
    ativo: true,
    criadoPorId: 'm',
    criadoPorNome: 'Master',
    criadoEm: '2026-01-01'
  });
  assert(saveRes.success, 'Falha ao salvar cupom');

  // Preview não consome
  const preview = couponStore.preview('BOASVINDAS-50', { escopo: 'PLATAFORMA' }, 13990);
  assert(preview.valid && preview.result?.valorFinalCentavos === 8990, 'Preview com valor incorreto');
  assert(couponStore.getByCode('BOASVINDAS-50')?.usosRealizados === 0, 'Preview não deve incrementar uso');

  // Redeem consome 1 uso
  const redeem1 = couponStore.redeem('BOASVINDAS-50', { escopo: 'PLATAFORMA' }, 13990, {
    organizacaoId: 'org_teste',
    usuarioId: 'usr_teste'
  });
  assert(redeem1.valid, 'Falha no 1º resgate');
  assert(couponStore.getByCode('BOASVINDAS-50')?.usosRealizados === 1, 'Uso deveria ser 1');

  // Redeem consome 2º uso
  const redeem2 = couponStore.redeem('BOASVINDAS-50', { escopo: 'PLATAFORMA' }, 13990, {
    organizacaoId: 'org_teste2',
    usuarioId: 'usr_teste2'
  });
  assert(redeem2.valid, 'Falha no 2º resgate');
  assert(couponStore.getByCode('BOASVINDAS-50')?.usosRealizados === 2, 'Uso deveria ser 2');

  // 3º uso deve ser rejeitado por atingir limite
  const redeem3 = couponStore.redeem('BOASVINDAS-50', { escopo: 'PLATAFORMA' }, 13990, {
    organizacaoId: 'org_teste3'
  });
  assert(!redeem3.valid, '3º resgate deveria falhar');
});

console.log(`\n=== RESULTADO FINAL: ${passed} PASSARAM, ${failed} FALHARAM ===\n`);

if (failed > 0) {
  process.exit(1);
}
