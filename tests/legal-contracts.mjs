import { chromium } from 'playwright';
import { isolateServices } from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const output=new URL('../review-artifacts/legal-contracts/',import.meta.url);await fs.mkdir(output,{recursive:true});const results=[];
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
  const context=await browser.newContext({viewport});await isolateServices(context);const page=await context.newPage();page.setDefaultTimeout(5000);page.setDefaultNavigationTimeout(15000);console.log('Viewport '+viewport.width);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene=AddStudentPackageModal%3Apersonalizado');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  await page.getByLabel('Incluir locação do carro para exame no pacote').check();await page.getByLabel('Valor da locação para exame (R$)',{exact:true}).fill('200');
  await page.getByRole('button',{name:/Confirmar e Adicionar/}).click();await page.waitForFunction(()=>window.__UI_AUDIT_EVENTS__.some(event=>event.name==='onSuccess'),null,{timeout:10000});console.log('Pacote gravado');
  const student=await page.evaluate(()=>JSON.parse(localStorage.getItem('agd_students')).find(item=>item.contratosPacotes?.some(c=>c.valorLocacaoExameCentavos===20000)));
  assert.ok(student);const contract=student.contratosPacotes.find(c=>c.valorLocacaoExameCentavos===20000);assert.equal(contract.valorAulasCentavos,72000);assert.equal(contract.valorCentavos,92000);
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene=Header');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  await page.evaluate(student=>{const students=JSON.parse(localStorage.getItem('agd_students'));localStorage.setItem('agd_students',JSON.stringify(students.map(item=>item.id===student.id?student:item)));},student);
  await page.getByRole('button',{name:'Termos, privacidade e contratos',exact:true}).click();await page.getByLabel('Documento jurídico',{exact:true}).selectOption('CONTRATO_AULA_PRATICA');await page.getByLabel('Aluno do contrato',{exact:true}).selectOption(student.id);await page.getByLabel('Pacote do contrato',{exact:true}).selectOption(contract.id);
  const content=page.getByLabel('Conteúdo do documento jurídico');assert.ok((await content.innerText()).includes(student.nome));assert.ok((await content.innerText()).includes('920,00'));assert.ok((await content.innerText()).includes('720,00'));assert.ok((await content.innerText()).includes('200,00'));
  await page.locator('details summary').click();const fields=page.locator('details input');for(const field of await fields.all())if(!await field.inputValue())await field.fill('Dado cadastral de teste');
  const snapshot=await content.innerText();let version;let attempts=0;
  await page.route('**/rest/v1/rpc/prepare_legal_contract',async route=>{const payload=route.request().postDataJSON();assert.equal(payload.p_student_id,student.id);assert.equal(payload.p_package_contract_id,contract.id);assert.equal(payload.p_variables.VALOR_ALUGUEL_EXAME,'200,00');version={id:'11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa',content:snapshot,content_sha256:createHash('sha256').update(snapshot).digest('hex'),created_at:new Date().toISOString(),package_contract_id:contract.id};await route.fulfill({json:version});});
  await page.route('**/rest/v1/rpc/accept_legal_contract',async route=>{const payload=route.request().postDataJSON();assert.equal(payload.p_hash,version.content_sha256);assert.equal(payload.p_general,true);assert.equal(payload.p_clauses,true);attempts++;await route.fulfill(attempts===1?{status:500,json:{message:'Falha simulada ao gravar aceite'}}:{json:{id:'receipt-qa',accepted_at:new Date().toISOString()}});});
  await page.getByRole('button',{name:'Registrar versão para aceite',exact:true}).click();const accept=page.getByRole('button',{name:'Confirmar meu aceite',exact:true});await accept.waitFor();assert.ok(await accept.isDisabled());
  await page.getByLabel('Li e concordo com os termos do Contrato de Prestação de Serviços.',{exact:true}).check();assert.ok(await accept.isDisabled());await page.getByLabel(/Estou ciente e concordo especificamente/).check();await accept.click();await page.getByRole('status').filter({hasText:'Falha simulada'}).waitFor();assert.ok(!(await page.getByRole('status').innerText()).includes('Aceite confirmado'));
  await accept.click();await page.getByRole('status').filter({hasText:'Aceite confirmado pelo banco'}).waitFor();assert.deepEqual(errors,[]);
  await page.screenshot({path:new URL(viewport.width+'x'+viewport.height+'.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});results.push({viewport,status:'PASS',aulas:72000,locacao:20000,total:92000,aceiteAposConfirmacao:true});await context.close();
 }
 await fs.writeFile(new URL('results.json',output),JSON.stringify(results,null,2));console.log(JSON.stringify({passed:results.length,results}));
}finally{await browser.close();}
