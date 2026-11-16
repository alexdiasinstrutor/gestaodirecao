import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/index.css';
import { scenes } from './scenes.mjs';

async function boot() {
 if (!window.__UI_AUDIT_AUTHORIZED__) { document.getElementById('audit-root').textContent='Página exclusiva para execução automatizada com serviços isolados.'; return; }
 const id=new URLSearchParams(location.search).get('scene') || 'StudentInviteModal';
 const scene=scenes.find(s=>s.id===id); if(!scene)throw new Error('Cenário desconhecido: '+id);
 const {db,seedDemoData}=await import('../../src/lib/storage.ts');seedDemoData();
 for(const key of Object.keys(localStorage)) { if(!key.startsWith('agd_'))continue;const raw=localStorage.getItem(key);if(raw)localStorage.setItem(key,raw.replaceAll('stu_pedro_silva','qa_pedro').replaceAll('stu_mariana_souza','qa_mariana').replaceAll('Pedro Henrique Silva','Aluno de Revisão').replaceAll('stu_juliana_costa','qa_juliana')); }
 const org=db.getOrganizations()[0], instructor=db.getUserById('usr_instrutor_carlos'), master=db.getUserById('usr_admin_cassio');
 instructor.nome='Carlos Eduardo Mendes (Instrutor Credenciado Detran)';
 const packages=db.getPackages(org.id).map(p=>({...p,instrutorId:instructor.id,atualizadoEm:new Date().toISOString()}));
 localStorage.setItem('agd_packages',JSON.stringify(packages));localStorage.setItem('agd_packages_backup',JSON.stringify(packages));
 localStorage.setItem('agd_vehicles',JSON.stringify(db.getVehicles(org.id).map(v=>({...v,instrutorId:instructor.id,categoriaCnh:v.tipo==='MOTO'?'A':'B',cambio:'MANUAL'}))));
 const student=db.getStudents(org.id)[0];
 const lead={id:'qa_lead',nome:'Candidato de teste com nome completo',telefone:'11987654321',email:'lead@example.invalid',estado:'MG',cidade:'Belo Horizonte',bairro:'Centro',categoriaCnh:'B',tipoVeiculo:'CARRO',tipoCambio:'MANUAL',raioDesejadoKm:20,status:'AGUARDANDO_INSTRUTOR',criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString(),observacoes:'Cadastro fictício para auditoria de campos e visualização.'};
 localStorage.setItem('agd_student_leads',JSON.stringify([lead]));
 localStorage.setItem('agd_instructor_coverage',JSON.stringify([{instrutorId:instructor.id,organizacaoId:org.id,raioAtendimentoKm:20,cidadeBase:'Belo Horizonte',estadoBase:'MG',cidadesAtendidas:['Belo Horizonte','Betim','Contagem'],categoriasAtendidas:['B','AB'],tiposVeiculo:['CARRO'],tipoCambio:'MANUAL',latitude:-19.92,longitude:-43.94,atualizadoEm:new Date().toISOString()}]));
 localStorage.setItem('agd_discount_coupons',JSON.stringify([{id:'qa_coupon',codigo:'REVISAO10',escopo:'ALUNO',tipoDesconto:'PERCENTUAL',percentual:10,organizacaoId:org.id,instrutorId:instructor.id,criadoPorId:instructor.id,criadoPorNome:instructor.nome,usosRealizados:0,ativo:true,criadoEm:new Date().toISOString(),descricao:'Cupom de teste'}]));
 const currentUser=scene.props?.auditRole==='SUPER_ADMIN'?master:scene.props?.auditRole==='ALUNO'?db.getUserById('usr_aluno_pedro'):scene.source.startsWith('admin/') || ['SecurityAgentsModal','OfficialDossierPdfViewer','AuditLogViewer'].includes(scene.component)?master:scene.component==='StudentPortal'?db.getUserById('usr_aluno_pedro'):instructor;
 db.setCurrentUser(currentUser);
 if(scene.component==='App')sessionStorage.setItem('agd_interface_mode_override','FULL');
 const event=(name,payload)=>window.__UI_AUDIT_EVENTS__.push({name,payload});
 const callbacks=Object.fromEntries(['onSuccess','onCancel','onSave','onCreate','onRegistered','onSimulateOpenInvite','onKeyUpdated','onResetSuccess','onOpenEdit','onOpenKeyModal','onOpenResetPass','onOpenInstructorRegister','onOpenStudentRegister','onOpenLGPD','onOpenDossieAndAgents','onOpenPixConfig','onOpenInvite','onOpenNewStudent','onNavigate','onSwitchUser','onLogout','onDownloadPdf','onOpenPdfTab','onPrint','onDownloadMd','onDownloadHtml','onToggleViewMode','onChange','onSelectPin','showFeedback','onDiscountApplied','onSwitchToFullMode'].map(name=>[name,(...args)=>event(name,args)]));
 const receipt={id:'qa_receipt',numeroRecibo:'QA-001',dataEmissao:'2026-11-16',dataPagamento:'2026-11-16',valorCentavos:123456,metodo:'PIX',tipoRecibo:'PACOTE',descricaoServico:'Pacote de aulas práticas de teste',pacoteReferente:packages[0]?.nome,aluno:{nome:student.nome,cpfMascarado:student.cpfMascarado,telefone:student.telefone,email:student.email,categoriaCnh:'B'},instrutor:{nome:instructor.nome,cidade:'Belo Horizonte',estado:'MG'},codigoAutenticacao:'QA-SEM-VALIDADE'};
 if(scene.component==='DataUpdateBar') { await db.updatePackageAsync({...packages[0],nome:'Plano para histórico de teste'},currentUser.id);const {waitForDataHistory}=await import('../../src/lib/dataHistory.ts');await waitForDataHistory(); }
 if (scene.component==='SupabaseLiveView') await db.pushAllLocalDataToSupabase();
 const props={...callbacks,isOpen:true,instructor,org,organization:org,currentOrg:org,currentUser,user:scene.component==='TwoFactorModal'?instructor:master,userToEdit:master,targetUser:instructor,student,lead,account:db.getAccountsReceivable(org.id)[0],orgId:org.id,actorId:currentUser.id,mode:'NEW',scope:'ALUNO',initialData:receipt,alunoNome:student.nome,alunoTelefone:student.telefone,descricao:'Cobrança fictícia',valorCentavos:123456,chavePix:'pix@example.invalid',tipoChavePix:'EMAIL',beneficiario:instructor.nome,cidade:'Belo Horizonte',txid:'QATEST',currentUserNome:master.nome,viewMode:'OFFICIAL_PDF',value:{cep:'30140071',cidade:'Belo Horizonte',estado:'MG',bairro:'Centro'},centerLat:-19.92,centerLon:-43.94,radiusKm:20,pins:[{id:'qa_pin_1',latitude:-19.92,longitude:-43.94,title:'Instrutor de teste com nome completo',type:'INSTRUCTOR',distanceKm:1},{id:'qa_pin_2',latitude:-19.92,longitude:-43.94,title:'Aluno de teste no mesmo ponto',type:'STUDENT_LEAD',distanceKm:1}],...scene.props};
 const modules=import.meta.glob('../../src/components/**/*.tsx');const load=scene.component==='App'?()=>import('../../src/App.tsx'):modules['../../src/components/'+scene.source];if(!load)throw new Error('Componente ausente: '+scene.source);
 const exports=await load();const Component=exports[scene.component]||exports.default;if(!Component)throw new Error('Export ausente: '+scene.component);
 class Boundary extends React.Component {state={error:null};static getDerivedStateFromError(error){return {error:String(error)};}componentDidCatch(error){window.__UI_AUDIT_RENDER_ERROR__=String(error);}render(){return this.state.error?<pre data-audit-error>{this.state.error}</pre>:this.props.children;}}
 function Harness(){const [closed,setClosed]=React.useState(false);const [address,setAddress]=React.useState(props.value);React.useEffect(()=>{window.__UI_AUDIT_READY__=true;},[]);return closed?<output data-audit-closed>Janela fechada</output>:<Component {...props} {...(scene.component==='AddressCepFields'?{value:address,onChange:setAddress}:{})} onClose={()=>{event('onClose',[]);setClosed(true);}}/>;}
 document.getElementById('audit-root').dataset.scene=id;
 createRoot(document.getElementById('audit-root')).render(<Boundary><div className="min-h-screen bg-slate-100 p-4 sm:p-6"><Harness/></div></Boundary>);
}
boot().catch(error=>{window.__UI_AUDIT_RENDER_ERROR__=String(error);window.__UI_AUDIT_READY__=true;document.getElementById('audit-root').textContent=String(error);});
