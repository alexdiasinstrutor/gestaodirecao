// Every screen/modal source must be represented here or explicitly classified as a primitive.
const simple = [
 ['LegalDocumentsAccess','legal'],
 ['LoginScreen','auth'], ['PasswordRecoveryModal','auth'], ['TwoFactorModal','common'],
 ['InstructorRegisterModal','auth'], ['StudentSelfRegisterModal','auth'], ['StudentInviteModal','auth'], ['InstructorLocatorMapModal','auth'],
 ['InstructorDashboard','instructor'], ['StudentsView','instructor'], ['ScheduleView','instructor'], ['VehiclesView','instructor'],
 ['InstructorGeoDemandView','instructor'], ['WhatsAppRemindersView','instructor'], ['FinanceView','instructor'],
 ['FinancialHealthView','instructor'], ['ReportsView','instructor'], ['PackagesManager','instructor'], ['StudentTransferModal','instructor'],
 ['AddStudentPackageModal','instructor'], ['StudentPortal','student'], ['AdminMasterPanel','admin'], ['AdminStudentLeadsView','admin'],
 ['SaaSPlansTableView','admin'], ['OrganizationDetailsModal','admin'], ['OrganizationEditModal','admin'], ['OrganizationNewModal','admin'],
 ['OrganizationAccessKeyModal','admin'], ['ResetPasswordModal','admin'], ['MasterPasswordModal','admin'], ['MasterUserEditModal','admin'],
 ['EditStudentLeadModal','admin'], ['DirectStudentLeadModal','admin'], ['SupabaseMigrationModal','admin'], ['SupabaseLiveView','admin'],
 ['PaymentReceiptModal','common'], ['PixConfigModal','common'], ['PixQrCodeModal','common'], ['ApplyDiscountModal','common'],
 ['SecurityAgentsModal','common'], ['OfficialDossierPdfViewer','common'], ['AuditLogViewer','common'], ['CouponsManager','common'],
 ['DataUpdateBar','common'], ['Header','common'], ['AddressCepFields','common'], ['InteractiveGeoMap','common']
].map(([component,folder])=>({ id: component, component, source: folder+'/'+component+'.tsx', ...(component==='LegalDocumentsAccess'?{steps:[{role:'button',name:'Termos, privacidade e contratos'}]}:{}) }));
const extra = (base,id,steps=[],props={})=>({ ...simple.find(s=>s.id===base),id:base+':'+id,steps,props });
const button = (name,regex=false)=>({ role:'button',name,regex });
const appScenes = ['Painel Geral','Agenda & Horários','Alunos & Progresso','Meus Veículos','Mapa & Notificações','Cobrança & PIX','Finanças & DRE','Saúde Financeira','Relatórios Automáticos'].map((name,index)=>({id:'App:area-'+index,component:'App',source:'../App.tsx',steps:[button(name)]}));
appScenes.push({id:'App:admin',component:'App',source:'../App.tsx',props:{auditRole:'SUPER_ADMIN'}});
appScenes.push({id:'App:aluno',component:'App',source:'../App.tsx',props:{auditRole:'ALUNO'}});
appScenes.push({id:'App:convite',component:'App',source:'../App.tsx',steps:[button('Convidar Aluno')]});
export const scenes = [...simple,...appScenes,
 extra('StudentSelfRegisterModal','vinculado',[],{defaultInstructorId:'usr_instrutor_carlos',defaultOrgId:'org_direcao_certa_01'}),
 extra('InstructorDashboard','essencial',[],{isSimplified:true}), extra('StudentPortal','essencial',[],{isSimplified:true}),
 extra('MasterUserEditModal','editar',[],{mode:'EDIT'}),
 extra('AddStudentPackageModal','avulsas',[],{initialTab:'SINGLE_CLASSES'}), extra('AddStudentPackageModal','personalizado',[],{initialTab:'CUSTOM_PACKAGE'}),
 extra('PackagesManager','novo',[button('Cadastrar Novo Pacote')]), extra('PackagesManager','editar',[{title:'Editar pacote'}]),
 extra('ReportsView','faturamento',[button('^2[.]',true)]),
 extra('ReportsView','boletim',[button('^3[.]',true)]),
 extra('VehiclesView','novo',[button('Cadastrar Meu Veículo')]), extra('VehiclesView','editar',[button('Editar')]),
 extra('StudentsView','ficha',[{text:'Ver Ficha'}]), extra('StudentsView','pagamentos',[button('Relatório de Pagamentos')]),
 extra('ScheduleView','aula',[button('Agendar Aluno (Semanal / Mensal)')]),
 extra('ScheduleView','horario',[button('+ Horário Avulso')]),
 extra('ScheduleView','liberar',[button('Liberar Agenda (Dia / Semanal / Mensal / Anual)')]),
 extra('ScheduleView','remarcar',[button('Remarcar')]),
 extra('ScheduleView','concluir',[button('Concluir & Avaliar')]),
 extra('SupabaseLiveView','senha',[{title:'Redefinir senha diretamente no Supabase'}]),
 extra('ScheduleView','remover',[button('Remover / Indisponibilizar Período')]),
 extra('FinanceView','nova-cobranca',[button('Lançar Nova Cobrança')]),
 extra('FinanceView','pagamento',[button('Registrar Pagamento')]),
 extra('FinanceView','despesas',[button('^Despesas',true)]),
 extra('FinanceView','nova-despesa',[button('^Despesas',true),button('Lançar Despesa',true)]),
 extra('FinanceView','investimentos',[button('^Investimentos',true)]),
 extra('FinanceView','novo-investimento',[button('^Investimentos',true),button('Novo Plano de Investimento')]),
 extra('FinanceView','editar-investimento',[button('^Investimentos',true),{title:'Editar planejamento'}]),
 extra('FinanceView','pacotes',[button('Pacotes')]), extra('FinanceView','cupons',[button('Cupons dos Alunos')]),
 extra('FinanceView','dre',[button('DRE')]), extra('FinanceView','irpf',[button('IRPF / Carnê-Leão')]),
 extra('SaaSPlansTableView','editar',[button('Editar Plano')]),
 extra('CouponsManager','novo',[button('Gerar.*Cupom',true)]),
 ...['Instituições & CFCs','Equipe Master & Senhas','Alunos Procurando','Planos SaaS & Módulos','Gerador de Cupons','Manutenção & Demo','Banco Supabase'].map((name,i)=>extra('AdminMasterPanel','aba-'+i,[button(name,true)])),
 ...['2.','3.','4.','5.'].map((name,i)=>extra('SecurityAgentsModal','aba-'+(i+2),[button('^'+name.replace('.','\\.'),true)])),
 extra('ApplyDiscountModal','manual',[button('Desconto Direto (R$ ou %)')]),
 extra('Header','perfil',[{css:'header button',hasText:'Carlos'}]),
 extra('DataUpdateBar','historico',[button('Histórico e backups')])
];
export const primitives = ['ContractConditionsFields.tsx','LegalDocument.tsx','RegistrationTerms.tsx','Logo.tsx','SmartScrollNav.tsx','ErrorBoundary.tsx'];
