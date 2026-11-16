import {chromium} from 'playwright';
import {isolateServices} from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const artifacts=new URL('../review-artifacts/package-consistency/',import.meta.url);await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});let passed=0;
try{
 for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
  const context=await browser.newContext({viewport});await isolateServices(context);const page=await context.newPage();page.setDefaultTimeout(8000);const time=new Date();time.setHours(9,0,0,0);await page.clock.setFixedTime(time);
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene=StudentsView');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  const fixture=await page.evaluate(async()=>{
   const {db}=await import('/src/lib/storage.ts');const teacher=db.getCurrentUser();const student=db.getStudents(teacher.organizacaoId,teacher.id)[0];const offer=db.getPackages(teacher.organizacaoId,teacher.id)[0];Object.assign(offer,{nome:'Pacote 10 manual QA',totalAulas:10,valorCentavos:95000});
   Object.assign(student,{nome:'Aluno Pacote QA',pacoteId:offer.id,pacoteNome:offer.nome,totalAulasContratadas:10,contratosPacotes:[],aulasCumpridas:0});
   localStorage.setItem('agd_packages',JSON.stringify(db.getPackages(teacher.organizacaoId).map(item=>item.id===offer.id?offer:item)));
   localStorage.setItem('agd_accounts',JSON.stringify([{id:'qa-base-invoice',alunoId:student.id,organizacaoId:student.organizacaoId,pacoteId:offer.id,descricao:'Matrícula QA',valorTotalCentavos:95000,valorPagoCentavos:0,saldoDevedorCentavos:95000,status:'PENDENTE',dataVencimento:'2026-11-23',criadoEm:'2026-11-16T12:00:00Z'}]));
   await db.saveStudentAsync(student,teacher.id);return {studentId:student.id,offerId:offer.id};
  });
  await page.locator('input[placeholder]').first().fill('Aluno Pacote QA');await page.getByText('Ver Ficha',{exact:true}).click();
  const history=page.getByRole('heading',{name:/Pacotes Contratados, Aulas Extras/}).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const text=await history.innerText();assert.match(text,/950,00/);assert.ok(!text.includes('1.800,00'));assert.match(text,/Carga: 10 aula/);assert.ok(!text.includes('+10'));
  assert.equal(await page.getByLabel('Total Aulas:',{exact:true}).inputValue(),'10');
  await page.getByRole('button',{name:'Salvar Evolução e Plano',exact:true}).click();
  await page.waitForFunction(id=>{const student=JSON.parse(localStorage.getItem('agd_students')).find(item=>item.id===id);return student.contratosPacotes?.[0]?.valorCentavos===95000;},fixture.studentId);
  await page.screenshot({path:fileURLToPath(new URL(`pacote-10-${viewport.width}.png`,artifacts)),fullPage:true});
  let state=await page.evaluate(id=>JSON.parse(localStorage.getItem('agd_students')).find(item=>item.id===id),fixture.studentId);assert.equal(state.totalAulasContratadas,10);assert.equal(state.contratosPacotes.length,1);assert.equal(state.contratosPacotes[0].quantidadeAulas,10);
  // Adding a package is a separate, explicit action and must add exactly its quantity.
  await page.evaluate(async id=>{const {db}=await import('/src/lib/storage.ts');await db.addStudentContractAsync({alunoId:id,actorId:db.getCurrentUser().id,contract:{tipo:'PACOTE_ADICIONAL',nome:'10 aulas adicionais QA',quantidadeAulas:10,valorCentavos:95000,formaPagamento:'PIX'}});},fixture.studentId);
  state=await page.evaluate(id=>JSON.parse(localStorage.getItem('agd_students')).find(item=>item.id===id),fixture.studentId);assert.equal(state.totalAulasContratadas,20);assert.deepEqual(state.contratosPacotes.map(item=>item.quantidadeAulas),[10,10]);assert.deepEqual(state.contratosPacotes.map(item=>item.valorCentavos),[95000,95000]);
  await page.getByRole('button',{name:'Fechar',exact:true}).click();await page.getByText('Ver Ficha',{exact:true}).click();assert.equal(await page.getByLabel('Total Aulas:',{exact:true}).inputValue(),'20');
  const planSelect=page.locator('select').filter({has:page.locator('option[value="'+fixture.offerId+'"]')});await planSelect.selectOption(fixture.offerId);assert.equal(await page.getByLabel('Total Aulas:',{exact:true}).inputValue(),'20');
  await page.getByRole('button',{name:'Salvar Evolução e Plano',exact:true}).click();
  state=await page.evaluate(id=>JSON.parse(localStorage.getItem('agd_students')).find(item=>item.id===id),fixture.studentId);assert.equal(state.totalAulasContratadas,20);assert.equal(state.contratosPacotes.length,2);
  passed++;await context.close();
 }
 console.log(JSON.stringify({passed,failed:0,baseLessons:10,baseCents:95000,explicitAdditionalLessons:10,totalAfterExplicitAddition:20}));
}finally{await browser.close();}
