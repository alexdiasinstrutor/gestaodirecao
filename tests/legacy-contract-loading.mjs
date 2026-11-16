import {chromium} from 'playwright';
import {isolateServices} from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
const preview=process.env.LEGAL_PREVIEW_VISIBLE==='1';const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:!preview,args:preview?['--start-maximized']:[]});const results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  const context=await browser.newContext({viewport:preview?null:viewport,acceptDownloads:true});await isolateServices(context);const page=await context.newPage();page.setDefaultTimeout(8000);let published=[];
  await page.route('**/rest/v1/legal_contract_versions*',route=>route.fulfill({json:published}));
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene=Header%3Aaluno');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  const identity=await page.evaluate(async()=>{
   const {db}=await import('/src/lib/storage.ts');const actor=db.getCurrentUser();const student=db.getStudents(actor.organizacaoId).find(item=>item.email.toLowerCase()===actor.email.toLowerCase());
   student.contratosPacotes=[];student.cidade='Betim';student.estado='MG';const offers=db.getPackages(actor.organizacaoId,student.instrutorId);const offer=offers.find(item=>item.id===student.pacoteId)||offers[0];student.pacoteId=offer.id;student.pacoteNome=offer.nome;
   offer.condicoesContratuais={duracaoAulaMinutos:50,diasAvisoExame:5,prazoValidadeDias:180,percentualMulta:10};
   const users=JSON.parse(localStorage.getItem('agd_users'));for(const user of users){if(user.id===student.instrutorId)Object.assign(user,{cpfCompleto:'52998224725',registroDetran:'MG-LEGADO',cidade:'Betim',estado:'MG'});if(user.id===actor.id)Object.assign(user,{cpfCompleto:'11144477735'});}localStorage.setItem('agd_users',JSON.stringify(users));
   localStorage.setItem('agd_students',JSON.stringify(db.getStudents(actor.organizacaoId).map(item=>item.id===student.id?student:item)));
   localStorage.setItem('agd_packages',JSON.stringify(db.getPackages(actor.organizacaoId).map(item=>item.id===offer.id?offer:item)));
   localStorage.setItem('agd_accounts',JSON.stringify([{id:'qa-legacy-invoice',organizacaoId:actor.organizacaoId,alunoId:student.id,pacoteId:offer.id,descricao:'Matrícula antiga',valorTotalCentavos:145000,valorPagoCentavos:145000,saldoDevedorCentavos:0,status:'PAGO',dataVencimento:'2026-11-16',criadoEm:'2026-11-16T12:00:00Z'}]));
   await db.pushAllLocalDataToSupabase();const {supabaseAdapter}=await import('/src/lib/supabaseAdapter.ts');await supabaseAdapter.saveAccountReceivable(db.getAccountsReceivable(actor.organizacaoId)[0]);return {actor,student};
  });
  const open=async()=>{await page.getByRole('button',{name:'Termos, privacidade e contratos',exact:true}).click();await page.getByLabel('Documento jurídico',{exact:true}).selectOption('CONTRATO_AULA_PRATICA');};
  await open();const content=page.getByLabel('Conteúdo do documento jurídico');await content.filter({hasText:identity.student.nome}).waitFor();assert.ok((await content.innerText()).includes('1450,00'));assert.ok(!(await content.innerText()).includes('[PREENCHER'));
  await page.getByRole('status').filter({hasText:'instrutor precisa registrar uma versão'}).waitFor();assert.equal(await page.getByRole('button',{name:'Confirmar meu aceite',exact:true}).count(),0);
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar dados (JSON)',exact:true}).click();const downloaded=await downloadPromise;const snapshot=JSON.parse(await fs.readFile(await downloaded.path(),'utf8'));
  published=[{id:'qa-registered-version',student_id:identity.student.id,student_user_id:identity.actor.id,instructor_user_id:identity.student.instrutorId,package_contract_id:'cnt_legacy_'+identity.student.id+'_'+identity.student.pacoteId,content:snapshot.conteudo,content_sha256:createHash('sha256').update(snapshot.conteudo).digest('hex'),created_at:'2026-11-16T12:00:00Z'}];
  await page.getByRole('button',{name:'Fechar documentos jurídicos',exact:true}).click();await open();
  const accept=page.getByRole('button',{name:'Confirmar meu aceite',exact:true});await accept.waitFor();assert.equal(await accept.isDisabled(),true);assert.equal(await page.getByLabel('Versão registrada para aceite',{exact:true}).inputValue(),'qa-registered-version');
  await page.route('**/rest/v1/rpc/accept_legal_contract',async route=>{const body=route.request().postDataJSON();assert.equal(body.p_version_id,'qa-registered-version');assert.equal(body.p_hash,published[0].content_sha256);await route.fulfill({json:{id:'qa-receipt',accepted_at:'2026-11-16T12:00:00Z'}});});
  if(preview){await page.evaluate(()=>document.title='Prévia local — contrato fictício disponível para aceite');console.log('Prévia aberta com contrato fictício publicado e aceite habilitado após as duas caixas.');await new Promise(()=>{});}
  await page.getByLabel('Li e concordo com os termos do Contrato de Prestação de Serviços.',{exact:true}).check();await page.getByLabel(/Estou ciente e concordo especificamente/).check();await accept.click();await page.getByRole('status').filter({hasText:'Aceite confirmado pelo banco'}).waitFor();
  results.push({viewport,status:'PASS',legacyLoaded:true,registeredVersionAutomatic:true,acceptanceConfirmed:true});await context.close();
 }
 console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();}
