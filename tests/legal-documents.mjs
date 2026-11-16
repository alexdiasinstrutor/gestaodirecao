import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { isolateServices } from './ui/mock-backend.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',ignoreDefaultArgs:['--hide-scrollbars']});
const results=[];
try {
 for(const viewport of [{width:1440,height:900},{width:390,height:844},{width:320,height:568},{width:844,height:390}]) {
  const context=await browser.newContext({viewport,acceptDownloads:true});await isolateServices(context);
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:3000/tests/ui/harness.html?scene=Header');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
  await page.getByRole('button',{name:'Termos, privacidade e contratos',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Documentos jurídicos'});
  for(const code of ['TERMOS_DE_USO','POLITICA_PRIVACIDADE_LGPD','CONTRATO_AULA_PRATICA']) {
   await page.getByLabel('Documento jurídico',{exact:true}).selectOption(code);
   const content=await page.getByLabel('Conteúdo do documento jurídico').innerText();assert.ok(content.length>2000);assert.ok(!content.includes('{{'));if(code==='TERMOS_DE_USO'){assert.ok(content.includes('Stark Light Save'));assert.ok(content.includes('23.659.019/0001-40'));assert.ok(content.includes('Betim/MG'));}if(code==='POLITICA_PRIVACIDADE_LGPD')assert.ok(content.includes('cassiodiniz@uol.com.br'));
   const geometry=await dialog.evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('footer').getBoundingClientRect();return {top:r.top,bottom:r.bottom,footer:f.bottom,height:innerHeight,width:document.documentElement.scrollWidth,viewport:innerWidth};});
   assert.ok(geometry.top>=0&&geometry.bottom<=geometry.height+1&&geometry.footer<=geometry.height+1);assert.ok(geometry.width<=geometry.viewport);
   const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar minuta',exact:true}).click();const download=await downloadPromise;const snapshot=JSON.parse(await fs.readFile(await download.path(),'utf8'));
   assert.equal(snapshot.status,'MINUTA_SEM_ACEITE');assert.equal(snapshot.sha256,createHash('sha256').update(snapshot.conteudo).digest('hex'));
   results.push({viewport,code,status:'PASS'});
  }
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.deepEqual(errors,[]);await context.close();
 }
 console.log(JSON.stringify({passed:results.length,results}));
} finally {await browser.close();}
