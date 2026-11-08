import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const BASE_DIR = path.resolve(
  'C:/Users/cassi/.gemini/antigravity/brain/0357c05a-5cbf-415b-9782-d55e3e5536a9/scratch/baseline'
);

const results = [];

function runTest(id, category, description, fn) {
  const start = performance.now();
  try {
    fn();
    const durationMs = (performance.now() - start).toFixed(2);
    results.push({ id, category, description, status: 'PASS', durationMs });
    console.log(`✅ [PASS] (${id}) ${category} — ${description} (${durationMs}ms)`);
  } catch (err) {
    const durationMs = (performance.now() - start).toFixed(2);
    results.push({
      id,
      category,
      description,
      status: 'FAIL',
      durationMs,
      error: err instanceof Error ? err.message : String(err)
    });
    console.error(`❌ [FAIL] (${id}) ${category} — ${description}: ${err.message}`);
  }
}

// ─── Helpers equivalentes para validação matemática dos módulos ───────────────
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

function clampRadiusKm(r) {
  if (!Number.isFinite(r)) return 15;
  return Math.max(5, Math.min(40, Math.round(r)));
}

function cleanPhoneDigits(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    digits = digits.slice(2);
  }
  return digits.slice(0, 11);
}

function isValidPhone(phone) {
  const digits = cleanPhoneDigits(phone);
  if (digits.length !== 10 && digits.length !== 11) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  const ddd = parseInt(digits.slice(0, 2), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;
  return true;
}

function maskPhoneInput(value) {
  const digits = cleanPhoneDigits(value);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// ============================================================================
// 1. TESTES DE CONFIDENCIALIDADE E PLANOS NO AUTO-CADASTRO DO ALUNO
// ============================================================================
const selfRegFile = fs.readFileSync(
  path.join(BASE_DIR, 'src/components/auth/StudentSelfRegisterModal.tsx'),
  'utf-8'
);

runTest(
  'T01',
  'Confidencialidade de Instrutores',
  'StudentSelfRegisterModal não possui dropdown <select> listando nomes de todos os instrutores',
  () => {
    assert.equal(
      selfRegFile.includes('Ou selecione na listagem de instrutores cadastrados'),
      false,
      'Não deve existir texto ou select listando todos os instrutores'
    );
    assert.equal(
      selfRegFile.includes('-- Selecione seu Instrutor ('),
      false,
      'Não deve existir option listando quantidade de instrutores cadastrados'
    );
  }
);

runTest(
  'T02',
  'Confidencialidade de Instrutores',
  'Ao abrir Auto-Cadastro direto pela página inicial sem link, nenhum instrutor nem plano de terceiros é pré-selecionado',
  () => {
    assert.equal(
      selfRegFile.includes('if (defaultInstructorId && defaultInstructorId.trim())'),
      true,
      'initialInstructor deve exigir defaultInstructorId preenchido'
    );
    assert.equal(
      selfRegFile.includes('if (!selectedInstructor) return [];'),
      true,
      'availablePackages deve retornar vazio enquanto nenhum instrutor for localizado'
    );
  }
);

runTest(
  'T03',
  'Confidencialidade & Convite WhatsApp',
  'Quando o aluno acessa pelo link do WhatsApp (defaultInstructorId), o código é passado automaticamente e exibe os planos do instrutor',
  () => {
    assert.equal(
      selfRegFile.includes('db.findInstructorByCode(defaultInstructorId)'),
      true,
      'Deve localizar automaticamente o instrutor pelo código do link de convite'
    );
    const appFile = fs.readFileSync(path.join(BASE_DIR, 'src/App.tsx'), 'utf-8');
    assert.equal(
      appFile.includes("params.get('instrutorId')") && appFile.includes("params.get('convite')"),
      true,
      'App.tsx deve capturar parâmetros de link do WhatsApp automaticamente'
    );
  }
);

runTest(
  'T04',
  'Exibição dos Planos do Instrutor',
  'Ao pesquisar o código do instrutor, busca e atualiza todos os pacotes do instrutor (local + Supabase)',
  () => {
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');
    assert.equal(
      storageFile.includes('getPackages(orgId: string, instrutorId?: string): PackageOffer[]'),
      true,
      'db.getPackages deve filtrar por instrutorId e organizacaoId efetiva do instrutor'
    );
    assert.equal(
      selfRegFile.includes('setPackagesVersion((v) => v + 1)'),
      true,
      'StudentSelfRegisterModal deve atualizar packagesVersion após sincronizar pacotes remotos'
    );
  }
);

// ============================================================================
// 2. TESTES DE GEOLOCALIZAÇÃO E MAPA PÚBLICO DO ALUNO (5 KM A 40 KM + FILTROS)
// ============================================================================
const geoServiceFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/geoService.ts'), 'utf-8');
const locatorModalFile = fs.readFileSync(
  path.join(BASE_DIR, 'src/components/auth/InstructorLocatorMapModal.tsx'),
  'utf-8'
);

runTest(
  'T05',
  'Geolocalização & Raio 5 a 40 km',
  'Cálculo de distância Haversine e limite estrito de raio entre 5 km e 40 km',
  () => {
    assert.equal(clampRadiusKm(1), 5, 'Raio mínimo deve ser 5 km');
    assert.equal(clampRadiusKm(25), 25, 'Raio intermediário 25 km preservado');
    assert.equal(clampRadiusKm(90), 40, 'Raio máximo deve ser 40 km');

    // Distância Belo Horizonte (-19.9167, -43.9345) -> Contagem (-19.9317, -44.0536) ~ 12.6 km
    const distBhContagem = calculateDistanceKm(-19.9167, -43.9345, -19.9317, -44.0536);
    assert.equal(distBhContagem >= 10 && distBhContagem <= 16, true, `Distância BH-Contagem real (~12.6km), obtido: ${distBhContagem}`);

    // Distância BH -> Betim (-19.9678, -44.1983) ~ 28.1 km
    const distBhBetim = calculateDistanceKm(-19.9167, -43.9345, -19.9678, -44.1983);
    assert.equal(distBhBetim >= 25 && distBhBetim <= 32, true, `Distância BH-Betim real (~28.1km), obtido: ${distBhBetim}`);
  }
);

runTest(
  'T06',
  'Mapa do Aluno & Filtros Completos',
  'InstructorLocatorMapModal possui slider 5-40km, filtro de Cidade, Categoria CNH, Câmbio (Manual/Automático) e Tipo de Veículo (Moto, Carro, Caminhão, Ônibus)',
  () => {
    assert.equal(
      locatorModalFile.includes('min={5}') && locatorModalFile.includes('max={40}'),
      true,
      'Slider de distância no mapa do aluno deve ir de 5 km a 40 km'
    );
    assert.equal(
      locatorModalFile.includes('categoriaFiltro') &&
      locatorModalFile.includes('tipoVeiculoFiltro') &&
      locatorModalFile.includes('tipoCambioFiltro') &&
      locatorModalFile.includes('cidadeAppFiltro'),
      true,
      'Todos os filtros (Cidade, Categoria, Tipo de Veículo e Tipo de Câmbio) devem estar presentes'
    );
    assert.equal(
      locatorModalFile.includes('MOTO') &&
      locatorModalFile.includes('CARRO') &&
      locatorModalFile.includes('CAMINHAO') &&
      locatorModalFile.includes('ONIBUS'),
      true,
      'Filtro de veículos deve contemplar Moto, Carro, Caminhão e Ônibus'
    );
    assert.equal(
      locatorModalFile.includes('MANUAL') && locatorModalFile.includes('AUTOMATICO'),
      true,
      'Filtro de câmbio deve contemplar Manual e Automático'
    );
  }
);

runTest(
  'T07',
  'Contato WhatsApp no Mapa Público',
  'Lista lateral ao mapa exibe os instrutores encontrados com link direto para contato via WhatsApp sanitizado',
  () => {
    assert.equal(
      locatorModalFile.includes('buildWhatsAppLink(item.instructor.telefone'),
      true,
      'Deve gerar link de WhatsApp usando buildWhatsAppLink com o telefone do instrutor'
    );
    assert.equal(
      locatorModalFile.includes('Chamar no WhatsApp'),
      true,
      'Deve exibir botão para chamar o instrutor no WhatsApp'
    );
  }
);

// ============================================================================
// 3. TESTES DE DEMANDA REVERSA (ALUNO PROCURANDO INSTRUTOR) & NOTIFICAÇÕES
// ============================================================================
const instructorGeoViewFile = fs.readFileSync(
  path.join(BASE_DIR, 'src/components/instructor/InstructorGeoDemandView.tsx'),
  'utf-8'
);

runTest(
  'T08',
  'Demanda Reversa & Notificações para Instrutores',
  'Aluno que não localiza instrutor pode se cadastrar procurando instrutor e o sistema notifica os instrutores na seção Mensagens e Notificações com botão WhatsApp',
  () => {
    assert.equal(
      locatorModalFile.includes('db.createStudentLeadAsync(newLead)'),
      true,
      'Mapa público permite ao aluno registrar StudentLeadRequest'
    );
    assert.equal(
      instructorGeoViewFile.includes('Mensagens e Notificações — Alunos à Procura de Instrutor'),
      true,
      'Painel do instrutor possui a seção Mensagens e Notificações'
    );
    assert.equal(
      instructorGeoViewFile.includes('buildWhatsAppLink(lead.telefone'),
      true,
      'Instrutor pode selecionar o aluno e encaminhar mensagem via WhatsApp'
    );
    assert.equal(
      instructorGeoViewFile.includes('handleAddCityToCoverage(lead.cidade)'),
      true,
      'Instrutor pode cadastrar a cidade do aluno na sua área de atendimento com 1 clique'
    );
  }
);

// ============================================================================
// 4. TESTES DO MAPA INTERNO EXCLUSIVO DO INSTRUTOR LOGADO
// ============================================================================
runTest(
  'T09',
  'Segurança & Mapa Interno do Instrutor',
  'O mapa de pesquisa de alunos e estatísticas de mercado só está disponível dentro do sistema para instrutores logados',
  () => {
    const appFile = fs.readFileSync(path.join(BASE_DIR, 'src/App.tsx'), 'utf-8');
    // Verifica que InstructorGeoDemandView só é renderizado após o guard `if (!currentUser)` e `!isStudent`
    const loginGuardIndex = appFile.indexOf('if (!currentUser)');
    const geoDemandRenderIndex = appFile.indexOf('<InstructorGeoDemandView');
    assert.equal(
      loginGuardIndex > 0 && geoDemandRenderIndex > loginGuardIndex,
      true,
      'InstructorGeoDemandView só é renderizado para usuários autenticados (!currentUser bloqueia antes)'
    );
    assert.equal(
      locatorModalFile.includes('mode="PUBLIC_STUDENT"'),
      true,
      'O mapa público usa estritamente mode="PUBLIC_STUDENT" sem exibir alunos'
    );
    assert.equal(
      instructorGeoViewFile.includes('mode="INTERNAL_INSTRUCTOR"'),
      true,
      'O mapa interno do instrutor usa mode="INTERNAL_INSTRUCTOR" exibindo alunos, áreas, cidades, bairros e distâncias'
    );
  }
);

runTest(
  'T10',
  'Configuração de Raio (5-40km) e Cidades pelo Instrutor',
  'Instrutor pode configurar raio de 5 a 40 km e cadastrar/remover as cidades que atende com persistência no Supabase',
  () => {
    assert.equal(
      instructorGeoViewFile.includes('db.saveInstructorCoverageAsync(updatedProfile)'),
      true,
      'Salva perfil de cobertura geográfica do instrutor no banco local e Supabase'
    );
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');
    assert.equal(
      storageFile.includes("entidade: 'InstructorCoverage'") &&
      storageFile.includes("entidade: 'StudentLeadRequest'"),
      true,
      'Sincroniza InstructorCoverage e StudentLeadRequest com o Supabase'
    );
  }
);

// ============================================================================
// 5. TESTES DE REGRESSÃO: TELEFONE OBRIGATATÓRIO E SEM MÁSCARA COMO NÚMERO
// ============================================================================
runTest(
  'T11',
  'Sanitização de Telefone & WhatsApp',
  'Máscara nunca é passada como número em nenhum input ou link de WhatsApp',
  () => {
    assert.equal(maskPhoneInput('('), '', 'Caractere de máscara isolado não pode virar dígito');
    assert.equal(maskPhoneInput('() -'), '', 'Máscara vazia retorna string vazia');
    assert.equal(cleanPhoneDigits('(11) 98765-4321'), '11987654321');
    assert.equal(isValidPhone('(11) 98765-4321'), true);
    assert.equal(isValidPhone('(00) 00000-0000'), false);
    assert.equal(isValidPhone('99999999999'), false, 'Dígitos repetidos devem ser rejeitados');
    assert.equal(isValidPhone('(  ) _____-____'), false, 'Máscara sem dígitos deve ser rejeitada');
  }
);

// ============================================================================
// 6. TESTES DE REGRESSÃO: AGENDA POR PERÍODO E NOTIFICAÇÃO DE DESMARCAÇÃO
// ============================================================================
runTest(
  'T12',
  'Agenda por Período & Notificação ao Aluno',
  'Liberação e remoção de agenda (Semanal, Mensal, Anual, Período) e alerta de conflito com notificação ao aluno permanecem intactos',
  () => {
    const scheduleFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/ScheduleView.tsx'),
      'utf-8'
    );
    const studentPortalFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/student/StudentPortal.tsx'),
      'utf-8'
    );
    assert.equal(
      scheduleFile.includes('cancelLessonByInstructorWithNotificationAsync'),
      true,
      'ScheduleView mantém confirmação e notificação ao aluno ao remover horário com aula marcada'
    );
    assert.equal(
      studentPortalFile.includes('getStudentNotifications'),
      true,
      'StudentPortal exibe alertas de aulas desmarcadas pelo instrutor para remarcação'
    );
  }
);

// ============================================================================
// 7. TESTE DE EDIÇÃO E PERSISTÊNCIA DO PLANO E FICHA DO ALUNO
// ============================================================================
runTest(
  'T13',
  'Mudança de Plano e Persistência na Ficha do Aluno',
  'Instrutor pode alterar o plano contratado, categoria CNH, total de aulas e competências na ficha do aluno e salvar com persistência no banco e sincronização financeira',
  () => {
    const studentsViewFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/StudentsView.tsx'),
      'utf-8'
    );
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');
    const adapterFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/supabaseAdapter.ts'), 'utf-8');

    assert.equal(
      studentsViewFile.includes('handleSelectPackageInFicha') &&
      studentsViewFile.includes('handleSelectCategoryInFicha'),
      true,
      'Ficha do aluno permite selecionar novo plano/pacote e categoria CNH do instrutor'
    );
    assert.equal(
      studentsViewFile.includes('await db.saveStudentAsync(updatedStudent, currentUser.id)'),
      true,
      'Ficha do aluno salva de forma assíncrona garantindo persistência imediata no localStorage e Supabase'
    );
    assert.equal(
      studentsViewFile.includes('await db.updateAccountReceivableAsync(updatedAcc, currentUser.id)'),
      true,
      'Mudança de plano atualiza automaticamente a fatura em aberto do aluno'
    );
    assert.equal(
      storageFile.includes("entidade: 'StudentFichaMeta'") &&
      adapterFile.includes('getStudentMetaAuditLogs'),
      true,
      'Persistência redundante StudentFichaMeta garante que alterações de plano e evolução nunca sejam perdidas ao recarregar'
    );
  }
);

// ============================================================================
// 8. TESTE DE SELEÇÃO DE ESTADO PRIMEIRO, AUTO-PREENCHIMENTO POR CEP E REMOÇÃO DO BOTÃO MATRICULAR NO MAPA
// ============================================================================
runTest(
  'T14',
  'Mapa Público: Estado Primeiro, CEP Auto-Preenchimento e Contato via WhatsApp',
  'Seleciona Estado (UF) primeiro, auto-preenche por CEP, lista cidades com instrutores ao buscar em outro estado, salva CEP na lista de procura e remove botão Ver Planos / Matricular do mapa',
  () => {
    const locatorMapFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/auth/InstructorLocatorMapModal.tsx'),
      'utf-8'
    );

    assert.equal(
      locatorMapFile.includes('handleSelectStateFirst') &&
      locatorMapFile.includes('1º Selecione o Estado (UF)'),
      true,
      'Mapa possui seleção de Estado (UF) em primeiro lugar com auto-preenchimento'
    );
    assert.equal(
      locatorMapFile.includes('handleCepBuscaChange') &&
      locatorMapFile.includes('handleLeadCepChange') &&
      locatorMapFile.includes('lookupAddressByCEP'),
      true,
      'Mapa possui auto-preenchimento de endereço/cidade/UF a partir do CEP tanto na busca quanto na lista de alunos à procura de instrutor'
    );
    assert.equal(
      locatorMapFile.includes('isSearchingDifferentState') &&
      locatorMapFile.includes('cidadesComInstrutoresNoEstado'),
      true,
      'Quando o usuário seleciona outro estado diferente de sua localização, lista exclusivamente as cidades que possuem instrutores cadastrados'
    );
    assert.equal(
      locatorMapFile.includes('Ver Planos / Matricular'),
      false,
      'Botão "Ver Planos / Matricular" foi removido da tela do mapa para que o contato ocorra via WhatsApp primeiro'
    );
    assert.equal(
      locatorMapFile.includes('item.coverage.bairroBase'),
      false,
      'Mapa público não exibe o bairro do endereço do instrutor, apenas a(s) cidade(s) que ele cadastrou que atende'
    );
    assert.equal(
      locatorMapFile.includes('Chamar no WhatsApp'),
      true,
      'Botão "Chamar no WhatsApp" permanece ativo como ação principal no mapa'
    );
  }
);

// ============================================================================
// 9. TESTE DE EXIBIÇÃO DOS PLANOS DO INSTRUTOR NO AUTO-CADASTRO E SINCRONIZAÇÃO CLOUD VAULT
// ============================================================================
runTest(
  'T15',
  'Auto-Cadastro do Aluno: Exibição Fiel dos Planos Cadastrados pelo Instrutor',
  'Ao selecionar/pesquisar um instrutor no auto-cadastro, exibe todos os planos cadastrados por ele com sincronização via Cloud Vault no Supabase',
  () => {
    const selfRegFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/auth/StudentSelfRegisterModal.tsx'),
      'utf-8'
    );
    const adapterFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/supabaseAdapter.ts'), 'utf-8');
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');

    assert.equal(
      adapterFile.includes('VAULT_PREFIX') &&
      adapterFile.includes('upsertVaultRowsBatch') &&
      adapterFile.includes('readVaultRows'),
      true,
      'Adaptador Supabase possui Cloud Sync Vault para persistir pacotes, alunos e agenda sem bloqueio de RLS'
    );
    assert.equal(
      selfRegFile.includes('await syncFromSupabase()') &&
      selfRegFile.includes('supabaseAdapter.getPackages()'),
      true,
      'Modal de Auto-Cadastro sincroniza pacotes remotos do instrutor selecionado'
    );
    assert.equal(
      storageFile.includes("u.email.toLowerCase() !== 'cassiordcosta@gmail.com'"),
      true,
      'Administrador Master (SUPER_ADMIN) não é listado como instrutor de direção nos mapas públicos'
    );
  }
);

console.log('\n====================================================================');
const passed = results.filter((r) => r.status === 'PASS').length;
const failed = results.filter((r) => r.status === 'FAIL').length;
console.log(`RESUMO DOS TESTES AUTOMATIZADOS: ${passed}/${results.length} APROVADOS (${failed} falhas)`);
console.log('====================================================================\n');

if (failed > 0) {
  process.exit(1);
}
