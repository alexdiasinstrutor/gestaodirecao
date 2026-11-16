import { writeReport } from './ui/report.mjs';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenes, primitives } from './ui/scenes.mjs';
import { isolateServices } from './ui/mock-backend.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output=process.env.AUDIT_OUTPUT_DIR?path.resolve(process.env.AUDIT_OUTPUT_DIR):path.join(root,'review-artifacts','ui-audit');await fs.mkdir(output,{recursive:true});
const base=process.env.AUDIT_BASE_URL||'http://localhost:3000';
const viewports=[{id:'desktop',width:1440,height:900},{id:'notebook',width:1280,height:600},{id:'tablet',width:1024,height:768},{id:'mobile',width:390,height:844},{id:'mobile-small',width:320,height:568},{id:'landscape',width:844,height:390},{id:'zoom-equivalent',width:720,height:450}].filter(v=>!process.env.AUDIT_VIEWPORTS||process.env.AUDIT_VIEWPORTS.split(',').includes(v.id));
const selected=scenes.filter(s=>!process.env.AUDIT_SCENES||process.env.AUDIT_SCENES.split(',').some(filter=>s.id===filter||filter.endsWith('*')&&s.id.startsWith(filter.slice(0,-1))));
const browser=await chromium.launch({executablePath:process.env.AUDIT_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
const previousReport=process.env.AUDIT_PREVIOUS_REPORT?JSON.parse(await fs.readFile(process.env.AUDIT_PREVIOUS_REPORT,'utf8')):null;
const pairKey=row=>row.scene+'@'+row.viewport;
if(previousReport?.partial)throw new Error('A revalidação exige um relatório completo.');
const recheckComponents=(process.env.AUDIT_RECHECK_COMPONENTS||'').split(',').filter(Boolean);
const rerunPairs=previousReport?new Set(previousReport.results.filter(row=>row.status==='FAIL'||row.warnings.some(w=>w.kind==='unassociated-label')).map(pairKey)):null;
if(rerunPairs){const known=new Set(previousReport.results.map(pairKey));for(const scene of selected)for(const viewport of viewports){const key=scene.id+'@'+viewport.id;if(!known.has(key)||recheckComponents.includes(scene.component)||scene.id==='App:area-0'||scene.id==='App:area-7'||scene.id==='App:convite')rerunPairs.add(key);}}
const results=previousReport?previousReport.results.filter(row=>!rerunPairs.has(pairKey(row))):[];
const runTotal=rerunPairs?rerunPairs.size:viewports.length*selected.length;let seen=0;let saveProgress=Promise.resolve();
async function writeArtifact(filename,content) {
 for(let attempt=0;attempt<7;attempt++) {
  const temporary=filename+'.'+process.pid+'.tmp';
  try {await fs.writeFile(temporary,content);await fs.rename(temporary,filename);return;}
  catch(error){if(attempt===6)throw error;await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));}
 }
}
async function auditPage(page) {
 return page.evaluate(async()=>{
  const visible=el=>!el.closest('[aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden' && getComputedStyle(el).display!=='none';
  const overlays=[...document.querySelectorAll('.fixed.inset-0')].filter(visible);
  const scope=[...document.querySelectorAll('[data-ui-popover]')].find(visible)||overlays.at(-1)||document.getElementById('audit-root');
  const elements=[...scope.querySelectorAll('button,input:not([type=hidden]),textarea,select,a[href]')].filter(visible);
  const issues=[],warnings=[],controls=[],scrollers=[];
  const label=el=>(el.getAttribute('aria-label')||el.getAttribute('title')||el.labels?.[0]?.textContent||(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)?(el.parentElement?.querySelector('label')||el.parentElement?.parentElement?.querySelector('label'))?.textContent:'')||el.textContent||el.getAttribute('placeholder')||el.getAttribute('name')||el.tagName).trim().replace(/\s+/g,' ').slice(0,140);
  const initialLayout={viewport:{width:innerWidth,height:innerHeight},overlays:[],footers:[]};
  for(const overlay of overlays) {
   const panel=[...overlay.children].find(visible);if(!panel)continue;
   const r=panel.getBoundingClientRect(),style=getComputedStyle(overlay);
   const outside=r.top<-1||r.bottom>innerHeight+1||r.left<-1||r.right>innerWidth+1;
   const userScrollable=/auto|scroll/.test(style.overflowY)&&overlay.scrollHeight>overlay.clientHeight;
   initialLayout.overlays.push({top:r.top,bottom:r.bottom,left:r.left,right:r.right,userScrollable});
   if(outside&&!userScrollable)issues.push({kind:'modal-outside-viewport',detail:Math.round(r.top)+'..'+Math.round(r.bottom)+' / janela '+innerHeight});
  }
  for(const footer of scope.querySelectorAll('footer')) {if(!visible(footer))continue;const r=footer.getBoundingClientRect();initialLayout.footers.push({top:r.top,bottom:r.bottom,initiallyVisible:r.top>=0&&r.bottom<=innerHeight});}
  const rootOverflow=document.documentElement.scrollWidth>innerWidth+2;
  if(rootOverflow)issues.push({kind:'page-overflow-x',detail:document.documentElement.scrollWidth+' > '+innerWidth,offenders:[...scope.querySelectorAll('*')].filter(el=>visible(el)&&el.getBoundingClientRect().right>innerWidth+4&&!el.closest('svg')).slice(0,10).map(el=>({tag:el.tagName,className:String(el.className).slice(0,150),text:label(el)}))});
  for(const el of elements) {
   const hiddenParents=[];let ancestor=el.parentElement;
   while(ancestor&&ancestor!==document.documentElement){const css=getComputedStyle(ancestor);if(css.overflowY==='hidden'||css.overflowX==='hidden')hiddenParents.push({el:ancestor,x:ancestor.scrollLeft,y:ancestor.scrollTop,css});ancestor=ancestor.parentElement;}
   el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
   for(const previous of hiddenParents){if(previous.css.overflowY==='hidden'&&Math.abs(previous.y-previous.el.scrollTop)>2||previous.css.overflowX==='hidden'&&Math.abs(previous.x-previous.el.scrollLeft)>2)issues.push({kind:'control-needs-hidden-scroll',label:label(el),detail:previous.el.tagName+'.'+String(previous.el.className).slice(0,100)});}
   if(el.tagName==='BUTTON'&&(el.scrollWidth>el.clientWidth+3||el.scrollHeight>el.clientHeight+3))issues.push({kind:'button-content-clipped',label:label(el),detail:el.scrollWidth+'x'+el.scrollHeight+' / '+el.clientWidth+'x'+el.clientHeight});
   const box=el.getBoundingClientRect(),size={width:Math.round(box.width),height:Math.round(box.height)};
   let left=Math.max(0,box.left),right=Math.min(innerWidth,box.right),top=Math.max(0,box.top),bottom=Math.min(innerHeight,box.bottom);
   let fixed=el;while(fixed&&getComputedStyle(fixed).position!=='fixed')fixed=fixed.parentElement;
   let containing=fixed?.parentElement;while(containing){const style=getComputedStyle(containing);if(style.transform!=='none'||style.filter!=='none'||style.perspective!=='none'){fixed=null;break;}containing=containing.parentElement;}
   let parent=fixed===el?null:el.parentElement;let clippedBy='';
   while(parent&&parent!==document.documentElement){const css=getComputedStyle(parent),r=parent.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(css.overflowX)){if(r.left>left||r.right<right)clippedBy=parent.tagName+'.'+String(parent.className).slice(0,100);left=Math.max(left,r.left);right=Math.min(right,r.right);}if(/auto|scroll|hidden|clip/.test(css.overflowY)){if(r.top>top||r.bottom<bottom)clippedBy=parent.tagName+'.'+String(parent.className).slice(0,100);top=Math.max(top,r.top);bottom=Math.min(bottom,r.bottom);}if(parent===fixed)break;parent=parent.parentElement;}
   const ratio=Math.max(0,right-left)*Math.max(0,bottom-top)/Math.max(1,box.width*box.height);
   const x=(left+right)/2,y=(top+bottom)/2;let target=ratio>0?document.elementFromPoint(x,y):null;
   let hit=!!target&&(el===target||el.contains(target)||target.contains(el));
   if(!hit&&ratio>=0.96){await new Promise(resolve=>requestAnimationFrame(resolve));target=document.elementFromPoint(x,y);hit=!!target&&(el===target||el.contains(target)||target.contains(el));}
   const control={tag:el.tagName,type:el.getAttribute('type'),label:label(el),...size,disabled:!!el.disabled,readOnly:!!el.readOnly,reachable:ratio>=0.96,hitTarget:hit,value:el.type==='password'?'[oculto]':String(el.value??'').slice(0,180)};
   controls.push(control);el.dataset.uiAudit=String(controls.length-1);
   if(!control.reachable)issues.push({kind:'control-clipped',label:control.label,ratio:Number(ratio.toFixed(2)),clippedBy});
   else if(!hit&&!control.disabled)issues.push({kind:'control-covered',label:control.label,coveredBy:target?{tag:target.tagName,classes:String(target.className),text:label(target)}:null});
   if(el.tagName==='BUTTON'&&box.height<32)warnings.push({kind:'small-touch-target',label:control.label,height:size.height});
   if(['INPUT','TEXTAREA','SELECT'].includes(el.tagName)&&!el.labels?.length&&!el.getAttribute('aria-label')&&!el.getAttribute('aria-labelledby'))warnings.push({kind:'unassociated-label',label:control.label});
  }
  for(const el of [scope,...scope.querySelectorAll('*')]) {
   if(!visible(el)||el.clientHeight<2)continue;const css=getComputedStyle(el);
   if(el.scrollHeight>el.clientHeight+3&&/auto|scroll/.test(css.overflowY)){
    const before=el.scrollTop;el.scrollTop=el.scrollHeight;const reached=el.scrollTop>0;el.scrollTop=before;
    scrollers.push({tag:el.tagName,clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,canScroll:reached,scrollbarWidth:css.scrollbarWidth});
    if(!reached)issues.push({kind:'scroll-stuck',detail:el.tagName});
    if(css.scrollbarWidth==='none')issues.push({kind:'vertical-scrollbar-hidden',detail:el.tagName});
   }
   if(['P','LABEL','H1','H2','H3','H4','PRE'].includes(el.tagName)&&el.scrollWidth>el.clientWidth+3&&el.clientWidth>0&&!/auto|scroll/.test(css.overflowX)) {
    let ancestor=el.parentElement,allowed=false;while(ancestor&&ancestor!==scope){if((ancestor.classList.contains('overflow-x-auto')||ancestor.classList.contains('responsive-table-wrap')||ancestor.tagName==='NAV')&&ancestor.scrollWidth>ancestor.clientWidth+3){allowed=true;break;}ancestor=ancestor.parentElement;}
    if(!allowed) { const item={kind:'text-overflow',label:label(el),width:el.clientWidth,scrollWidth:el.scrollWidth}; if(css.textOverflow==='ellipsis')warnings.push({...item,kind:'intentional-ellipsis'});else issues.push(item); }
   }
  }
  const fields=controls.filter(c=>['INPUT','TEXTAREA','SELECT'].includes(c.tag));
  return {initialLayout,issues,warnings,controls,fields:fields.length,buttons:controls.filter(c=>c.tag==='BUTTON').length,scrollers,text:scope.innerText.slice(0,500),renderError:window.__UI_AUDIT_RENDER_ERROR__||null};
 });
}
async function verifyLayoutDetector() {
 const page=await browser.newPage({viewport:{width:800,height:600}});
 await page.setContent('<div id="audit-root"><div class="fixed inset-0" style="position:fixed;inset:0;overflow:hidden"><div style="height:1200px;background:white"><button style="margin-top:1100px">Enviar fora da janela</button></div></div></div>');
 const broken=await auditPage(page);
 if(!broken.issues.some(i=>i.kind==='modal-outside-viewport')||!broken.issues.some(i=>i.kind==='control-needs-hidden-scroll'))throw new Error('Detector não identificou o modal propositalmente cortado.');
 await page.setContent('<div id="audit-root"><div class="fixed inset-0" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center"><div style="height:560px;width:500px;display:grid;grid-template-rows:1fr auto"><main style="overflow:auto"><p style="height:1000px">Conteúdo longo</p><button>Última ação rolável</button></main><footer><button>Enviar sempre visível</button></footer></div></div></div>');
 const valid=await auditPage(page);if(valid.issues.length)throw new Error('Detector rejeitou layout rolável válido: '+JSON.stringify(valid.issues));
 await page.close();console.log('Autoteste do detector: corte proposital detectado; modal rolável válido aprovado.');
}
await verifyLayoutDetector();
async function exerciseFields(page,controls,warnings) {
 const checks=[];
 for(let index=0;index<controls.length;index++) {
  const control=controls[index];if(!['INPUT','TEXTAREA','SELECT'].includes(control.tag)||control.disabled||control.readOnly)continue;
  const field=page.locator('[data-ui-audit="'+index+'"]');if(!await field.count()) {checks.push({label:control.label,status:'STATE_CHANGED'});continue;}
  const type=control.type||'text';
  if(['file','hidden','range','color','checkbox','radio'].includes(type)){checks.push({label:control.label,status:'STRUCTURE_ONLY',type});continue;}
  try {
   if(control.tag==='SELECT') {const options=await field.locator('option').evaluateAll(nodes=>nodes.filter(n=>!n.disabled&&n.value).map(n=>n.value));if(!options.length){checks.push({label:control.label,status:'EMPTY_OPTIONS'});continue;}await field.selectOption(options[0]);if(control.value)await field.selectOption(control.value);checks.push({label:control.label,status:'PASS',type:'select'});continue;}
   const description=(control.label+' '+await field.getAttribute('placeholder')).toLowerCase();
   let value=type==='number'?'42':type==='date'?'2030-12-20':type==='time'?'14:30':type==='email'?'qa@example.invalid':type==='password'?'TesteLocal123!':/cpf|000[.]000/.test(description)?'52998224725':/cep|00000-000/.test(description)?'30140071':type==='tel'||/telefone|whatsapp|98765|98888/.test(description)?'11987654321':'Teste de interface';
   const originalValue=await field.inputValue();await field.fill(value);const changed=await field.inputValue();
   if(!changed)throw new Error('Campo não aceitou entrada.');
   await field.fill(originalValue);checks.push({label:control.label,status:'PASS',type,accepted:type==='password'?'[teste]':changed.slice(0,60)});
  } catch(error){checks.push({label:control.label,status:'REVIEW',type,detail:error.message.split('Call log:')[0].slice(0,200)});warnings.push({kind:'field-interaction-review',label:control.label,detail:checks.at(-1).detail});}
 }
 return checks;
}
async function exerciseInvite(page,output,viewport) {
 const checks=[];const ensure=(condition,name)=>{if(!condition)throw new Error('Convite: '+name);checks.push(name);};
 const dialog=page.getByRole('dialog',{name:'Link de Convite do Aluno',exact:true});
 const region=page.getByRole('region',{name:'Dados e mensagem do convite',exact:true});
 const link=page.getByLabel('Link Exclusivo com Vínculo do Instrutor',{exact:true});
 const original=await link.inputValue();
 await page.getByLabel('Nome do Aluno (Opcional)',{exact:true}).fill('Aluna de Revisão com Nome Completo');
 ensure(new URL(await link.inputValue()).searchParams.get('convite')===new URL(original).searchParams.get('convite'),'token permanece estável ao editar os dados');
 await page.getByRole('button',{name:'Copiar',exact:true}).click();ensure(await page.evaluate(()=>window.__UI_AUDIT_CLIPBOARD__)===await link.inputValue(),'Copiar copia o link completo');
 await page.getByRole('button',{name:'Copiar Texto',exact:true}).click();ensure(await page.evaluate(()=>window.__UI_AUDIT_CLIPBOARD__)===await page.getByTestId('invite-message').innerText(),'Copiar Texto copia a mensagem completa');
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();ensure(await page.getByRole('alert').count()>0,'WhatsApp vazio apresenta validação');
 await page.getByLabel('Telefone WhatsApp do Aluno', {exact:false}).fill('11987654321');
 await page.getByRole('button',{name:'WhatsApp',exact:true}).click();const opened=await page.evaluate(()=>window.__UI_AUDIT_EVENTS__.filter(e=>e.name==='window.open').at(-1)?.payload[0]);
 ensure(!!opened&&new URL(opened).hostname==='api.whatsapp.com'&&new URL(opened).searchParams.get('phone')==='5511987654321','WhatsApp gera destino válido sem enviar mensagem');
 const message=page.getByTestId('invite-message');
 const messageScroll=await message.evaluate(el=>{el.scrollTop=el.scrollHeight;return {canScroll:el.scrollTop>0,max:getComputedStyle(el).maxHeight,overflow:getComputedStyle(el).overflowY,height:el.clientHeight};});
 ensure(messageScroll.canScroll&&messageScroll.overflow==='scroll'&&messageScroll.height<=220,'mensagem tem altura limitada e rolagem própria');
 if(await page.evaluate(()=>innerWidth>=640)) {
  const phone=await page.getByLabel('Telefone WhatsApp do Aluno',{exact:false}).boundingBox();const email=await page.getByLabel('E-mail do Aluno',{exact:false}).boundingBox();
  ensure(Math.abs(phone.y-email.y)<=1&&Math.abs(phone.height-email.height)<=1,'telefone e e-mail alinhados com a mesma altura');
 }
 const styles=await region.evaluate(el=>({scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,overflowY:getComputedStyle(el).overflowY,scrollbar:getComputedStyle(el,'::-webkit-scrollbar').width}));
 ensure(styles.overflowY==='scroll'&&parseInt(styles.scrollbar)>=10,'barra vertical explícita e larga');
 await region.evaluate(el=>el.scrollTop=0);await region.hover();await page.mouse.wheel(0,500);await page.waitForTimeout(160);
 ensure(styles.scrollHeight<=styles.clientHeight||await region.evaluate(el=>el.scrollTop)>0,'roda do mouse desloca o conteúdo');
 await region.focus();await page.keyboard.press('End');await page.waitForTimeout(160);ensure(styles.scrollHeight<=styles.clientHeight||await region.evaluate(el=>el.scrollTop)>0,'teclado alcança o final da área rolável');
 await page.screenshot({path:path.join(output,'convite-'+viewport+'-fim.png')});await region.evaluate(el=>el.scrollTop=0);await page.screenshot({path:path.join(output,'convite-'+viewport+'-inicio.png')});
 const footer=await dialog.locator('footer').boundingBox();ensure(footer.y>=0&&footer.y+footer.height<=await page.evaluate(()=>innerHeight),'ações inferiores sempre visíveis');
 await dialog.getByRole('button',{name:'Fechar convite',exact:true}).focus();await page.keyboard.press('Shift+Tab');ensure(await page.evaluate(()=>!!document.activeElement?.closest('[role="dialog"]')),'foco permanece no diálogo');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});ensure(await dialog.count()===0,'Escape fecha o convite');
 return checks;
}
async function runViewport(viewport) {
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height}});const services=await isolateServices(context);
  for(const scene of selected) {
   if(rerunPairs&&!rerunPairs.has(scene.id+'@'+viewport.id))continue;
   services.database.clear();
   const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.dismiss());
   const result={scene:scene.id,source:scene.source,viewport:viewport.id,width:viewport.width,height:viewport.height,errors,issues:[],warnings:[]};
   try {
    if(scene.component==='ScheduleView'){const time=new Date();time.setHours(9,0,0,0);await page.clock.setFixedTime(time);result.fixtureTime=time.toISOString();}
    await page.goto(base+'/tests/ui/harness.html?scene='+encodeURIComponent(scene.id),{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__UI_AUDIT_READY__===true);await page.waitForTimeout(100);
    for(const step of scene.steps||[]) {
     const name=step.regex?new RegExp(step.name,'i'):step.name;
     let locator=step.role?page.getByRole(step.role,{name,exact:!step.regex}):step.title?page.getByTitle(step.title,{exact:true}):step.text?page.getByText(step.text,{exact:true}):page.locator(step.css);
     if(step.hasText)locator=locator.filter({hasText:step.hasText});
     await locator.filter({visible:true}).first().click();await page.waitForTimeout(70);
    }
    for (const details of await page.locator('details[data-map-points]').all()) { if(!await details.evaluate(el=>el.open))await details.locator('summary').click(); }
    if(scene.component==='StudentPortal')await page.waitForTimeout(650);
    if(scene.component==='StudentInviteModal'||scene.id==='App:convite') {
     const initial=await page.getByRole('dialog',{name:'Link de Convite do Aluno'}).evaluate(el=>{const r=el.getBoundingClientRect(),f=el.querySelector('footer').getBoundingClientRect();return {top:r.top,bottom:r.bottom,footerBottom:f.bottom,height:innerHeight};});
     if(initial.top<0||initial.bottom>initial.height+1||initial.footerBottom>initial.height+1)result.issues.push({kind:'invite-initial-footer-outside-viewport',detail:initial});
    }
    const general=await auditPage(page);general.issues.unshift(...result.issues);Object.assign(result,general);
    if(result.renderError)result.issues.push({kind:'render-error',detail:result.renderError});
    if(errors.length)result.issues.push(...errors.map(detail=>({kind:'runtime-error',detail})));
    if(viewport.id==='desktop') result.fieldChecks=await exerciseFields(page,result.controls,result.warnings);
    if(scene.component==='StudentInviteModal'||scene.id==='App:convite') result.inviteChecks=await exerciseInvite(page,output,viewport.id);
    const afterInteractions=await page.evaluate(()=>window.__UI_AUDIT_RENDER_ERROR__||null);
    if(afterInteractions&&!result.issues.some(i=>i.kind==='render-error'))result.issues.push({kind:'render-error',detail:afterInteractions});
    for(const detail of errors)if(!result.issues.some(i=>i.kind==='runtime-error'&&i.detail===detail))result.issues.push({kind:'runtime-error',detail});
    result.status=result.issues.length?'FAIL':'PASS';
    const filename=scene.id.replaceAll(':','-')+'-'+viewport.id+'.png';
    if(scene.component==='StudentInviteModal'||scene.id==='App:convite')result.screenshot='convite-'+viewport.id+'-inicio.png';
    else if(result.status==='FAIL'||viewport.id==='desktop') {await page.screenshot({path:path.join(output,filename)});result.screenshot=filename;}
   } catch(error) {result.status='FAIL';result.issues.push({kind:'scenario-error',detail:error.message.split('Call log:')[0].slice(0,600)});try{const filename=scene.id.replaceAll(':','-')+'-'+viewport.id+'-error.png';await page.screenshot({path:path.join(output,filename)});result.screenshot=filename;}catch{}}
   results.push(result);await page.close();seen++;
   if(seen%10===0||result.status==='FAIL')console.log(JSON.stringify({done:seen,total:runTotal,scene:scene.id,viewport:viewport.id,status:result.status,issues:result.issues.slice(0,3)}));
   if(seen%10===0) {saveProgress=saveProgress.catch(()=>{}).then(()=>writeArtifact(path.join(output,'results.json'),JSON.stringify({generatedAt:new Date().toISOString(),partial:true,results},null,2))).catch(error=>console.warn('Relatório parcial pendente: '+error.message));await saveProgress;}
  }
  await context.close();
}
try {
 const workers=Math.max(1,Math.min(2,Number(process.env.AUDIT_WORKERS)||2));
 for(let index=0;index<viewports.length;index+=workers)await Promise.all(viewports.slice(index,index+workers).map(runViewport));
} finally {await browser.close();}
const sources=(await fs.readdir(path.join(root,'src/components'),{recursive:true})).filter(p=>p.endsWith('.tsx')).map(p=>p.replaceAll('\\','/'));
const coverage=sources.map(source=>({source,scenes:scenes.filter(s=>s.source===source).map(s=>s.id),classification:primitives.includes(path.basename(source))?'primitive':'screen'}));
coverage.push({source:'../App.tsx',classification:'application',scenes:scenes.filter(s=>s.component==='App').map(s=>s.id)});
const summary={total:results.length,passed:results.filter(r=>r.status==='PASS').length,failed:results.filter(r=>r.status==='FAIL').length,fields:results.reduce((n,r)=>n+(r.fields||0),0),buttons:results.reduce((n,r)=>n+(r.buttons||0),0),warnings:results.reduce((n,r)=>n+r.warnings.length,0),unmapped:coverage.filter(c=>!c.scenes.length&&c.classification!=='primitive').map(c=>c.source)};
const report={revalidation:previousReport?{previousGeneratedAt:previousReport.generatedAt,executed:seen,reusedPassedCases:previousReport.results.filter(row=>!rerunPairs.has(pairKey(row))).length,reason:'Rechecagem de falhas e campos com rótulos após correção; casos aprovados sem alterações preservados.'}:null,generatedAt:new Date().toISOString(),partial:false,summary,coverage,results};await writeArtifact(path.join(output,'results.json'),JSON.stringify(report,null,2));
await writeReport(report,output);
console.log(JSON.stringify(summary));if(summary.failed||summary.unmapped.length)process.exitCode=1;
