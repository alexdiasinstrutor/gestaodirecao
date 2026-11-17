import { numberToWordsBRL } from '../lib/numberToWords';
import schema from './documentos_juridicos_plataforma/variaveis_schema.json';
import type { Student, User, StudentPackageContract, PackageOffer } from '../types';

let sources: Record<string, string> = {};
try {
  sources = import.meta.glob('./documentos_juridicos_plataforma/*.md', {
    query: '?raw',
    import: 'default',
    eager: true
  }) as Record<string, string>;
} catch {
  sources = {};
}

export const legalDocuments = schema.documentos;

export const LEGAL_VARIABLE_LABELS: Record<string, string> = {
  NOME_PLATAFORMA: 'Nome da Plataforma',
  NOME_INSTRUTOR: 'Nome do Instrutor',
  CPF_CNPJ_INSTRUTOR: 'CPF/CNPJ do Instrutor',
  UF: 'Estado (UF) do Instrutor',
  REGISTRO_DETRAN: 'Registro / Credencial DETRAN do Instrutor',
  CIDADE_UF_INSTRUTOR: 'Cidade/UF do Instrutor',
  NOME_ALUNO: 'Nome do Aluno',
  CPF_ALUNO: 'CPF do Aluno',
  CIDADE_UF_ALUNO: 'Cidade/UF do Aluno',
  CATEGORIA_CNH: 'Categoria CNH',
  MODALIDADE_CONTRATO: 'Plano / Modalidade Contratada',
  QTD_AULAS: 'Quantidade de Aulas',
  DURACAO_MINUTOS: 'Duração da Aula (min)',
  FORMA_PAGAMENTO_ACORDADA: 'Forma de Pagamento',
  VALOR_UNITARIO: 'Valor Unitário por Aula',
  SUBTOTAL_AULAS: 'Subtotal das Aulas',
  STATUS_EXAME: 'Cessão de Veículo para Exame',
  VALOR_ALUGUEL_EXAME: 'Valor do Aluguel para Exame',
  VALOR_TOTAL: 'Valor Total do Contrato',
  VALOR_EXTENSO: 'Valor por Extenso',
  DIAS_AVISO_EXAME: 'Dias de Aviso do Exame',
  PRAZO_VALIDADE_DIAS: 'Prazo de Validade (dias)',
  PERCENTUAL_MULTA: 'Percentual de Multa (%)',
  CIDADE_UF: 'Cidade/UF do Local',
  DATA_ACEITE_EXTENSO: 'Data do Aceite',
  HASH_INSTRUTOR: 'Assinatura Eletrônica do Instrutor',
  HASH_ALUNO: 'Assinatura Eletrônica do Aluno',
  IP_ALUNO: 'IP de Registro',
  RAZAO_SOCIAL_EMPRESA: 'Razão Social da Empresa',
  CNPJ_EMPRESA: 'CNPJ da Empresa',
  ENDERECO_EMPRESA: 'Endereço da Empresa',
  CIDADE_SEDE_EMPRESA: 'Cidade Sede',
  EMAIL_DPO_PRIVACIDADE: 'E-mail do DPO (Privacidade)',
  DATA_ATUALIZACAO: 'Data de Atualização'
};

export function renderLegalDocument(code: string, values: Record<string, string>, customSources?: Record<string, string>) {
  const definition = legalDocuments.find(document => document.codigo === code);
  if (!definition) throw new Error('Documento jurídico desconhecido.');
  const map = customSources || sources;
  const source = map['./documentos_juridicos_plataforma/' + definition.arquivo];
  if (!source) throw new Error('Modelo jurídico indisponível.');
  const missing = definition.variaveis.filter(key => !values[key]?.trim());
  const missingLabels = missing.map(key => LEGAL_VARIABLE_LABELS[key] || key.replaceAll('_', ' '));
  return {
    definition,
    missing,
    missingLabels,
    content: source.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => values[key]?.trim() || 'Não informado no cadastro')
  };
}

export async function legalHash(content: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function legalDefaults(user: User | null, student?: Student, studentUser?: User): Record<string, string> {
  const env = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env) || {};
  const instructorCityUf = user?.papel !== 'ALUNO' ? [user?.cidade, user?.estado].filter(Boolean).join('/') : '';
  const studentCityUf = [student?.cidade || studentUser?.cidade, student?.estado || studentUser?.estado].filter(Boolean).join('/');
  return {
    RAZAO_SOCIAL_EMPRESA: env.VITE_LEGAL_RAZAO_SOCIAL || 'Stark Light Save',
    CNPJ_EMPRESA: env.VITE_LEGAL_CNPJ || '23.659.019/0001-40',
    ENDERECO_EMPRESA: env.VITE_LEGAL_ENDERECO || 'Rua São Cristóvão, 36, Brasileia, Betim/MG, CEP 32600-280',
    CIDADE_SEDE_EMPRESA: env.VITE_LEGAL_CIDADE || 'Betim',
    EMAIL_DPO_PRIVACIDADE: env.VITE_LEGAL_EMAIL_DPO || 'cassiodiniz@uol.com.br',
    NOME_PLATAFORMA: 'Gestão AD (Auto Direção)',
    DATA_ATUALIZACAO: '17/11/2026',
    NOME_INSTRUTOR: user && user.papel !== 'ALUNO' ? user.nome : '',
    CPF_CNPJ_INSTRUTOR: user?.papel !== 'ALUNO' ? (user?.cpfCompleto || user?.cpfMascarado || '') : '',
    CIDADE_UF_INSTRUTOR: instructorCityUf,
    NOME_ALUNO: student?.nome || studentUser?.nome || '',
    CPF_ALUNO: studentUser?.cpfCompleto || student?.cpfMascarado || '',
    REGISTRO_DETRAN: user?.registroDetran || '',
    CATEGORIA_CNH: student?.categoriaCnh || '',
    CIDADE_UF_ALUNO: studentCityUf,
    UF: user ? user.estado || 'MG' : 'MG',
    CIDADE_UF: instructorCityUf || studentCityUf || 'Minas Gerais/MG'
  };
}

export function legalContractValues(
  instructor: User | null,
  student: Student,
  studentUser: User | undefined,
  contract: StudentPackageContract
): Record<string, string> {
  return legalContractValuesMulti(instructor, student, studentUser, [contract]);
}

/**
 * Gera as variáveis do contrato contemplando 1 ou múltiplos planos contratados pelo aluno.
 */
export function legalContractValuesMulti(
  instructor: User | null,
  student: Student,
  studentUser: User | undefined,
  contracts: StudentPackageContract[],
  offers: PackageOffer[] = []
): Record<string, string> {
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const defaults = legalDefaults(instructor, student, studentUser);

  const list = contracts.length > 0
    ? contracts
    : [{
      id: `cnt_summary_${student.id}`,
      alunoId: student.id,
      organizacaoId: student.organizacaoId,
      tipo: 'PACOTE_BASE' as const,
      pacoteId: student.pacoteId,
      nome: student.pacoteNome || `Pacote CNH ${student.categoriaCnh || 'B'}`,
      categoriaCnh: student.categoriaCnh,
      quantidadeAulas: student.totalAulasContratadas || 0,
      valorCentavos: 0,
      dataContratacao: student.dataCadastro
    }];

  const enriched = list.map((c) => {
    const offer = offers.find((o) => o.id === c.pacoteId);
    const total = c.valorCentavos ?? offer?.valorCentavos ?? 0;
    const rental = c.valorLocacaoExameCentavos ?? offer?.condicoesContratuais?.valorLocacaoExameCentavos ?? 0;
    const lessons = c.valorAulasCentavos ?? Math.max(0, total - rental);
    return {
      ...c,
      nome: c.nome || offer?.nome || 'Pacote de Aulas Práticas',
      categoriaCnh: c.categoriaCnh || offer?.categoriaCnh || student.categoriaCnh,
      quantidadeAulas: c.quantidadeAulas || offer?.totalAulas || 0,
      valorCentavos: total,
      valorLocacaoExameCentavos: rental,
      valorAulasCentavos: lessons,
      locacaoExameContratada: c.locacaoExameContratada ?? offer?.condicoesContratuais?.locacaoExameContratada ?? rental > 0,
      formaPagamento: c.formaPagamento || offer?.formaPagamento || 'A combinar',
      duracaoAulaMinutos: c.duracaoAulaMinutos ?? offer?.condicoesContratuais?.duracaoAulaMinutos ?? 50,
      diasAvisoExame: c.diasAvisoExame ?? offer?.condicoesContratuais?.diasAvisoExame ?? 7,
      prazoValidadeDias: c.prazoValidadeDias ?? offer?.condicoesContratuais?.prazoValidadeDias ?? 90,
      percentualMulta: c.percentualMulta ?? offer?.condicoesContratuais?.percentualMulta ?? 10
    };
  });

  const totalLessons = enriched.reduce((sum, item) => sum + (item.quantidadeAulas || 0), 0);
  const totalCents = enriched.reduce((sum, item) => sum + (item.valorCentavos || 0), 0);
  const rentalCents = enriched.reduce((sum, item) => sum + (item.valorLocacaoExameCentavos || 0), 0);
  const lessonsCents = enriched.reduce((sum, item) => sum + (item.valorAulasCentavos || 0), 0);

  const modalidadeText = enriched.length === 1
    ? enriched[0].nome
    : enriched
      .map((item, idx) => `${idx + 1}) ${item.nome} (${item.quantidadeAulas} aula(s) · R$ ${money(item.valorCentavos)})`)
      .join(' + ');

  const categories = Array.from(new Set(enriched.map((item) => item.categoriaCnh).filter(Boolean))).join(', ') || student.categoriaCnh;
  const paymentMethods = Array.from(new Set(enriched.map((item) => item.formaPagamento).filter(Boolean))).join(' / ') || 'A combinar';
  const hasExamRental = enriched.some((item) => item.locacaoExameContratada || item.valorLocacaoExameCentavos > 0);

  const maxDuration = Math.max(...enriched.map((item) => item.duracaoAulaMinutos || 50));
  const maxExamNotice = Math.max(...enriched.map((item) => item.diasAvisoExame ?? 7));
  const maxValidity = Math.max(...enriched.map((item) => item.prazoValidadeDias || 90));
  const maxFine = Math.max(...enriched.map((item) => item.percentualMulta ?? 10));

  return {
    ...defaults,
    MODALIDADE_CONTRATO: modalidadeText,
    QTD_AULAS: String(totalLessons),
    VALOR_TOTAL: money(totalCents),
    SUBTOTAL_AULAS: money(lessonsCents),
    VALOR_ALUGUEL_EXAME: money(rentalCents),
    VALOR_UNITARIO: totalLessons > 0 ? money(lessonsCents / totalLessons) : '0,00',
    VALOR_EXTENSO: numberToWordsBRL(totalCents),
    STATUS_EXAME: hasExamRental ? 'Incluso no total do contrato' : 'Não contratado',
    FORMA_PAGAMENTO_ACORDADA: paymentMethods,
    CATEGORIA_CNH: categories,
    DURACAO_MINUTOS: String(maxDuration),
    DIAS_AVISO_EXAME: String(maxExamNotice),
    PRAZO_VALIDADE_DIAS: String(maxValidity),
    PERCENTUAL_MULTA: String(maxFine),
    DATA_ACEITE_EXTENSO: new Date().toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo'
    }),
    HASH_INSTRUTOR: 'Conforme comprovante de aceite vinculado',
    HASH_ALUNO: 'Conforme comprovante de aceite vinculado',
    IP_ALUNO: 'Conforme registro do comprovante eletrônico'
  };
}
