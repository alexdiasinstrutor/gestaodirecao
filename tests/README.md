# Testes do sistema — Gestão AD

## Preparação
Instale as dependências do projeto. A suíte visual usa Playwright 1.65.1 e o Chrome já instalado no computador:

    npm install
    npm install --no-save --no-package-lock playwright@1.65.1

Em um terminal, execute `npm run dev`. Em outro, execute:

    npm run test:ui
    npm run test:browser
    npm run test:regression
    npm run lint
    npm run build

O caminho padrão do Chrome é C:/Program Files/Google/Chrome/Application/chrome.exe. Em outro ambiente, defina AUDIT_CHROME. Para outro endereço local, defina AUDIT_BASE_URL. A página de auditoria só inicializa os componentes quando o executor injeta a autorização de teste; acessá-la normalmente não cria os dados fictícios.

## Arquivos
- ui-audit.mjs: executor da matriz visual e de controles.
- ui/scenes.mjs: inventário explícito de telas, diálogos e estados condicionais. Um componente de tela novo sem cenário causa falha na verificação de cobertura.
- ui/harness.jsx: renderiza os componentes reais com dados fictícios completos. Não compõe o build de produção.
- ui/mock-backend.mjs: intercepta todos os serviços externos antes de abrir qualquer tela. Escritas não chegam à produção. Clipboard, abertura de links e impressão são interceptados.
- browser-review.mjs: regressão integrada da aplicação, persistência, assinatura, perda de conexão, quota e contratação de plano.

## Matriz e critérios
São 105 telas/estados em sete resoluções, totalizando 735 combinações. A matriz usa desktop 1440×900; notebook 1280×600; tablet 1024×768; celular 390×844; celular pequeno 320×568; paisagem 844×390; área útil 720×450 como aproximação de reflow com ampliação. Esta última não é uma medição do zoom nativo do Chrome.

Cada estado verifica renderização, erros JavaScript, conteúdo que transborda horizontalmente, campos e botões alcançáveis após rolagem, controles encobertos e operação dos contêineres roláveis. Tabelas e menus com rolagem horizontal explícita são aceitos. Texto com reticências declaradas é registrado como aviso, não confundido com corte acidental.

Os campos de texto, número, senha, e-mail, data, hora e seletores recebem sondagens de edição e restauração na resolução desktop. Campos desabilitados ou somente de leitura são registrados. Checkbox, radio, cor, range e arquivo têm inspeção estrutural nesta matriz; fluxos selecionados são exercitados pelos testes integrados. Os resultados não afirmam ter submetido todas as combinações possíveis de negócio.

No convite, testes específicos verificam estabilidade do token, cópia do link, cópia de toda a mensagem, telefone obrigatório, destino correto do WhatsApp sem envio, barra de rolagem explícita, roda do mouse, teclado, ações inferiores visíveis, contenção de foco e Escape. Há capturas do início e do fim do conteúdo.

Avisos registram rótulos sem associação formal, alvos menores que 32 px, reticências intencionais e campos que precisam de revisão manual. Eles não são ocultados nem equivalem a aprovação de acessibilidade. Marcadores geométricos de mapa possuem alternativas completas na lista de pontos, que é aberta e inspecionada pelo executor.

## Relatórios e reprodução
A saída fica em review-artifacts/ui-audit/report.html e results.json, com evidências PNG. O JSON detalha cada campo e botão, seus valores fictícios, tamanho, estado desabilitado/somente leitura, alcance e teste de edição. A pasta de evidências é ignorada pelo Git; o código da suíte permanece em tests.

Para reproduzir um subconjunto no PowerShell:

    $env:AUDIT_SCENES = 'StudentInviteModal,MasterPasswordModal'
    $env:AUDIT_VIEWPORTS = 'mobile-small,landscape'
    npm run test:ui

Remova as duas variáveis antes de repetir a matriz completa. AUDIT_WORKERS=1 executa uma resolução por vez; o padrão é 2, com contextos separados.

## Limites
PASS significa que os critérios automatizados passaram para os dados e resoluções da matriz. Não é garantia de ausência de defeitos, auditoria completa de segurança, validação de todos os ramos condicionais ou confirmação de pagamentos, entrega de mensagens, autenticação e serviços externos reais. Esses serviços exigem homologação separada. Nenhum teste autoriza commit ou deploy.

Para revalidação incremental, AUDIT_PREVIOUS_REPORT deve apontar para um results.json completo e AUDIT_RECHECK_COMPONENTS deve listar os componentes alterados, separados por vírgula. O executor repete falhas, avisos de rótulos, novos cenários e os componentes indicados; preserva casos aprovados sem alterações e registra a quantidade reutilizada no JSON. Sem essas variáveis, executa a matriz inteira.

## Validação de layout ampliada
Antes da matriz, o detector executa um autoteste: precisa rejeitar um modal propositalmente maior que a janela e aceitar um modal com conteúdo longo rolável e rodapé acessível. Cada caso registra a geometria inicial de modais e rodapés, verifica painéis fora da janela sem rolagem utilizável, controles que só aparecem por deslocamento programático em contêiner com overflow hidden e conteúdo interno cortado em botões. Rodapés normais podem ficar abaixo da dobra quando a página permite alcançá-los por rolagem; isso não é, isoladamente, um defeito. A avaliação automatizada de layout não substitui avaliação humana de estética ou usabilidade.

## Contratos, locação e aceites
Execute node tests/legal-contracts.mjs para testar pacote com locação, dados exibidos e dois aceites em quatro resoluções, com serviços interceptados. Execute node tests/legal-documents.mjs para os 12 cenários de documentos. A migração pode ser validada por node tests/legal-database.mjs usando @electric-sql/pglite em ambiente isolado e LEGAL_PGLITE_PATH apontando para a pasta do pacote. A migração de produção e o vínculo users.auth_user_id são etapas administrativas descritas em src/legal/ATUALIZACAO_BANCO_CONTRATOS.md.

Execute node tests/registration-consent.mjs para verificar os cadastros completos de instrutor e aluno, caixas desmarcadas, bloqueio sem confirmação e evidências anexadas ao perfil. Nova coluna depende de supabase_migracao_aceites_cadastro_20261116.sql.

Execute node tests/contract-reminder.mjs para verificar o aviso persistente em quatro resoluções, recarga, assinatura confirmada pelo banco, hash incorreto, erro de permissão e agendamento disponível com contrato pendente.

Execute node tests/legacy-contract-loading.mjs para reproduzir matrículas legadas sem contratos detalhados e validar o carregamento por cobrança histórica e aceite de versão publicada.

A suíte legal-documents.mjs verifica o botão Exportar minuta como download PDF e a ação Exportar dados (JSON) com conferência de hash.


## Consistência dos pacotes do aluno
Execute node tests/student-package-consistency.mjs para validar que pacote base, quantidade, valor histórico e cobrança permanecem coerentes. O cenário cobre 10 aulas por R$ 950,00, salvamento sem duplicação, acréscimo somente por contratação explícita e preservação de extras reais em desktop e celular.


## Edição da quantidade de aulas
Execute node tests/lesson-quantity-inputs.mjs para validar que os campos de quantidade da ficha, aulas avulsas, pacote personalizado e cadastro de pacote permitem apagar e redigitar o valor em desktop e celular.
