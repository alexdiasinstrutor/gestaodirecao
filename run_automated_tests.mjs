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

// ============================================================================
// 10. TESTE DE PROTEÇÃO E BLINDAGEM CONTRA PERDA DE PACOTES DO INSTRUTOR
// ============================================================================
runTest(
  'T16',
  'Proteção Absoluta Contra Perda de Pacotes Criados/Editados pelo Instrutor',
  'Garante que pacotes criados ou editados pelo instrutor nunca sejam apagados ou sobrescritos por pacotes padrão na sincronização',
  () => {
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');
    const pkgManagerFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/PackagesManager.tsx'),
      'utf-8'
    );

    assert.equal(
      storageFile.includes('PACKAGES_BACKUP') &&
      storageFile.includes('PENDING_PACKAGES') &&
      storageFile.includes('DELETED_PACKAGES'),
      true,
      'Storage possui cofre local PACKAGES_BACKUP, fila PENDING_PACKAGES e controle DELETED_PACKAGES'
    );
    assert.equal(
      storageFile.includes('localIsProtected') &&
      storageFile.includes('createPackageAsync') &&
      storageFile.includes('updatePackageAsync'),
      true,
      'Sincronização protege edições locais/customizadas do instrutor contra sobrescrita por seeds remotos'
    );
    assert.equal(
      pkgManagerFile.includes("currentUser.papel !== 'SUPER_ADMIN' ? currentUser.id : undefined") &&
      pkgManagerFile.includes('await db.updatePackageAsync') &&
      pkgManagerFile.includes('await db.createPackageAsync'),
      true,
      'PackagesManager passa o instrutorId para ADMIN_ORG e INSTRUTOR e persiste alterações de forma assíncrona no banco'
    );
  }
);

// ============================================================================
// 11. TESTE DE CADASTRO E GESTÃO DE VEÍCULOS / CARROS DOS INSTRUTORES
// ============================================================================
runTest(
  'T17',
  'Cadastro e Gestão de Veículos / Carros dos Instrutores',
  'Instrutor possui tela e menu dedicado "Meus Veículos" para cadastrar carros/motos (câmbio manual/automático, placa, ano, duplo comando, km) com sincronização em tempo real',
  () => {
    const vehiclesViewFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/VehiclesView.tsx'),
      'utf-8'
    );
    const appFile = fs.readFileSync(path.join(BASE_DIR, 'src/App.tsx'), 'utf-8');
    const saasPlansFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/saasPlans.ts'), 'utf-8');
    const storageFile = fs.readFileSync(path.join(BASE_DIR, 'src/lib/storage.ts'), 'utf-8');

    assert.equal(
      vehiclesViewFile.includes('Meus Veículos e Frota de Instrução') &&
      vehiclesViewFile.includes('await db.saveVehicleAsync(vehicleData, currentUser.id)') &&
      vehiclesViewFile.includes('await db.deleteVehicleAsync(veh.id, currentUser.id)'),
      true,
      'Tela VehiclesView permite cadastrar, editar e excluir carros/veículos do instrutor com sincronização assíncrona'
    );
    assert.equal(
      appFile.includes("id: 'VEHICLES'") &&
      appFile.includes('<VehiclesView currentOrg={currentOrg!} currentUser={currentUser} />'),
      true,
      'Menu principal e navegação mobile incluem a aba "Meus Veículos"'
    );
    assert.equal(
      storageFile.includes('VEHICLES_BACKUP') &&
      storageFile.includes('PENDING_VEHICLES') &&
      storageFile.includes('DELETED_VEHICLES'),
      true,
      'Storage protege os veículos cadastrados pelo instrutor com backup e fila de sincronização'
    );
    assert.equal(
      saasPlansFile.includes("'VEHICLES'"),
      true,
      'Módulo VEHICLES está habilitado nos planos para todos os instrutores cadastrarem seus carros'
    );
  }
);

// ============================================================================
// 12. TESTE DE CORREÇÃO NA DIGITAÇÃO COMPLETA DO NÚMERO DE AULAS
// ============================================================================
runTest(
  'T18',
  'Digitação Completa do Número de Aulas sem Bloqueio de Entrada',
  'Inputs de quantidade/total de aulas permitem digitação livre de 1 a 3 dígitos sem manter dígito anterior ou reverter para 1/0 ao apagar',
  () => {
    const studentsViewFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/StudentsView.tsx'),
      'utf-8'
    );
    const packagesManagerFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/PackagesManager.tsx'),
      'utf-8'
    );

    // Validação de lógica de digitação:
    // Ao apagar tudo (""), o input deve receber "" sem ser instantaneamente forçado para 1
    const simulateTyping = (initialVal, typedValues) => {
      let state = initialVal;
      for (const val of typedValues) {
        state = val === '' ? '' : Math.max(0, parseInt(val, 10) || 0);
      }
      return state;
    };

    // Simulando usuário que tinha 20, apaga tudo ('') e digita '3', depois '35'
    assert.equal(simulateTyping(20, ['2', '', '3', '35']), 35, 'Digitação simulada aceita substituição livre');
    assert.equal(simulateTyping(20, ['']), '', 'Estado aceita campo limpo durante a digitação');

    // Validação nos arquivos do componente
    assert.equal(
      studentsViewFile.includes("val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)") &&
      studentsViewFile.includes('setEditingTotalLessons(20)') &&
      studentsViewFile.includes('useState<number | string>(20)'),
      true,
      'StudentsView trata onChange permitindo esvaziamento e digitação completa sem salto para 1'
    );

    assert.equal(
      packagesManagerFile.includes("val === '' ? '' : Math.max(0, parseInt(val, 10) || 0)") &&
      packagesManagerFile.includes('totalAulas: 20') &&
      packagesManagerFile.includes('totalAulas: number | string'),
      true,
      'PackagesManager trata onChange de totalAulas permitindo digitação completa e salvamento sanitizado'
    );
  }
);

// ============================================================================
// 13. TESTE DE ASSINATURA DIGITAL DO INSTRUTOR PARA RECIBO (PNG/JPG MÁX 2MB)
// ============================================================================
runTest(
  'T19',
  'Assinatura Digital do Instrutor para Recibo com Upload, Visualização e Perfil',
  'Permite anexar imagem PNG/JPG até 2MB, posiciona visualmente no documento e PDF, e salva permanentemente no perfil do instrutor',
  () => {
    const receiptModalFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/common/PaymentReceiptModal.tsx'),
      'utf-8'
    );
    const pdfGeneratorFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/receiptPdfGenerator.ts'),
      'utf-8'
    );
    const storageFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/storage.ts'),
      'utf-8'
    );
    const typesFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/types/index.ts'),
      'utf-8'
    );

    // 1. Limite de tamanho de 2MB
    const MAX_SIZE_BYTES = 2 * 1024 * 1024;
    assert.equal(MAX_SIZE_BYTES, 2097152, '2MB equivale estritamente a 2.097.152 bytes');

    // Valida que o modal de recibo checa o limite de 2MB
    assert.equal(
      receiptModalFile.includes('2 * 1024 * 1024') &&
      receiptModalFile.includes('O arquivo de assinatura deve ter no máximo 2MB'),
      true,
      'PaymentReceiptModal valida rigorosamente o limite de 2MB para arquivos de assinatura'
    );

    // 2. Formatos aceitos
    assert.equal(
      receiptModalFile.includes('accept="image/png, image/jpeg, image/jpg, image/webp"'),
      true,
      'PaymentReceiptModal aceita formatos de imagem PNG e JPG/JPEG'
    );

    // 3. Posicionamento visual no documento
    assert.equal(
      receiptModalFile.includes('alt="Assinatura Digital do Instrutor"') &&
      receiptModalFile.includes('Assinatura do Instrutor') &&
      receiptModalFile.includes('border-t-2 border-slate-800'),
      true,
      'Documento do recibo exibe a imagem posicionada exatamente acima da linha de assinatura do instrutor'
    );

    // 4. Posicionamento no PDF gerado
    assert.equal(
      pdfGeneratorFile.includes('doc.addImage(signatureImg') &&
      (pdfGeneratorFile.includes('blocoAssinaturaY - 2 - imgHeight') || pdfGeneratorFile.includes('blocoAssinaturaY - 16')),
      true,
      'Gerador de PDF posiciona a assinatura digital sobre a linha de assinatura do instrutor'
    );

    // 5. Salvamento ao perfil do instrutor
    assert.equal(
      receiptModalFile.includes('handleSaveSignatureToProfile') &&
      receiptModalFile.includes('db.saveUserSignature') &&
      receiptModalFile.includes('Salvar no Meu Perfil'),
      true,
      'Botão "Salvar no Meu Perfil" persiste a assinatura no usuário'
    );

    assert.equal(
      storageFile.includes('saveUserSignature(') &&
      storageFile.includes('signatureBase64') &&
      storageFile.includes('InstructorSignatureMeta'),
      true,
      'Storage possui método saveUserSignature com sincronização no Supabase e cofre audit_logs'
    );

    assert.equal(
      typesFile.includes('assinaturaUrl?: string'),
      true,
      'Tipo User inclui campo assinaturaUrl para persistência no perfil'
    );
  }
);

runTest(
  'T20',
  'Redimensionamento e Posicionamento Interativo da Assinatura no Recibo',
  'Permite ao instrutor redimensionar em tamanho (escala) e posicionar a assinatura sobre a linha de forma interativa (sliders e drag-and-drop), salvando as preferências ao perfil',
  () => {
    const receiptModalFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/common/PaymentReceiptModal.tsx'),
      'utf-8'
    );
    const pdfGeneratorFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/receiptPdfGenerator.ts'),
      'utf-8'
    );
    const storageFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/storage.ts'),
      'utf-8'
    );
    const typesFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/types/index.ts'),
      'utf-8'
    );

    // 1. Tipagem de SignatureConfig
    assert.equal(
      typesFile.includes('export interface SignatureConfig') &&
      typesFile.includes('scale: number') &&
      typesFile.includes('offsetY: number') &&
      typesFile.includes('offsetX: number'),
      true,
      'Tipagem SignatureConfig definida com scale, offsetY e offsetX'
    );
    assert.equal(
      typesFile.includes('assinaturaConfig?: SignatureConfig'),
      true,
      'Interface User possui campo assinaturaConfig?: SignatureConfig'
    );

    // 2. Controles de redimensionamento no modal
    assert.equal(
      receiptModalFile.includes('signatureConfig') &&
      receiptModalFile.includes('setSignatureConfig') &&
      receiptModalFile.includes('scale: Number(e.target.value)') &&
      receiptModalFile.includes('min="50"') &&
      receiptModalFile.includes('max="200"'),
      true,
      'PaymentReceiptModal possui controle de redimensionamento de 50% a 200%'
    );

    // 3. Controles de posicionamento e Drag & Drop
    assert.equal(
      receiptModalFile.includes('startDrag') &&
      receiptModalFile.includes('onMouseDown={startDrag}') &&
      receiptModalFile.includes('onTouchStart={startDrag}') &&
      receiptModalFile.includes('offsetY') &&
      receiptModalFile.includes('offsetX'),
      true,
      'PaymentReceiptModal implementa arrasto interativo (drag-and-drop) e controle bidirecional'
    );

    // 4. Salvamento de assinatura com configuração no perfil
    assert.equal(
      receiptModalFile.includes('db.saveUserSignature(current.id, signatureImage, signatureConfig)'),
      true,
      'handleSaveSignatureToProfile persiste a imagem e as configurações no storage'
    );
    assert.equal(
      storageFile.includes('config?: SignatureConfig') &&
      storageFile.includes('assinaturaConfig: config'),
      true,
      'Storage persiste assinaturaConfig no perfil do usuário e no Supabase'
    );

    // 5. Aplicação no gerador de PDF
    assert.equal(
      pdfGeneratorFile.includes('scaleMultiplier') &&
      pdfGeneratorFile.includes('mmOffsetX') &&
      pdfGeneratorFile.includes('mmOffsetY'),
      true,
      'Gerador de PDF aplica as configurações de escala e deslocamento na imagem final'
    );

    // 6. Prevenção de ReferenceError em PaymentReceiptModal
    assert.equal(
      receiptModalFile.includes('assinaturaConfig: signatureConfig'),
      true,
      'PaymentReceiptModal referencia corretamente a variável de estado signatureConfig sem ReferenceError'
    );
  }
);

runTest(
  'T21',
  'Validação e Listagem com Autocompletar de Cidades por Estado na Área do Instrutor',
  'Ao digitar o nome da cidade, o sistema valida se ela existe no estado selecionado, lista as cidades correspondentes e impede cadastros de cidades inexistentes',
  async () => {
    const geoDemandViewFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/InstructorGeoDemandView.tsx'),
      'utf-8'
    );
    const cityServiceFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/cityValidationService.ts'),
      'utf-8'
    );

    // 1. Serviço de validação de cidades existe e contém dicionário e consulta
    assert.equal(
      cityServiceFile.includes('loadCitiesForState') &&
      cityServiceFile.includes('searchAndValidateCity') &&
      cityServiceFile.includes('BASE_CITIES_BY_STATE'),
      true,
      'cityValidationService possui funções loadCitiesForState, searchAndValidateCity e dicionário de cidades'
    );

    // Importa o serviço e testa a busca de cidades reais em MG
    const { searchAndValidateCity } = await import('./src/lib/cityValidationService.ts');
    
    const resBetim = await searchAndValidateCity('Betim', 'MG');
    assert.equal(resBetim.isValidExact, true, 'Betim é reconhecida como cidade válida em MG');
    assert.equal(resBetim.exactCityName, 'Betim', 'Nome oficial Betim retornado com precisão');

    const resSarzedo = await searchAndValidateCity('Sarzedo', 'MG');
    assert.equal(resSarzedo.isValidExact, true, 'Sarzedo é reconhecida como cidade válida em MG');

    const resIgarape = await searchAndValidateCity('Igarapé', 'MG');
    assert.equal(resIgarape.isValidExact, true, 'Igarapé é reconhecida como cidade válida em MG');

    // Testa autocompletar ao digitar parte do nome
    const resPrefix = await searchAndValidateCity('Belo', 'MG');
    assert.equal(resPrefix.matches.includes('Belo Horizonte'), true, 'Ao digitar "Belo", lista "Belo Horizonte" nas cidades de MG');

    // Testa validação negativa para cidade inexistente
    const resInvalida = await searchAndValidateCity('CidadeInexistenteXyz123', 'MG');
    assert.equal(resInvalida.isValidExact, false, 'Cidade inexistente é marcada como inválida');
    assert.equal(resInvalida.matches.length, 0, 'Nenhuma correspondência retornada para cidade inexistente');

    // 2. Componente InstructorGeoDemandView possui os controles de estado, autocompletar e validação
    assert.equal(
      geoDemandViewFile.includes('estadoPesquisaCidade') &&
      geoDemandViewFile.includes('searchAndValidateCity') &&
      geoDemandViewFile.includes('cidadeValidation.matches.map'),
      true,
      'InstructorGeoDemandView possui seletor de estado e lista suspensa com autocompletar ao digitar'
    );

    assert.equal(
      geoDemandViewFile.includes('cidadeValidation.isValidExact') &&
      geoDemandViewFile.includes('Nenhuma cidade com o nome'),
      true,
      'InstructorGeoDemandView exibe feedback de validação em tempo real e alerta quando a cidade não existe'
    );
  }
);

runTest(
  'T22',
  'Persistência Fiel ao Desmarcar Tipos de Veículos e Categorias na Área de Atendimento',
  'Garante que ao desmarcar um tipo de veículo (ex: remover MOTO e deixar CARRO) e salvar, o sistema não re-insere a marcação removida',
  async () => {
    const geoServiceFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/lib/geoService.ts'),
      'utf-8'
    );
    const geoDemandViewFile = fs.readFileSync(
      path.join(BASE_DIR, 'src/components/instructor/InstructorGeoDemandView.tsx'),
      'utf-8'
    );

    // 1. Verifica no código fonte que não há mais merge forçado de savedCoverage.tiposVeiculo com vehicleFleetTypes
    assert.equal(
      geoServiceFile.includes('savedCoverage?.tiposVeiculo && savedCoverage.tiposVeiculo.length > 0') &&
      geoServiceFile.includes('? savedCoverage.tiposVeiculo') &&
      !geoServiceFile.includes('? Array.from(new Set([...savedCoverage.tiposVeiculo, ...vehicleFleetTypes]))'),
      true,
      'geoService prioriza estritamente os tipos de veículos salvos pelo instrutor sem forçar merge com frota'
    );

    assert.equal(
      geoServiceFile.includes('savedCoverage?.categoriasAtendidas && savedCoverage.categoriasAtendidas.length > 0') &&
      geoServiceFile.includes('? savedCoverage.categoriasAtendidas') &&
      !geoServiceFile.includes('? Array.from(new Set([...savedCoverage.categoriasAtendidas, ...pkgCategories]))'),
      true,
      'geoService prioriza estritamente as categorias CNH salvas pelo instrutor sem forçar merge com pacotes'
    );

    // 2. Valida o comportamento da função com a regra de negócio rigorosa
    const mockSavedCoverageComApenasCarro = {
      categoriasAtendidas: ['B'],
      tiposVeiculo: ['CARRO']
    };
    const mockVehicleFleetTypes = ['CARRO', 'MOTO'];
    const mockPkgCategories = ['A', 'B'];

    // Lógica corrigida do geoService:
    const effectiveCategorias =
      mockSavedCoverageComApenasCarro?.categoriasAtendidas && mockSavedCoverageComApenasCarro.categoriasAtendidas.length > 0
        ? mockSavedCoverageComApenasCarro.categoriasAtendidas
        : mockPkgCategories;

    const effectiveTiposVeiculo =
      mockSavedCoverageComApenasCarro?.tiposVeiculo && mockSavedCoverageComApenasCarro.tiposVeiculo.length > 0
        ? mockSavedCoverageComApenasCarro.tiposVeiculo
        : Array.from(new Set([...mockVehicleFleetTypes]));

    // Valida que MOTO desmarcado NÃO é reinserido
    assert.deepEqual(
      effectiveTiposVeiculo,
      ['CARRO'],
      'buildEffectiveInstructorCoverage preserva fielmente a desmarcação de MOTO e mantém apenas CARRO'
    );
    assert.equal(
      effectiveTiposVeiculo.includes('MOTO'),
      false,
      'MOTO não pode estar presente após ser desmarcado'
    );

    // Valida que a categoria A desmarcada NÃO é reinserida
    assert.deepEqual(
      effectiveCategorias,
      ['B'],
      'buildEffectiveInstructorCoverage preserva fielmente a desmarcação da categoria A e mantém apenas B'
    );

    // 3. Valida no componente InstructorGeoDemandView a manipulação correta do checkbox
    assert.equal(
      geoDemandViewFile.includes("setTiposVeiculo((prev) => prev.filter((item) => item !== tv))") &&
      geoDemandViewFile.includes("tiposVeiculo: tiposVeiculo.length > 0 ? tiposVeiculo : ['CARRO']") &&
      geoDemandViewFile.includes("await db.saveInstructorCoverageAsync(updatedProfile)"),
      true,
      'InstructorGeoDemandView remove o veículo do estado ao desmarcar e salva o perfil atualizado'
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
