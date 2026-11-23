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
    buildGoogleMapsEmbedUrl,
    generateSimulatedGpsStep,
    filterEligibleCheckinLessons,
    shouldAcceptGpsPoint
  } = await import('../src/lib/lessonCheckinService.ts');
  const { mobileGpsKeepAlive } = await import('../src/lib/mobileGpsKeepAlive.ts');
  const { queueCloudWrite, getPendingWrites, acknowledgeCloudWrite } = await import('../src/lib/cloudOutbox.ts');
  const { supabaseAdapter } = await import('../src/lib/supabaseAdapter.ts');
  const { db, initDatabase, seedCleanProductionData } = await import('../src/lib/storage.ts');
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

  // 3. Teste: Permissão SaaS — liberado após homologação para todos os perfis e configurável pelo Master
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', masterUser),
    true,
    'Administrador Master deve ter acesso completo ao módulo'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', instructorUser),
    true,
    'Instrutor deve acessar o módulo Check-in & Rota GPS após liberação nos planos'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', studentUser),
    true,
    'Aluno deve visualizar o módulo Check-in & Rota GPS após liberação nos planos'
  );

  // Simula login Master, testa restrição de planos e re-liberação configurável
  db.setCurrentUser(masterUser);
  await configureModuleAcrossPlans('LESSON_CHECKIN_GPS', []);
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', masterUser),
    true,
    'Administrador Master mantém acesso mesmo quando o módulo está restrito nos planos'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', instructorUser),
    false,
    'Instrutor perde acesso quando o Master remove o módulo dos planos'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', studentUser),
    false,
    'Aluno perde acesso quando o Master remove o módulo dos planos'
  );

  await configureModuleAcrossPlans('LESSON_CHECKIN_GPS', ['DEMO', 'BASICO', 'AVANCADO', 'MASTER']);
  assert.ok(getSaaSPlans().MASTER.modulosPermitidos.includes('LESSON_CHECKIN_GPS'));
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', instructorUser),
    true,
    'Após Master liberar nos planos, instrutor volta a acessar o módulo'
  );
  assert.equal(
    canAccessModule(org, 'LESSON_CHECKIN_GPS', studentUser),
    true,
    'Após Master liberar nos planos, aluno volta a visualizar o módulo'
  );
  console.log('[OK] Teste 3: Liberação para instrutores/alunos e controle configurável nos planos SaaS verificados.');

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

  const gmapsEmbedUrl = buildGoogleMapsEmbedUrl(route);
  assert.ok(gmapsEmbedUrl.includes('maps.google.com/maps?q='), 'Embed deve usar formato q=lat,lng');
  assert.ok(gmapsEmbedUrl.includes('output=embed'), 'Embed deve incluir output=embed');
  assert.equal(gmapsEmbedUrl.includes('saddr='), false, 'Embed não deve usar saddr/daddr bloqueado em iframe');

  // Telemetria após desbloqueio de tela (intervalo longo de 300s com speedKmh=0 no despertar e deslocamento ~1.2km)
  const wakeGapRoute = [
    { lat: -19.9678, lng: -44.1984, timestamp: '2026-11-19T10:00:00.000Z', speedKmh: 20, accuracy: 8 },
    { lat: -19.957, lng: -44.1984, timestamp: '2026-11-19T10:05:00.000Z', speedKmh: 0, accuracy: 10 }
  ];
  const wakeTelemetry = computeRouteTelemetry(wakeGapRoute, 300);
  assert.ok(wakeTelemetry.distanceKm > 1.0, 'Deslocamento após desbloqueio da tela deve ser contabilizado');
  assert.equal(wakeTelemetry.movingSeconds, 300, 'Tempo em movimento após lacuna de bloqueio deve ser preservado');

  // Filtro GPS (shouldAcceptGpsPoint): rejeita ruído > 120m e spam duplicado, aceita deslocamento >=5m ou >=10s
  assert.equal(
    shouldAcceptGpsPoint([p0], { lat: -19.9679, lng: -44.1985, timestamp: '2026-11-19T10:00:05.000Z', accuracy: 250 }),
    false,
    'Leitura GPS com precisão > 120m após ponto inicial deve ser descartada'
  );
  assert.equal(
    shouldAcceptGpsPoint([p0], { lat: p0.lat, lng: p0.lng, timestamp: '2026-11-19T10:00:03.000Z', accuracy: 10 }),
    false,
    'Spam estacionário < 5m e < 10s deve ser ignorado'
  );
  assert.equal(
    shouldAcceptGpsPoint([p0], { lat: p0.lat, lng: p0.lng, timestamp: '2026-11-19T10:00:12.000Z', accuracy: 10 }),
    true,
    'Heartbeat >= 10s deve ser aceito para computar tempo de parada com precisão'
  );
  assert.equal(
    shouldAcceptGpsPoint([p0], p1),
    true,
    'Movimento real >= 5m deve ser aceito imediatamente'
  );
  console.log('[OK] Teste 5: Telemetria GPS (despertar pós-bloqueio, filtro anti-ruído e Google Maps embed/rotas) validada.');

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

  // 8. Teste: Filtro estrito de aulas elegíveis para Check-in (somente aulas futuras / em andamento)
  const testNowMs = new Date(2026, 10, 20, 14, 0, 0).getTime(); // 20/11/2026 14:00 local
  const filterTestLessons: Lesson[] = [
    {
      id: 'lsn_filter_past',
      organizacaoId: orgId,
      alunoId: 'stu_a',
      instrutorId: instructorUser.id,
      veiculoId: 'veh_1',
      data: '2026-11-20',
      horaInicio: '10:00',
      horaFim: '10:50',
      topico: 'Aula Passada Não Deve Aparecer',
      status: 'AGENDADA',
      criadoEm: '2026-11-19T10:00:00Z'
    },
    {
      id: 'lsn_filter_done_status',
      organizacaoId: orgId,
      alunoId: 'stu_a',
      instrutorId: instructorUser.id,
      veiculoId: 'veh_1',
      data: '2026-11-25',
      horaInicio: '10:00',
      horaFim: '10:50',
      topico: 'Aula Já Concluída',
      status: 'CONCLUIDA',
      criadoEm: '2026-11-19T10:00:00Z'
    },
    {
      id: 'lsn_filter_already_checked_out',
      organizacaoId: orgId,
      alunoId: 'stu_b',
      instrutorId: instructorUser.id,
      veiculoId: 'veh_1',
      data: '2026-11-25',
      horaInicio: '11:00',
      horaFim: '11:50',
      topico: 'Aula com Check-in Já Finalizado',
      status: 'AGENDADA',
      criadoEm: '2026-11-19T10:00:00Z'
    },
    {
      id: 'lsn_filter_future',
      organizacaoId: orgId,
      alunoId: 'stu_b',
      instrutorId: instructorUser.id,
      veiculoId: 'veh_1',
      data: '2026-11-20',
      horaInicio: '15:00',
      horaFim: '15:50',
      topico: 'Aula Futura Elegível',
      status: 'AGENDADA',
      criadoEm: '2026-11-19T10:00:00Z'
    },
    {
      id: 'lsn_filter_active',
      organizacaoId: orgId,
      alunoId: 'stu_c',
      instrutorId: instructorUser.id,
      veiculoId: 'veh_1',
      data: '2026-11-20',
      horaInicio: '13:00',
      horaFim: '13:50',
      topico: 'Aula em Andamento Ativa',
      status: 'EM_ANDAMENTO',
      criadoEm: '2026-11-19T10:00:00Z'
    }
  ];
  const fakeFinishedCheckin = {
    ...finishedRes.checkin!,
    id: 'chk_done_filter',
    aulaId: 'lsn_filter_already_checked_out',
    status: 'FINALIZADO' as const
  };
  const eligible = filterEligibleCheckinLessons(filterTestLessons, [fakeFinishedCheckin], testNowMs);
  assert.deepEqual(
    eligible.map((l) => l.id),
    ['lsn_filter_future', 'lsn_filter_active'],
    'Apenas aulas futuras agendadas ou em andamento devem aparecer para iniciar check-in'
  );
  console.log('[OK] Teste 8: Filtro futuro-only de aulas elegíveis para Check-in validado.');

  // 9. Teste: Preservação não-destrutiva de setup/dados e resiliência da outbox / keep-alive
  const customOrg: Organization = {
    id: 'org_direcao_certa_01',
    nome: 'Minha Autoescola Setup Personalizado',
    tipo: 'INSTRUTOR_AUTONOMO',
    cnpjCpf: '32.194.852/0001-44',
    telefone: '(31) 98888-7777',
    email: 'cassiordcosta@gmail.com',
    cidade: 'Contagem',
    estado: 'MG',
    status: 'ATIVO',
    plano: 'AVANCADO',
    chavePix: 'chave-pix-personalizada-nao-resetar',
    modulosCustomizados: ['DASHBOARD', 'STUDENTS', 'SCHEDULE', 'LESSON_CHECKIN_GPS'],
    criadoEm: '2026-01-10T08:00:00Z'
  };
  db.saveOrganization(customOrg);
  localStorage.removeItem('agd_seeded_v5');
  initDatabase();
  const orgAfterInit = db.getOrganization('org_direcao_certa_01');
  assert.equal(
    orgAfterInit?.chavePix,
    'chave-pix-personalizada-nao-resetar',
    'initDatabase/seedCleanProductionData não pode resetar setups já salvos da organização'
  );
  assert.equal(orgAfterInit?.nome, 'Minha Autoescola Setup Personalizado');
  assert.equal(orgAfterInit?.plano, 'AVANCADO');
  assert.ok(
    db.getLessonCheckins(orgId).length >= 2,
    'Registros de percursos GPS existentes não podem ser apagados ao reinicializar o banco'
  );

  // Outbox resiliente + mobileGpsKeepAlive seguro em ambiente sem navegador
  const qEntry = queueCloudWrite('lessons', { id: 'lsn_q1' }, 'upsert');
  assert.equal(getPendingWrites().some((e) => e.revision === qEntry.revision), true);
  acknowledgeCloudWrite(qEntry);
  assert.equal(getPendingWrites().some((e) => e.revision === qEntry.revision), false);
  const flushEmpty = await supabaseAdapter.flushPendingWrites();
  assert.equal(flushEmpty.failed, 0);

  const kaStarted = await mobileGpsKeepAlive.start('Aluno Teste');
  assert.equal(kaStarted.active, true);
  await mobileGpsKeepAlive.stop();
  assert.equal(mobileGpsKeepAlive.getStatus().active, false);

  // Evita aviso caso explicit reset limpe
  seedCleanProductionData({ forceReset: true });
  assert.equal(db.getOrganization('org_direcao_certa_01')?.nome, 'Gestão AD (Auto Direção)');
  console.log('[OK] Teste 9: Preservação de setup (zero reset), resiliência da outbox e keep-alive validados.');

  // 10. Teste: Mapa livre de Carto API Key + Integridade Master (SUPER_ADMIN não é órfão) + exclusão de aula órfã
  const fsMod = await import('node:fs');
  const pathMod = await import('node:path');
  const mapSource = fsMod.readFileSync(
    pathMod.resolve(process.cwd(), 'src/components/common/LessonRouteMap.tsx'),
    'utf-8'
  );
  assert.equal(
    mapSource.includes('cartocdn.com'),
    false,
    'LessonRouteMap não pode usar basemaps.cartocdn.com (exige API key)'
  );
  assert.equal(
    mapSource.includes('tile.openstreetmap.org'),
    true,
    'LessonRouteMap deve usar OpenStreetMap como provedor primário gratuito'
  );
  assert.equal(
    mapSource.includes('arcgisonline.com'),
    true,
    'LessonRouteMap deve manter ArcGIS World Street Map como fallback gratuito'
  );

  // Recria cenário limpo com SUPER_ADMIN + aluno/aula de validação Master GPS
  const masterIntegrityUser = db.getUsers().find((u) => u.papel === 'SUPER_ADMIN');
  assert.ok(masterIntegrityUser, 'Deve existir usuário SUPER_ADMIN após seedCleanProductionData');
  const masterStudent: Student = {
    ...makeStudent('stu_master_gps', 'Aluno Validação Master GPS'),
    organizacaoId: masterIntegrityUser!.organizacaoId,
    instrutorId: masterIntegrityUser!.id
  };
  db.saveStudent(masterStudent, masterIntegrityUser!.id);
  const masterLesson: Lesson = {
    id: 'lsn_master_gps_ok',
    organizacaoId: masterIntegrityUser!.organizacaoId,
    alunoId: masterStudent.id,
    instrutorId: masterIntegrityUser!.id,
    veiculoId: 'veh_master_1',
    data: '2026-11-28',
    horaInicio: '10:00',
    horaFim: '10:50',
    topico: 'Validação Master GPS',
    status: 'AGENDADA',
    criadoEm: '2026-11-23T12:00:00Z'
  };
  db.createLesson(masterLesson, masterIntegrityUser!.id);

  const reportMasterOk = db.verifyCadastrosIntegrity(masterIntegrityUser!.organizacaoId);
  assert.equal(reportMasterOk.orphanStudents.length, 0, 'Aluno vinculado a SUPER_ADMIN não deve ser marcado como órfão');
  assert.equal(reportMasterOk.orphanLessons.length, 0, 'Aula vinculada a SUPER_ADMIN não deve ser marcada como órfã');
  assert.equal(reportMasterOk.score, 100, 'Score de integridade deve permanecer 100% com validação Master');

  // Agora injeta uma aula verdadeiramente órfã e confirma detecção + remoção via db.deleteOrphanLesson
  const orphanLesson: Lesson = {
    ...masterLesson,
    id: 'lsn_orphan_real',
    alunoId: 'stu_inexistente_999',
    horaInicio: '14:00',
    horaFim: '14:50'
  };
  db.createLesson(orphanLesson, masterIntegrityUser!.id);
  const reportWithOrphan = db.verifyCadastrosIntegrity(masterIntegrityUser!.organizacaoId);
  assert.equal(reportWithOrphan.orphanLessons.length, 1, 'Aula órfã real deve ser detectada pelo verificador');
  assert.equal(reportWithOrphan.isAllConsistent, false);

  const removed = db.deleteOrphanLesson('lsn_orphan_real', masterIntegrityUser!.id);
  assert.equal(removed, true, 'db.deleteOrphanLesson deve remover a aula órfã');
  const reportAfterFix = db.verifyCadastrosIntegrity(masterIntegrityUser!.organizacaoId);
  assert.equal(reportAfterFix.orphanLessons.length, 0);
  assert.equal(reportAfterFix.score, 100);
  console.log('[OK] Teste 10: Mapa sem Carto API Key, integridade SUPER_ADMIN 100% e remoção de aula órfã validados.');

  // 11. Teste: Motor de Precisão GPS (rejeição > 45m, anti-teletransporte > 135 km/h, limpeza de spikes e amostragem Snap-to-Road)
  const { sanitizeGpsTrack } = await import('../src/lib/lessonCheckinService');
  const { sampleWaypointsForRouting } = await import('../src/lib/routeSnapToRoad');

  // Rejeita leitura imprecisa > 45m
  assert.equal(
    shouldAcceptGpsPoint([p0], { lat: -19.9675, lng: -44.1981, timestamp: '2026-11-19T10:00:05.000Z', accuracy: 80 }),
    false,
    'Leitura GPS com precisão > 45m deve ser descartada para não cortar sobre casas'
  );
  // Rejeita teletransporte (> 135 km/h em 3s)
  assert.equal(
    shouldAcceptGpsPoint([p0], { lat: -19.9500, lng: -44.1800, timestamp: '2026-11-19T10:00:03.000Z', accuracy: 10 }),
    false,
    'Salto GPS impossível (> 135 km/h) deve ser rejeitado'
  );

  // sanitizeGpsTrack remove spike isolado no meio do trajeto
  const trackWithSpike = [
    { lat: -19.9748, lng: -44.1996, timestamp: '2026-11-23T19:00:00.000Z', speedKmh: 20, accuracy: 10 },
    { lat: -19.9700, lng: -44.1900, timestamp: '2026-11-23T19:00:04.000Z', speedKmh: 20, accuracy: 12 }, // spike de ~1.1km em 4s!
    { lat: -19.9746, lng: -44.1994, timestamp: '2026-11-23T19:00:08.000Z', speedKmh: 20, accuracy: 10 }
  ];
  const sanitized = sanitizeGpsTrack(trackWithSpike);
  assert.equal(sanitized.length, 2, 'Spike GPS isolado deve ser removido pelo sanitizeGpsTrack');

  const sampled = sampleWaypointsForRouting([p0, p1, { ...p1, lat: -19.9640, lng: -44.1950 }], 10, 50);
  assert.equal(sampled[0].lat, p0.lat);
  assert.equal(sampled[sampled.length - 1].lat, -19.9640);
  console.log('[OK] Teste 11: Motor de precisão GPS (filtro 45m, anti-teletransporte, remoção de spikes e Snap-to-Road) validado.');

  console.log('=== Todos os 11 testes automatizados passaram com sucesso! ===');
}

runTests().catch((err) => {
  console.error('FALHA NO TESTE:', err);
  process.exit(1);
});
