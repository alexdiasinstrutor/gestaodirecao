import { numberToWordsBRL } from '../lib/receiptPdfGenerator';
import schema from './documentos_juridicos_plataforma/variaveis_schema.json';
import type { Student, User, StudentPackageContract } from '../types';
const sources = import.meta.glob('./documentos_juridicos_plataforma/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const legalDocuments = schema.documentos;
export function renderLegalDocument(code: string, values: Record<string, string>) {
  const definition = legalDocuments.find(document => document.codigo === code);
  if (!definition) throw new Error('Documento jurídico desconhecido.');
  const source = sources['./documentos_juridicos_plataforma/' + definition.arquivo];
  if (!source) throw new Error('Modelo jurídico indisponível.');
  const missing = definition.variaveis.filter(key => !values[key]?.trim());
  return { definition, missing, content: source.replace(/\{\{([A-Z_]+)\}\}/g, (_, key: string) => values[key]?.trim() || '[PREENCHER ' + key + ']') };
}
export async function legalHash(content: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function legalDefaults(user: User | null, student?: Student, studentUser?: User): Record<string, string> {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return { RAZAO_SOCIAL_EMPRESA: env.VITE_LEGAL_RAZAO_SOCIAL || 'Stark Light Save', CNPJ_EMPRESA: env.VITE_LEGAL_CNPJ || '23.659.019/0001-40', ENDERECO_EMPRESA: env.VITE_LEGAL_ENDERECO || 'Rua São Cristóvão, 36, Brasileia, Betim/MG, CEP 32600-280', CIDADE_SEDE_EMPRESA: env.VITE_LEGAL_CIDADE || 'Betim', EMAIL_DPO_PRIVACIDADE: env.VITE_LEGAL_EMAIL_DPO || 'cassiodiniz@uol.com.br', NOME_PLATAFORMA: 'Gestão AD (Auto Direção)', DATA_ATUALIZACAO: '16/11/2026',
    NOME_INSTRUTOR: user && user.papel !== 'ALUNO' ? user.nome : '', CPF_CNPJ_INSTRUTOR: user?.papel !== 'ALUNO' ? user?.cpfCompleto || '' : '',
    CIDADE_UF_INSTRUTOR: user?.papel !== 'ALUNO' ? [user?.cidade, user?.estado].filter(Boolean).join('/') : '',
    NOME_ALUNO: student?.nome || '', CPF_ALUNO:studentUser?.cpfCompleto || '', RG_ALUNO:studentUser?.rg || '', REGISTRO_DETRAN:user?.registroDetran || '', CATEGORIA_CNH: student?.categoriaCnh || '',
    CIDADE_UF_ALUNO: [student?.cidade, student?.estado].filter(Boolean).join('/'),
    UF: user ? user.estado || '' : 'MG', CIDADE_UF: [user?.cidade,user?.estado].filter(Boolean).join('/') };
}

export function legalContractValues(instructor: User | null, student: Student, studentUser: User | undefined, contract: StudentPackageContract): Record<string,string> {
  const money = (cents: number) => (cents/100).toFixed(2).replace('.',',');
  const rental = contract.valorLocacaoExameCentavos ?? 0;
  const lessons = contract.valorAulasCentavos ?? (contract.valorCentavos-rental);
  return {...legalDefaults(instructor,student,studentUser), MODALIDADE_CONTRATO:contract.nome, QTD_AULAS:String(contract.quantidadeAulas),
    VALOR_TOTAL:money(contract.valorCentavos), SUBTOTAL_AULAS:money(lessons), VALOR_ALUGUEL_EXAME:money(rental),
    VALOR_UNITARIO:contract.quantidadeAulas>0?money(lessons/contract.quantidadeAulas):'', VALOR_EXTENSO:numberToWordsBRL(contract.valorCentavos),
    STATUS_EXAME:contract.locacaoExameContratada?'Incluso no total do pacote':'Não contratado', FORMA_PAGAMENTO_ACORDADA:contract.formaPagamento || '',
    CATEGORIA_CNH:contract.categoriaCnh || student.categoriaCnh, DURACAO_MINUTOS:contract.duracaoAulaMinutos?String(contract.duracaoAulaMinutos):'',
    DIAS_AVISO_EXAME:contract.diasAvisoExame!==undefined?String(contract.diasAvisoExame):'', PRAZO_VALIDADE_DIAS:contract.prazoValidadeDias?String(contract.prazoValidadeDias):'',
    PERCENTUAL_MULTA:contract.percentualMulta!==undefined?String(contract.percentualMulta):'', DATA_ACEITE_EXTENSO:new Date().toLocaleDateString('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'America/Sao_Paulo'}),
    HASH_INSTRUTOR:'Conforme comprovante de aceite vinculado', HASH_ALUNO:'Conforme comprovante de aceite vinculado', IP_ALUNO:'Conforme registro do comprovante eletrônico'};
}
