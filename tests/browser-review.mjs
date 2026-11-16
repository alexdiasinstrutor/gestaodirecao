import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const output = new URL('../review-artifacts/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: process.env.REVIEW_VISIBLE !== '1' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const database = new Map(); let rejectWrites = false; let writes = 0;
// Every external request is intercepted. No test ever changes the production database.
await context.route('**/*', async route => {
 const request = route.request(), url = new URL(request.url());
 if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
 if (!url.hostname.includes('supabase.co')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
 const table = url.pathname.split('/rest/v1/')[1];
 if (!table) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
 let rows = database.get(table) || [];
 if (request.method() === 'GET' || request.method() === 'HEAD') {
   for (const [field, value] of url.searchParams) if (value.startsWith('eq.')) rows = rows.filter(row => String(row[field]) === value.slice(3));
   return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
 }
 writes++;
 if (rejectWrites) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'TEST_OFFLINE', message: 'Simulated write failure' }) });
 if (request.method() === 'POST' || request.method() === 'PATCH') {
   let body = request.postDataJSON(); for (const row of Array.isArray(body) ? body : [body]) { const i = rows.findIndex(r => r.id === row.id); if (i < 0) rows.push(row); else rows[i] = { ...rows[i], ...row }; }
   database.set(table, rows);
 }
 return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
});
const page = await context.newPage(); page.setDefaultTimeout(12000); const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('dialog', d => d.dismiss());
await page.goto('http://localhost:3000'); await page.waitForTimeout(800);
await page.evaluate(async () => {
 const { seedDemoData, db } = await import('/src/lib/storage.ts'); seedDemoData();
 for (const key of Object.keys(localStorage)) {
   if (!key.startsWith('agd_')) continue;
   const raw = localStorage.getItem(key); if (!raw) continue;
   localStorage.setItem(key, raw.replaceAll('stu_pedro_silva','qa_pedro').replaceAll('stu_mariana_souza','qa_mariana').replaceAll('Pedro Henrique Silva','Aluno de Revisão').replaceAll('stu_juliana_costa','qa_juliana'));
 }
 const packages = JSON.parse(localStorage.getItem('agd_packages') || '[]').map(p => ({ ...p, instrutorId: 'usr_instrutor_carlos', atualizadoEm: new Date().toISOString() }));
 localStorage.setItem('agd_packages',JSON.stringify(packages)); localStorage.setItem('agd_packages_backup',JSON.stringify(packages));
 db.setCurrentUser(db.getUserById('usr_instrutor_carlos'));
 localStorage.setItem('agd_interface_mode','FULL');
});
await page.reload(); await page.waitForTimeout(1000);
const nav = page.getByRole('navigation', { name: 'Menu de Navegação Principal', exact: true });
await nav.waitFor();
if (process.env.PREVIEW_ONLY === '1') {
 await page.evaluate(async()=>{const {db}=await import('/src/lib/storage.ts');const user=db.getCurrentUser();const pkg=db.getPackages(user.organizacaoId,user.id)[0];if(pkg)await db.updatePackageAsync({...pkg,nome:pkg.nome},user.id);const {waitForDataHistory}=await import('/src/lib/dataHistory.ts');await waitForDataHistory();});
 const decorate = () => {
  document.title='Prévia UX/UI — Gestão AD (dados fictícios)';
  if(document.getElementById('qa-preview-banner'))return;
  const badge=document.createElement('div');badge.id='qa-preview-banner';badge.textContent='PRÉVIA LOCAL · DADOS FICTÍCIOS';
  Object.assign(badge.style,{position:'fixed',bottom:'12px',right:'16px',zIndex:'99999',background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:'12px',fontSize:'12px',boxShadow:'0 4px 18px #0f172a33'});document.body.append(badge);
 };
 await page.evaluate(decorate);
 await page.addInitScript({ content: 'document.addEventListener("DOMContentLoaded", (' + decorate.toString() + '));' });
 await page.screenshot({path:new URL('preview-desktop.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 console.log('PRÉVIA VISÍVEL ABERTA — dados fictícios; requisições externas interceptadas');
 await new Promise(()=>{});
}
for (const label of ['Convidar Aluno','Chave PIX']) {
 await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(150);
 assert.equal(await page.getByText('Algo deu errado',{exact:false}).count(),0,label);
 await page.reload();await nav.waitFor();await page.waitForTimeout(150);
}
const labels = await nav.getByRole('button').allTextContents();
const screens = [];
for (const label of labels) {
 await nav.getByRole('button', { name: label.trim(), exact: true }).click(); await page.waitForTimeout(180);
 assert.equal(await page.getByText('Algo deu errado', { exact: false }).count(), 0, label);
 screens.push(label.trim());
}
await nav.getByRole('button',{ name: 'Painel Geral', exact: true }).click();
await page.screenshot({ path: new URL('dashboard-desktop.png', output).pathname.replace(/^\/([A-Za-z]:)/,'$1'), fullPage: true });
// Exercise actual storage operations, reload and remote hydration; all requests still go to the mock above.
const result = await page.evaluate(async () => {
 const { db, syncFromSupabase } = await import('/src/lib/storage.ts');
 const { waitForDataHistory, getDataCheckpoints, getDataUpdateStatus } = await import('/src/lib/dataHistory.ts');
 const user = db.getCurrentUser();
 const pkg = { ...db.getPackages(user.organizacaoId,user.id)[0], id: 'qa_persistence', nome: 'Plano revisão 35 aulas', totalAulas: 35, valorCentavos: 234567, instrutorId: user.id, organizacaoId: user.organizacaoId, ativo: true, categoriaCnh: 'B', formaPagamento: 'TODAS', maxParcelas: 7, criadoEm: new Date().toISOString() };
 await db.createPackageAsync(pkg,user.id);
 await db.updatePackageAsync({ ...pkg, nome: 'Plano atualizado 42 aulas', totalAulas: 42 },user.id);
 const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 await db.saveUserSignature(user.id,image,{ scale:135,offsetX:12,offsetY:-8 });
 await syncFromSupabase(); await waitForDataHistory();
 return { pkg:db.getPackages(user.organizacaoId,user.id).find(p => p.id === pkg.id), user:db.getUserById(user.id), history:(await getDataCheckpoints(user)).length, status:getDataUpdateStatus() };
});
const normalizedSignature = await page.evaluate(async()=>{
 const {prepareSignatureImage}=await import('/src/lib/signatureImage.ts');
 const canvas=document.createElement('canvas');canvas.width=800;canvas.height=500;const ctx=canvas.getContext('2d');const pixels=ctx.createImageData(800,500);crypto.getRandomValues(new Uint8Array(1));
 for(let i=0;i<pixels.data.length;i+=4){const value=Math.floor(Math.random()*256);pixels.data[i]=value;pixels.data[i+1]=value;pixels.data[i+2]=value;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
 const original=canvas.toDataURL('image/png');const prepared=await prepareSignatureImage(original);return {before:original.length,after:prepared.length};
});assert.ok(normalizedSignature.after <= 240*1024);assert.ok(normalizedSignature.after < normalizedSignature.before);
assert.equal(result.pkg.totalAulas,42); assert.equal(result.user.assinaturaConfig.scale,135); assert.ok(result.history >= 3); assert.equal(result.status.backup,'saved');
await page.reload(); await page.waitForTimeout(700);
assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('agd_packages')).find(p => p.id === 'qa_persistence').totalAulas),42);
rejectWrites = true;
const failed = await page.evaluate(async () => {
 const { db } = await import('/src/lib/storage.ts'); const user=db.getCurrentUser(); const pkg=db.getPackages(user.organizacaoId,user.id).find(p => p.id === 'qa_persistence');
 try { await db.updatePackageAsync({ ...pkg,totalAulas:55 },user.id); return false; } catch { return JSON.parse(localStorage.getItem('agd_pending_packages')).includes(pkg.id); }
});
assert.equal(failed,true);
const pendingExpense = await page.evaluate(async () => {
 const {db}=await import('/src/lib/storage.ts'); const {getPendingWrites}=await import('/src/lib/cloudOutbox.ts');
 const user=db.getCurrentUser(); db.createExpense({id:'qa_offline_expense',organizacaoId:user.organizacaoId,descricao:'Despesa offline de revisão',categoria:'COMBUSTIVEL',valorCentavos:1234,dataVencimento:'2026-11-16',status:'PENDENTE',criadoEm:new Date().toISOString()},user.id);
 await new Promise(resolve=>setTimeout(resolve,100));
 return getPendingWrites().some(p=>p.table==='expenses' && p.row.id==='qa_offline_expense');
}); assert.equal(pendingExpense,true);
rejectWrites = false;
await page.evaluate(async () => { const { syncFromSupabase } = await import('/src/lib/storage.ts'); await syncFromSupabase(); });
await page.waitForTimeout(300);
assert.equal(await page.evaluate(async()=>{const {db}=await import('/src/lib/storage.ts');return db.getExpenses(db.getCurrentUser().organizacaoId).find(e=>e.id==='qa_offline_expense')?.valorCentavos;}),1234);
await page.getByRole('button',{name:'Histórico e backups',exact:true}).click(); await page.getByRole('dialog',{name:'Histórico e backups'}).waitFor();
await page.screenshot({path: new URL('backups.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
await page.getByRole('button',{name:'Fechar histórico'}).click();
for (const width of [390,320]) {
 await page.setViewportSize({width,height:900}); await page.waitForTimeout(200);
 const sizes=await page.evaluate(() => ({w:innerWidth,body:document.documentElement.scrollWidth}));
 assert.ok(sizes.body <= sizes.w + 1, 'Horizontal overflow at '+width+': '+JSON.stringify(sizes));
 await page.screenshot({path:new URL('dashboard-mobile-'+width+'.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
}
await page.setViewportSize({width:1440,height:1000});
await page.evaluate(async () => {const {db}=await import('/src/lib/storage.ts');db.setCurrentUser(db.getUserById('usr_admin_cassio'));});
await page.reload(); await page.waitForTimeout(500);
await page.getByTitle('Dossiê Técnico e Agentes de Segurança (Acesso Exclusivo do Administrador)').click();await page.waitForTimeout(300);
assert.equal(await page.getByText('Algo deu errado',{exact:false}).count(),0,'Dossiê');
await page.reload();await page.waitForTimeout(300);
const adminNav = page.getByRole('navigation',{name:'Sub-abas do Console Master',exact:true});
const adminButtons = await adminNav.getByRole('button').allTextContents();
for (let index=0; index<adminButtons.length; index++) {
 const label=adminButtons[index]; await adminNav.getByRole('button').nth(index).click(); await page.waitForTimeout(150);
 assert.equal(await page.getByText('Algo deu errado',{exact:false}).count(),0,label);
}
if (await page.getByRole('button',{name:'Fechar',exact:true}).count()) await page.getByRole('button',{name:'Fechar',exact:true}).last().click();
await adminNav.getByRole('button',{name:'Planos SaaS & Módulos',exact:true}).click();
const saas = await page.evaluate(async () => {
 const { getSaaSPlans, saveSaaSPlan, syncSaaSPlans } = await import('/src/lib/saasPlans.ts');
 await saveSaaSPlan('BASICO',{...getSaaSPlans().BASICO,precoSugeridoMensalCentavos:12345,limiteAlunos:37});
 localStorage.removeItem('agd_saas_custom_plans_v1'); await syncSaaSPlans();
 return getSaaSPlans().BASICO;
});
assert.equal(saas.precoSugeridoMensalCentavos,12345); assert.equal(saas.limiteAlunos,37);
await page.evaluate(async () => {const {db}=await import('/src/lib/storage.ts');db.setCurrentUser(db.getUserById('usr_instrutor_carlos'));});
await page.reload(); await page.waitForTimeout(500);
await page.getByRole('navigation',{name:'Menu de Navegação Principal',exact:true}).getByRole('button',{name:'Finanças & DRE',exact:true}).click();
for(const label of [/^A Receber/,/^Despesas \(/,/^Investimentos \(/,/^Pacotes$/,/^Cupons dos Alunos$/,/^DRE$/,/IRPF/]) {
 const button=page.getByRole('button',{name:label}).first(); if(await button.count()){await button.click();await page.waitForTimeout(120);}
}
await page.getByRole('button',{name:/^A Receber/}).first().click();
await page.getByRole('button',{name:'Emitir Recibo',exact:true}).first().click();
assert.ok(await page.locator('img[alt*="Assinatura"]').count() > 0);
await page.screenshot({path:new URL('receipt-signature.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
await page.getByRole('button',{name:'Fechar recibo',exact:true}).click();
await page.getByRole('button',{name:'Pacotes',exact:true}).click();
await page.getByRole('button',{name:'Cadastrar Novo Pacote',exact:true}).click();
const form=page.locator('form').last(); await form.getByPlaceholder('Ex: Pacote Completo CNH B - 20 Aulas Práticas').fill('Pacote criado pela interface');
await form.locator('input[type=number]').nth(0).fill('35');
await form.getByRole('button',{name:'Salvar Pacote',exact:true}).click();
await page.getByText('Novo pacote "Pacote criado pela interface"', {exact:false}).waitFor();
const quota = await page.evaluate(async () => {
 const {db}=await import('/src/lib/storage.ts'); const user=db.getCurrentUser(),pkg=db.getPackages(user.organizacaoId,user.id).find(p=>p.id==='qa_persistence');
 const set=Storage.prototype.setItem; Storage.prototype.setItem=function(key,value){if(key==='agd_packages')throw new DOMException('Quota','QuotaExceededError');return set.call(this,key,value);};
 try {await db.updatePackageAsync({...pkg,totalAulas:99},user.id);return false;}catch{return true;}finally{Storage.prototype.setItem=set;}
}); assert.equal(quota,true);
await page.evaluate(async () => {const {db}=await import('/src/lib/storage.ts');db.setCurrentUser(db.getUserById('usr_aluno_pedro'));});
await page.reload();await page.waitForTimeout(500);
assert.equal(await page.getByText('Perfil de Aluno não localizado para este usuário.',{exact:true}).count(),0);
await page.screenshot({path:new URL('student-portal.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
await page.evaluate(async () => {const {db}=await import('/src/lib/storage.ts');const u=db.getCurrentUser();db.setCurrentUser({...u,id:'qa_missing_student',email:'missing@example.invalid'});});
await page.reload();await page.waitForTimeout(500);
assert.equal(await page.getByText('Perfil de Aluno não localizado para este usuário.',{exact:true}).count(),1);
await page.evaluate(async () => {const {db}=await import('/src/lib/storage.ts');db.setCurrentUser(null);});
await page.reload();await page.waitForTimeout(500);
await page.getByRole('button',{name:'Esqueceu a senha?',exact:true}).click();
await page.screenshot({path:new URL('password-recovery.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
for (const label of ['Novo Instrutor','Portal do Aluno','Localizar Instrutor Próximo (Mapa 5 km a 40 km)']) {
 await page.reload(); await page.waitForTimeout(300); await page.getByRole('button',{name:label,exact:true}).click(); await page.waitForTimeout(150);
 assert.equal(await page.getByText('Algo deu errado',{exact:false}).count(),0,label);
}
await page.reload(); await page.waitForTimeout(300);
await page.evaluate(async()=>{const {db}=await import('/src/lib/storage.ts');const user=db.getUserById('usr_instrutor_carlos');await db.saveUserAsync({...user,twoFactorAtivo:true,senhaTemporaria:'qa-local-password'});});
await page.getByPlaceholder('seuemail@autoescola.com.br').fill('instrutor@autoescola.com');
await page.locator('input[type=password]').fill('qa-local-password');
await page.getByRole('button',{name:'Entrar no Gestão AD',exact:true}).click();
await page.locator('input[inputmode=numeric]').first().waitFor();
assert.equal(await page.locator('input[inputmode=numeric]').count(),6);
await page.screenshot({path:new URL('two-factor.png',output).pathname.replace(/^\/([A-Za-z]:)/,'$1')});


const preservedSeed = await page.evaluate(async()=>{
 const {seedCleanProductionData}=await import('/src/lib/storage.ts');
 const packages=JSON.parse(localStorage.getItem('agd_packages')||'[]');
 packages.push({...packages[0],id:'pkg_cnh_b_20',nome:'Plano padrão editado pelo instrutor',atualizadoEm:new Date().toISOString(),instrutorId:'usr_instrutor_carlos'});
 localStorage.setItem('agd_packages',JSON.stringify(packages));seedCleanProductionData();
 return JSON.parse(localStorage.getItem('agd_packages')).some(p=>p.id==='pkg_cnh_b_20' && p.nome==='Plano padrão editado pelo instrutor');
});assert.equal(preservedSeed,true);
await fs.writeFile(new URL('review-results.json',output),JSON.stringify({screens,adminButtons,saas,quota,result:{history:result.history,status:result.status},errors,writes},null,2));
assert.deepEqual(errors,[]);
console.log(JSON.stringify({screens,adminButtons,history:result.history,errors,writes}));
if (process.env.REVIEW_VISIBLE === '1') {
 await page.evaluate(async () => { const {db,syncFromSupabase}=await import('/src/lib/storage.ts'); db.setCurrentUser(db.getUserById('usr_instrutor_carlos')); await syncFromSupabase(); });
 await page.reload(); await page.waitForTimeout(700);
 await page.evaluate(() => { const badge=document.createElement('div'); badge.textContent='PRÉVIA LOCAL · DADOS FICTÍCIOS'; Object.assign(badge.style,{position:'fixed',bottom:'12px',right:'16px',zIndex:'99999',background:'#0f172a',color:'#fff',padding:'10px 16px',borderRadius:'12px',fontSize:'12px',boxShadow:'0 4px 18px #0f172a33'}); document.body.append(badge); });
 console.log('PRÉVIA VISÍVEL ABERTA — banco de produção isolado');
 await new Promise(() => {});
} else await browser.close();
