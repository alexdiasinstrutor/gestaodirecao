import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { isolateServices } from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const results=[];
async function address(page) {
 await page.getByLabel('2º CEP (Preenchimento Automático)',{exact:true}).fill('30140071');
 await page.waitForTimeout(700);
 await page.getByLabel('Logradouro (Rua / Avenida / Praça)',{exact:true}).fill('Rua de teste');
 await page.getByLabel('Número',{exact:true}).fill('36');
 await page.getByLabel('Bairro',{exact:true}).fill('Centro');
 await page.getByLabel('Cidade / Município',{exact:true}).fill('Belo Horizonte');
}
try {
 for(const scene of ['InstructorRegisterModal','StudentSelfRegisterModal:vinculado']) {
  const context=await browser.newContext({viewport:{width:390,height:844}});await isolateServices(context);const page=await context.newPage();page.setDefaultTimeout(8000);
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene='+encodeURIComponent(scene));await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  const instructor=scene==='InstructorRegisterModal';
  await page.getByRole('button',{name:instructor?'Continuar para Dados Cadastrais':'Avançar para Dados Pessoais',exact:true}).click();
  if(instructor) {
   await page.getByLabel('Nome Completo do Instrutor *',{exact:true}).fill('Instrutor do Aceite');
   await page.getByLabel('CPF (com validação estrita) *',{exact:true}).fill('11144477735');
   await page.getByLabel('Telefone WhatsApp *',{exact:true}).fill('11987654321');
   await page.getByLabel('E-mail Profissional *',{exact:true}).fill('instructor-consent@example.invalid');
  } else {
   await page.getByLabel('Nome Completo do Aluno *',{exact:true}).first().fill('Aluno do Aceite');
   await page.locator('input[type=date]').fill('1990-01-01');
   await page.locator('input[placeholder*="000.000"]').fill('11144477735');
   await page.getByLabel(/WhatsApp/).last().fill('11987654321');
  }
  await address(page);
  await page.getByRole('button',{name:instructor?'Continuar para Senha':/Avançar.*Senha|Avançar.*Login|Criar.*Acesso|Continuar.*Senha/}).click();
  if(!instructor)await page.getByLabel('E-mail para Login na Plataforma *',{exact:true}).fill('student-consent@example.invalid');
  const passwords=page.locator('input[type=password]');await passwords.nth(0).fill('TesteLocal123!');await passwords.nth(1).fill('TesteLocal123!');
  const terms=page.getByLabel('Li e aceito os Termos de Uso e a Política de Privacidade da plataforma.',{exact:true});assert.equal(await terms.isChecked(),false);
  const submit=page.getByRole('button',{name:instructor?'Concluir Cadastro & Iniciar':'Finalizar Auto-Cadastro',exact:true});await submit.click();
  assert.equal(await page.evaluate(()=>window.__UI_AUDIT_EVENTS__.filter(event=>event.name==='onRegistered').length),0);
  await terms.check();
  if(!instructor){const offer=page.getByLabel(/^Aceito contratar o pacote/);const clauses=page.getByLabel(/^Estou ciente das cláusulas/);assert.equal(await offer.isChecked(),false);assert.equal(await clauses.isChecked(),false);await submit.click();assert.equal(await page.evaluate(()=>window.__UI_AUDIT_EVENTS__.filter(event=>event.name==='onRegistered').length),0);await offer.check();await clauses.check();}
  await fs.mkdir('review-artifacts/registration-consent',{recursive:true});await submit.scrollIntoViewIfNeeded();await page.screenshot({path:'review-artifacts/registration-consent/'+(instructor?'instrutor':'aluno')+'.png'});
  await submit.click();await page.waitForFunction(()=>window.__UI_AUDIT_EVENTS__.some(event=>event.name==='onRegistered'));
  const evidence=await page.evaluate(()=>{const event=window.__UI_AUDIT_EVENTS__.find(event=>event.name==='onRegistered');return event.payload.at(-1).registrationLegalConsent;});
  assert.equal(evidence.documents.length,2);assert.equal(evidence.status,'DECLARADO_NO_CADASTRO');assert.ok(evidence.documents.every(document=>document.sha256.length===64));
  if(!instructor){assert.equal(evidence.acceptedPackage,true);assert.equal(evidence.acceptedClauses4And5,true);assert.ok(evidence.packageOffer.instructorId);}
  results.push({scene,status:'PASS'});await context.close();
 }
 console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();}
