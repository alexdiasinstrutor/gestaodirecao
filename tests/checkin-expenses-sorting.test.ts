import assert from 'node:assert/strict';
import fs from 'node:fs';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { Organization, Student, User, Lesson } from '../src/types/index.ts';

// Hook nativo do Node.js para resolver extensões .ts/.tsx/.json e mocks offline de SDKs em ambiente Node
const mockModules: Record<string, string> = {
  '@supabase/supabase-js': 'export function createClient() { return null; }',
  './firebase': [
    'export const db = {};',
    'export const auth = { currentUser: null };',
    'export const firebaseConfig = { projectId: "test", firestoreDatabaseId: "test" };',
    'export const OperationType = { CREATE: "create", UPDATE: "update", DELETE: "delete", LIST: "list", GET: "get", WRITE: "write" };',
    'export function testConnection() { return Promise.resolve({ connected: false, message: "mock" }); }',
    'export function handleFirestoreError(err) { throw err; }'
  ].join('\n'),
  'firebase/app': 'export function initializeApp() { return {}; }',
  'firebase/auth': 'export function getAuth() { return { currentUser: null }; }',
  'firebase/firestore': [
    'export function getFirestore() { return {}; }',
    'export function doc() { return {}; }',
    'export function getDocFromServer() { return Promise.resolve({}); }',
    'export function collection() { return {}; }',
    'export function writeBatch() { return { set() {}, commit() { return Promise.resolve(); } }; }',
    'export function getDocs() { return Promise.resolve({ docs: [] }); }',
    'export function setDoc() { return Promise.resolve(); }',
    'export function getDoc() { return Promise.resolve({ exists: () => false }); }',
    'export function deleteDoc() { return Promise.resolve(); }',
    'export function query() { return {}; }',
    'export function where() { return {}; }'
  ].join('\n')
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (mockModules[specifier]) {
      return {
        shortCircuit: true,
        url: `data:text/javascript,${encodeURIComponent(mockModules[specifier])}`
      };
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parentDir = path.dirname(fileURLToPath(context.parentURL));
      const basePath = path.resolve(parentDir, specifier);
      if (fs.existsSync(basePath) && fs.statSync(basePath).isFile()) {
        return { shortCircuit: true, url: pathToFileURL(basePath).href };
      }
      for (const suffix of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
        const candidate = `${basePath}${suffix}`;
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return { shortCircuit: true, url: pathToFileURL(candidate).href };
        }
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.json')) {
      const content = fs.readFileSync(fileURLToPath(url), 'utf8');
      return {
        shortCircuit: true,
        format: 'module',
        source: `export default ${content};`
      };
    }
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      const content = fs.readFileSync(fileURLToPath(url), 'utf8');
      const stripped = stripTypeScriptTypes(content, { mode: 'strip' });
      const valueNames = new Set(
        Array.from(
          content.matchAll(/export\s+(?:async\s+)?(?:const|let|var|function|class|enum)\s+([A-Za-z0-9_]+)/g)
        ).map((m) => m[1])
      );
      const typeNames = Array.from(
        content.matchAll(/export\s+(?:type|interface)\s+([A-Za-z0-9_]+)/g)
      )
        .map((m) => m[1])
        .filter((name, idx, arr) => arr.indexOf(name) === idx && !valueNames.has(name));
      const stubs = typeNames.map((n) => `export const ${n} = undefined;`).join('\n');
      return {
        shortCircuit: true,
        format: 'module',
        source: stubs ? `${stripped}\n${stubs}` : stripped
      };
    }
    return nextLoad(url, context);
  }
});

// Mock browser storage globals before importing storage.ts
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

async function runTests() {
  console.log('=== Iniciando Testes Automatizados: Ordem Alfabética, 25 Manutenções e Check-in GPS ===');

  const {
    EXPENSE_MAINTENANCE_ITEMS,
    EXPENSE_OTHER_OPTION,
    findMaintenanceItemById
  } = await import('../src/lib/expenseMaintenanceCatalog.ts');
  const {
    evaluateHardwareForLiveMap,
    calculateHaversineDistanceKm,
    computeRouteTelemetry,
    formatDurationHMS,
    buildGoogleMapsDirectionsUrl,
    generateSimulatedGpsStep
  } = await import('../src/lib/lessonCheckinService.ts');
  const { db } = await import('../src/lib/storage.ts');
  const {
    canAccessModule,
    configureModuleAcrossPlans,
    getSaaSPlans
  } = await import('../src/lib/saasPlans.ts');

  // 1. Teste: Catálogo de Despesas/Manutenções com 25 tipos + OUTRO
  assert.equal(
    EXPENSE_MAINTENANCE_ITEMS.length,
    25,
    'O catálogo de manutenção/despesa deve conter exatamente 25 tipos principais'
  );
  assert.equal(EXPENSE_OTHER_OPTION, 'OUTRO');
  const uniqueIds = new Set(EXPENSE_MAINTENANCE_ITEMS.map((i) => i.id));
  assert.equal(uniqueIds.size, 25, 'Todos os 25 tipos de manutenção devem ter IDs únicos');
  assert.equal(findMaintenanceItemById('TROCA_OLEO')?.categoria, 'MANUTENCAO_VEICULO');
  assert.equal(findMaintenanceItemById('ABASTECIMENTO')?.categoria, 'COMBUSTIVEL');
  assert.equal(findMaintenanceItemById('TROCA_PNEU')?.label, 'Troca de Pneu');
  assert.equal(findMaintenanceItemById('COMPRA_PNEU')?.label, 'Compra de Pneu(s) Novo(s)');
  assert.ok(findMaintenanceItemById('TROCA_EMBREAGEM'), 'Deve conter Troca de Embreagem');
  console.log('[OK] Teste 1: Catálogo com 25 tipos de manutenção/despesa + opção OUTRO validado.');

  // Setup org, instrutor, master e alunos fora de ordem alfabética
  const orgId = 'org_test_checkin';
  const org: Organization = {
    id: orgId,
    nome: 'Autoescola Teste A-Z',
    tipo: 'INSTRUTOR_AUTONOMO',
    cnpjCpf: '11.222.333/0001-44',
    telefone: '(31) 99999-0000',
    email: 'org@teste.com',
    cidade: 'Betim',
    estado: 'MG',
    status: 'ATIVO',
    plano: 'MASTER',
    criadoEm: '2026-11-19T12:00:00Z'
  };
  db.saveOrganization(org);

  const masterUser: User = {
    id: 'usr_master',
    organizacaoId: orgId,
    nome: 'Cássio Master',
    email: 'cassiordcosta@gmail.com',
    papel: 'SUPER_ADMIN',
    telefone: '(31) 99999-0001',
    cpfUltimos4: '3300',
    cpfFingerprint: 'fp_m',
    twoFactorAtivo: false
  };
  const instructorUser: User = {
    id: 'usr_inst_1',
    organizacaoId: orgId,
    nome: 'Alexsandro Dias',
    email: 'alex@autoescola.com',
    papel: 'INSTRUTOR',
    telefone: '(31) 98796-9608',
    cpfUltimos4: '3643',
    cpfFingerprint: 'fp_i',
    twoFactorAtivo: false
  };
  const studentUser: User = {
    id: 'usr_alu_1',
    organizacaoId: orgId,
    nome: 'Bruno Pereira',
    email: 'bruno@aluno.com',
    papel: 'ALUNO',
    telefone: '(31) 98888-7777',
    cpfUltimos4: '1111',
    cpfFingerprint: 'fp_s1',
    twoFactorAtivo: false
  };
  db.saveUser(masterUser);
  db.saveUser(instructorUser);
  db.saveUser(studentUser);

  const makeStudent = (id: string, nome: string): Student => ({
    id,
    organizacaoId: orgId,
    instrutorId: instructorUser.id,
    nome,
    email: `${id}@aluno.com`,
    telefone: '(31) 98888-1111',
    cpfMascarado: '***.***.111-11',
    cpfFingerprint: `fp_${id}`,
    dataNascimento: '1995-05-10',
    idade: 30,
    categoriaCnh: 'B',
    status: 'EM_ANDAMENTO',
    aulasCumpridas: 0,
    totalAulasContratadas: 20,
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
    dataCadastro: '2026-11-19'
  });

  // Cadastra fora de ordem propositalmente: Zélia, Carlos, Amanda, Bruno
  db.saveStudent(makeStudent('stu_z', 'Zélia Mendes'), instructorUser.id);
  db.saveStudent(makeStudent('stu_c', 'Carlos Augusto'), instructorUser.id);
  db.saveStudent(makeStudent('stu_a', 'Amanda Souza'), instructorUser.id);
  db.saveStudent(makeStudent('stu_b', 'Bruno Pereira'), instructorUser.id);

  // 2. Teste: Ordenação alfabética A-Z em db.getStudents()
  const sortedStudents = db.getStudents(orgId, instructorUser.id);
  assert.deepEqual(
    sortedStudents.map((s) => s.nome),
    ['Amanda Souza', 'Bruno Pereira', 'Carlos Augusto', 'Zélia Mendes'],
    'Alunos devem ser retornados estritamente em ordem alfabética (A-Z)'
  );
  console.log('[OK] Teste 2: Listagem de alunos classificada em ordem alfabética (A-Z) confirmada.');

  // 3. Teste: Permissão SaaS — liberado apenas para Master até que seja adicionado ao plano
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', masterUser),
    true,
    'Administrador Master deve ter acesso imediato para testar/validar o módulo'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', instructorUser),
    false,
    'Instrutor NÃO deve ver o módulo antes do Master liberá-lo no plano de assinatura'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', studentUser),
    false,
    'Aluno NÃO deve ver o módulo antes do Master liberá-lo no plano de assinatura'
  );

  // Simula login Master e libera módulo no plano MASTER
  db.setCurrentUser(masterUser);
  await configureModuleAcrossPlans('LESSON_CHECKIN_GPS', ['MASTER']);
  assert.ok(getSaaSPlans().MASTER.modulosPermitidos.includes('LESSON_CHECKIN_GPS'));
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', instructorUser),
    true,
    'Após Master liberar no plano MASTER, instrutor passa a acessar o módulo'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', studentUser),
    true,
    'Após Master liberar no plano MASTER, aluno da organização passa a acessar o módulo'
  );
  console.log('[OK] Teste 3: Controle de plano SaaS e homologação Master verificados.');

  // 4. Teste: Verificação de Hardware Anti-Falha
  const strongHw = evaluateHardwareForLiveMap({
    navigatorOverride: { deviceMemory: 8, hardwareConcurrency: 8, connection: { effectiveType: '4g' } },
    hasCanvasOverride: true
  });
  assert.equal(strongHw.canRunLiveMap, true);

  const weakRamHw = evaluateHardwareForLiveMap({
    navigatorOverride: { deviceMemory: 1, hardwareConcurrency: 4 },
    hasCanvasOverride: true
  });
  assert.equal(weakRamHw.canRunLiveMap, false);
  assert.ok(weakRamHw.reason && weakRamHw.reason.includes('1 GB'));

  const slowNetHw = evaluateHardwareForLiveMap({
    navigatorOverride: { deviceMemory: 4, hardwareConcurrency: 4, connection: { saveData: true } },
    hasCanvasOverride: true
  });
  assert.equal(slowNetHw.canRunLiveMap, false);

  const simulatedWeakHw = evaluateHardwareForLiveMap({ forceLowSpec: true, hasCanvasOverride: true });
  assert.equal(simulatedWeakHw.canRunLiveMap, false);
  console.log('[OK] Teste 4: Diagnóstico de capacidade de hardware (normal vs limitado/anti-falha) validado.');

  // 5. Teste: Telemetria GPS (Haversine, Deslocamento vs Parada, URL Google Maps)
  const p0 = { lat: -19.9678, lng: -44.1984, timestamp: '2026-11-19T10:00:00.000Z', speedKmh: 0 };
  const p1 = generateSimulatedGpsStep([p0], { stopped: false, stepSeconds: 20 });
  const p2 = generateSimulatedGpsStep([p0, p1], { stopped: false, stepSeconds: 20 });
  const p3 = generateSimulatedGpsStep([p0, p1, p2], { stopped: true, stepSeconds: 15 });
  const route = [p0, p1, p2, p3];
  const dist01 = calculateHaversineDistanceKm(p0, p1);
  assert.ok(dist01 > 0.02, 'Passo em deslocamento deve registrar distância > 20m');

  const telemetry = computeRouteTelemetry(route, 55);
  assert.equal(telemetry.totalSeconds, 55);
  assert.equal(telemetry.movingSeconds, 40);
  assert.equal(telemetry.stoppedSeconds, 15);
  assert.ok(telemetry.distanceKm > 0.05);
  assert.equal(formatDurationHMS(3665), '01:01:05');

  const gmapsUrl = buildGoogleMapsDirectionsUrl(route);
  assert.ok(gmapsUrl.startsWith('https://www.google.com/maps/dir/?api=1'));
  console.log('[OK] Teste 5: Telemetria GPS (tempo total, deslocamento, parada, km e Google Maps URL) validada.');

  // 6. Teste: Fluxo Check-in -> Registro em progresso (modo hardware fraco) -> Check-out computa aula agendada
  const lessonCheckin: Lesson = {
    id: 'lsn_chk_1',
    organizacaoId: orgId,
    alunoId: 'stu_b',
    instrutorId: instructorUser.id,
    veiculoId: 'veh_1',
    data: '2099-11-19', // futura para garantir que só checkout manual computou aqui
    horaInicio: '14:00',
    horaFim: '14:50',
    topico: 'Circuito Urbano & Baliza',
    status: 'AGENDADA',
    criadoEm: new Date().toISOString()
  };
  const createRes = db.createLesson(lessonCheckin, instructorUser.id);
  assert.equal(createRes.success, true);

  const started = db.startLessonCheckin({
    lesson: lessonCheckin,
    student: makeStudent('stu_b', 'Bruno Pereira'),
    instructor: instructorUser,
    actor: studentUser,
    modoHardware: 'LOW_SPEC_DEFERRED_MAP',
    motivoHardwareLimitado: weakRamHw.reason,
    initialPoint: p0
  });
  assert.equal(started.status, 'EM_ANDAMENTO');
  assert.equal(started.modoHardware, 'LOW_SPEC_DEFERRED_MAP');

  db.updateLessonCheckinProgress(started.id, {
    coordenadas: route,
    tempoTotalSegundos: telemetry.totalSeconds,
    tempoDeslocamentoSegundos: telemetry.movingSeconds,
    tempoParadaSegundos: telemetry.stoppedSeconds,
    distanciaKm: telemetry.distanceKm
  });

  const finishedRes = db.finishLessonCheckin({
    checkinId: started.id,
    actor: instructorUser,
    tempoTotalSegundos: telemetry.totalSeconds,
    tempoDeslocamentoSegundos: telemetry.movingSeconds,
    tempoParadaSegundos: telemetry.stoppedSeconds,
    distanciaKm: telemetry.distanceKm,
    coordenadas: route,
    notaAula: 9.5
  });
  assert.equal(finishedRes.lessonCompleted, true);
  assert.equal(finishedRes.checkin?.status, 'FINALIZADO');
  assert.equal(finishedRes.checkin?.coordenadas.length, 4, 'Coordenadas devem ser preservadas para mapa pós-aula');

  const updatedStudentB = db.getStudentById('stu_b');
  assert.equal(updatedStudentB?.aulasCumpridas, 1, 'Check-out deve computar +1 aula cumprida no aluno');
  const updatedLesson = db.getLessons(orgId).find((l) => l.id === 'lsn_chk_1');
  assert.equal(updatedLesson?.status, 'CONCLUIDA');
  console.log('[OK] Teste 6: Fluxo Check-in -> Coordenadas em hardware limitado -> Check-out -> Baixa da aula validado.');

  // 7. Teste: Fallback anti-esquecimento (aula passada sem check-in e check-in aberto esquecido são computados)
  const pastScheduledNoCheckin: Lesson = {
    id: 'lsn_past_no_chk',
    organizacaoId: orgId,
    alunoId: 'stu_a',
    instrutorId: instructorUser.id,
    veiculoId: 'veh_1',
    data: '2026-01-10',
    horaInicio: '08:00',
    horaFim: '08:50',
    topico: 'Direção Defensiva',
    status: 'AGENDADA',
    criadoEm: '2026-01-09T10:00:00Z'
  };
  const pastOpenCheckinLesson: Lesson = {
    id: 'lsn_past_open_chk',
    organizacaoId: orgId,
    alunoId: 'stu_c',
    instrutorId: instructorUser.id,
    veiculoId: 'veh_1',
    data: '2026-01-11',
    horaInicio: '09:00',
    horaFim: '09:50',
    topico: 'Treino em Via Arterial',
    status: 'AGENDADA',
    criadoEm: '2026-01-10T10:00:00Z'
  };
  assert.equal(db.createLesson(pastScheduledNoCheckin, instructorUser.id).success, true);
  assert.equal(db.createLesson(pastOpenCheckinLesson, instructorUser.id).success, true);

  // Inicia check-in na segunda aula mas esquece de finalizar check-out
  const forgottenOpenCheckin = db.startLessonCheckin({
    lesson: pastOpenCheckinLesson,
    student: makeStudent('stu_c', 'Carlos Augusto'),
    instructor: instructorUser,
    actor: studentUser,
    modoHardware: 'LIVE_MAP',
    initialPoint: p0
  });
  assert.equal(forgottenOpenCheckin.status, 'EM_ANDAMENTO');

  const autoCount = db.autoCompleteElapsedLessons({ orgId, actorId: instructorUser.id });
  assert.equal(autoCount, 2, 'Sistema deve continuar computando tanto aulas sem check-in quanto check-ins esquecidos');
  assert.equal(db.getStudentById('stu_a')?.aulasCumpridas, 1);
  assert.equal(db.getStudentById('stu_c')?.aulasCumpridas, 1);
  const autoClosedCheckin = db.getLessonCheckins(orgId, { aulaId: 'lsn_past_open_chk' })[0];
  assert.equal(autoClosedCheckin?.status, 'FINALIZADO');
  console.log('[OK] Teste 7: Fallback anti-esquecimento (baixa automática com e sem check-in aberto) validado.');

  console.log('=== Todos os 7 testes automatizados de Ordenação, 25 Despesas e Check-in GPS passaram com sucesso! ===');
}

runTests().catch((err) => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
