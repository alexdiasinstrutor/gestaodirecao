import { chromium } from 'playwright';
import {isolateServices} from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const results=[];
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  const context=await browser.newContext({viewport});await isolateServices(context);const page=await context.newPage();page.setDefaultTimeout(8000);const now=new Date();now.setHours(9,0,0,0);await page.clock.setFixedTime(now);
  let receipts=[];let versions=[];let deny=false;
  await page.route('**/rest/v1/legal_contract_versions*',route=>route.fulfill(deny?{status:401,json:{code:'42501',message:'permission denied'}}:{json:versions}));
  await page.route('**/rest/v1/legal_acceptances*',route=>route.fulfill({json:receipts}));
  const open=async()=>{await page.goto('http://localhost:3000/tests/ui/harness.html?scene=StudentPortal');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);};
  await open();const reminder=page.getByRole('region',{name:'Contrato pendente de aceite'});
  // section has an accessible name, so its implicit role is region.
  await reminder.waitFor();assert.equal(await reminder.getByRole('button',{name:/Fechar|Dispensar/}).count(),0);
  await page.getByText('Solicite ao instrutor a disponibilização da versão do contrato para aceite.',{exact:true}).waitFor();
  const identity=await page.evaluate(async()=>{const {db}=await import('/src/lib/storage.ts');const user=db.getCurrentUser();const student=db.getStudents(user.organizacaoId).find(item=>item.email.toLowerCase()===user.email.toLowerCase());return {user,student};});
  const rules=await page.evaluate(async identity=>{
   const {hasAcceptedCurrentContracts}=await import('/src/legal/contractReminder.ts');
   const student={...identity.student,aulasCumpridas:0,contratosPacotes:[{id:'one',quantidadeAulas:2},{id:'two',quantidadeAulas:2}]};
   const base={student_id:student.id,student_user_id:identity.user.id,instructor_user_id:student.instrutorId,created_at:'2026-11-16T12:00:00Z'};
   const versions=[{...base,id:'v1',package_contract_id:'one',content_sha256:'hash1'},{...base,id:'v2',package_contract_id:'two',content_sha256:'hash2'}];
   const receipt={signer_user_id:identity.user.id,signer_role:'ALUNO',accepted_general:true,accepted_clauses_4_5:true};
   const first={...receipt,contract_version_id:'v1',content_sha256:'hash1'};const second={...receipt,contract_version_id:'v2',content_sha256:'hash2'};
   return [hasAcceptedCurrentContracts(student,identity.user,versions,[first]),hasAcceptedCurrentContracts(student,identity.user,versions,[first,second]),hasAcceptedCurrentContracts(student,identity.user,versions,[first,{...second,content_sha256:'wrong'}]),hasAcceptedCurrentContracts(student,identity.user,versions,[first,{...second,signer_user_id:'another-user'}])];
  },identity);assert.deepEqual(rules,[false,true,false,false]);
  versions=[{id:'qa-version',student_id:identity.student.id,student_user_id:identity.user.id,instructor_user_id:identity.student.instrutorId,package_contract_id:'qa-package',template_code:'CONTRATO_AULA_PRATICA',created_at:'2026-11-16T12:00:00Z',content_sha256:'hash-test',content:'# Contrato fictício'}];
  await page.evaluate(()=>window.dispatchEvent(new Event('agd:legal-contract-accepted')));await reminder.waitFor();
  // The reminder must never lock the existing booking form.
  const slot=await page.evaluate(async()=>{const {db}=await import('/src/lib/storage.ts');const actor=db.getCurrentUser();const student=db.getStudents(actor.organizacaoId).find(item=>item.email.toLowerCase()===actor.email.toLowerCase());const lessons=db.getLessons(actor.organizacaoId);return db.getSlots(actor.organizacaoId,student.instrutorId).find(slot=>!slot.bloqueado&&!lessons.some(lesson=>lesson.data===slot.data&&lesson.horaInicio===slot.horaInicio&&lesson.instrutorId===student.instrutorId&&['AGENDADA','EM_ANDAMENTO'].includes(lesson.status)));});
  assert.ok(slot,'Fixture deve ter horário livre');await page.locator('form input[type=date]').fill(slot.data);
  await page.locator('form').getByRole('button',{name:new RegExp('^'+slot.horaInicio)}).first().click();
  const submit=page.getByRole('button',{name:'Confirmar Agendamento da Aula',exact:true});assert.equal(await submit.isDisabled(),false);await submit.click();await page.getByText(/Aula prática agendada com sucesso para/).waitFor();await reminder.waitFor();
  await reminder.getByRole('button',{name:'Ler e aceitar contrato',exact:true}).click();await page.getByRole('dialog',{name:'Documentos jurídicos'}).waitFor();await page.keyboard.press('Escape');await reminder.waitFor();
  await page.reload();await page.waitForFunction(()=>window.__UI_AUDIT_READY__);await reminder.waitFor();
  receipts=[{contract_version_id:'qa-version',signer_user_id:identity.user.id,signer_role:'ALUNO',content_sha256:'wrong-hash',accepted_general:true,accepted_clauses_4_5:true}];
  await page.evaluate(()=>window.dispatchEvent(new Event('agd:legal-contract-accepted')));await reminder.waitFor();
  receipts[0].content_sha256='hash-test';await page.evaluate(()=>window.dispatchEvent(new Event('agd:legal-contract-accepted')));await reminder.waitFor({state:'detached'});
  await page.reload();await page.waitForFunction(()=>window.__UI_AUDIT_READY__);await reminder.waitFor({state:'detached'});
  deny=true;await page.evaluate(()=>window.dispatchEvent(new Event('agd:legal-contract-accepted')));await reminder.waitFor();await page.getByText('Não foi possível confirmar a situação do contrato.',{exact:false}).waitFor();
  await fs.mkdir('review-artifacts/contract-reminder',{recursive:true});await reminder.scrollIntoViewIfNeeded();await page.screenshot({path:'review-artifacts/contract-reminder/'+viewport.width+'x'+viewport.height+'.png'});
  results.push({viewport,status:'PASS',persistent:true,bookingAvailableWithPendingContract:true,hashChecked:true,receiptConfirmed:true,permissionsFailureVisible:true});await context.close();
 }
 await fs.writeFile('review-artifacts/contract-reminder/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();}
