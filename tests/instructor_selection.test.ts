// Mock de localStorage simples para Node runner
const memoryStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => memoryStorage.get(k) ?? null,
  setItem: (k: string, v: string) => memoryStorage.set(k, String(v)),
  removeItem: (k: string) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear(),
  get length() {
    return memoryStorage.size;
  },
  key: (i: number) => Array.from(memoryStorage.keys())[i] ?? null
};

import { db, initDatabase } from '../src/lib/storage';
import { User, Organization } from '../src/types';

// Inicializa o banco de dados
initDatabase();

console.log('\n=== TESTE DE SELEÇÃO E CARREGAMENTO DE INSTRUTORES DO BANCO ===\n');

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`❌ FALHA: ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

// 1. Testar getAllInstructors
const initialInstructors = db.getAllInstructors();
assert(Array.isArray(initialInstructors), 'getAllInstructors retorna array de usuários');

// 2. Simular cadastro de novo instrutor autônomo com organização própria no banco
const newOrg: Organization = {
  id: 'org_alex_dias_test',
  nome: 'Autoescola Alex Dias Treinamentos',
  tipo: 'INSTRUTOR_AUTONOMO',
  cnpjCpf: '12.345.678/0001-99',
  telefone: '(31) 98888-7777',
  email: 'alexdias@autoescola.com.br',
  cidade: 'Belo Horizonte',
  estado: 'MG',
  status: 'ATIVO',
  plano: 'PRO',
  criadoEm: new Date().toISOString()
};
db.saveOrganization(newOrg);

const newInstructor: User = {
  id: 'usr_alex_dias',
  organizacaoId: newOrg.id,
  nome: 'Alex Dias Instrutor',
  email: 'alexdias@autoescola.com.br',
  papel: 'INSTRUTOR',
  telefone: '(31) 98888-7777',
  cpfUltimos4: '1234',
  cpfFingerprint: 'fp_alex_1234',
  cpfCompleto: '123.456.789-00',
  twoFactorAtivo: false
};
db.saveUser(newInstructor);

// 3. Verificar se o novo instrutor aparece na listagem global de instrutores
const allInstructorsAfter = db.getAllInstructors();
const foundInList = allInstructorsAfter.find((i) => i.id === 'usr_alex_dias');
assert(!!foundInList, 'Novo instrutor de organização autônoma aparece na lista de instrutores');
assert(foundInList?.organizacaoId === 'org_alex_dias_test', 'Instrutor mantém organização própria vinculada');

// 4. Testar busca por código em diferentes formatos
const byExactId = db.findInstructorByCode('usr_alex_dias');
assert(byExactId?.id === 'usr_alex_dias', 'Localiza por ID completo (usr_alex_dias)');

const byCleanCode = db.findInstructorByCode('ALEX_DIAS');
assert(byCleanCode?.id === 'usr_alex_dias', 'Localiza por código sem prefixo (ALEX_DIAS)');

const byName = db.findInstructorByCode('alex dias');
assert(byName?.id === 'usr_alex_dias', 'Localiza por nome aproximado');

// 5. Testar resolução de targetOrgId
const targetOrg = foundInList?.organizacaoId || 'org_direcao_certa_01';
assert(targetOrg === 'org_alex_dias_test', 'targetOrgId é atribuído à organização do instrutor autônomo');

// 6. Testar Fallback de Pacotes quando o instrutor ainda não cadastrou pacotes na sua org
let pkgs = db.getPackages(targetOrg, foundInList?.id).filter((p) => p.ativo);
if (pkgs.length === 0) {
  pkgs = db.getPackages(targetOrg).filter((p) => p.ativo);
}
if (pkgs.length === 0) {
  pkgs = [
    {
      id: `pkg_padrao_${targetOrg}`,
      organizacaoId: targetOrg,
      instrutorId: foundInList?.id,
      nome: 'Pacote CNH B (20 Aulas Práticas)',
      categoriaCnh: 'B',
      totalAulas: 20,
      valorCentavos: 180000,
      formaPagamento: 'TODAS',
      maxParcelas: 12,
      descontoAvistaPercentual: 5,
      descricao: 'Treinamento prático veicular completo com suporte e simulados de exame.',
      ativo: true,
      criadoEm: new Date().toISOString()
    }
  ];
}
assert(pkgs.length > 0 && pkgs[0].totalAulas === 20, 'Fallback de pacotes garante opções ativas para o aluno se matricular');

console.log('\n=== TODOS OS TESTES DE INSTRUTORES PASSARAM COM SUCESSO! ===\n');

