import {chromium} from 'playwright';
import {isolateServices} from './ui/mock-backend.mjs';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:false,args:['--start-maximized']});
const context=await browser.newContext({viewport:null});await isolateServices(context);const page=await context.newPage();const now=new Date();now.setHours(9,0,0,0);await page.clock.setFixedTime(now);
await page.goto('http://localhost:3000/tests/ui/harness.html?scene=StudentPortal');await page.waitForFunction(()=>window.__UI_AUDIT_READY__);await page.getByRole('region',{name:'Contrato pendente de aceite'}).waitFor();
await page.evaluate(()=>document.title='Aviso de contrato — prévia com dados fictícios');console.log('Prévia do lembrete aberta no Chrome.');await new Promise(()=>{});
