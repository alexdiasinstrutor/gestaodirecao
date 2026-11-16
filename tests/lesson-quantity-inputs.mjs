import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {isolateServices} from './ui/mock-backend.mjs';

const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let passed=0;
try {
  for (const viewport of [{width:1440,height:900},{width:390,height:844}]) {
    const context=await browser.newContext({viewport});
    await isolateServices(context);
    const page=await context.newPage();
    page.setDefaultTimeout(8000);
    const time=new Date();time.setHours(9,0,0,0);await page.clock.setFixedTime(time);

    await page.goto('http://localhost:3000/tests/ui/harness.html?scene=StudentsView');
    await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
    await page.getByText('Ver Ficha',{exact:true}).first().click();
    const total=page.getByLabel('Total Aulas:',{exact:true});
    await total.fill('');assert.equal(await total.inputValue(),'');
    await total.fill('10');assert.equal(await total.inputValue(),'10');

    await page.getByRole('button',{name:/Aulas Avulsas/}).first().click();
    const avulsas=page.getByLabel('Quantidade de Aulas Avulsas:',{exact:true});
    await avulsas.fill('');assert.equal(await avulsas.inputValue(),'');
    await avulsas.fill('3');assert.equal(await avulsas.inputValue(),'3');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();

    await page.getByRole('button',{name:/Personalizado/}).first().click();
    const extras=page.getByLabel('Total de Aulas Extras:',{exact:true});
    await extras.fill('');assert.equal(await extras.inputValue(),'');
    await extras.fill('7');assert.equal(await extras.inputValue(),'7');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();

    await page.goto('http://localhost:3000/tests/ui/harness.html?scene=PackagesManager');
    await page.waitForFunction(()=>window.__UI_AUDIT_READY__);
    await page.getByRole('button',{name:/Cadastrar Novo Pacote/}).click();
    const packageLessons=page.getByLabel('Quantidade de Aulas *',{exact:true});
    await packageLessons.fill('');assert.equal(await packageLessons.inputValue(),'');
    await page.getByLabel('Nome do Pacote *',{exact:true}).fill('Pacote de teste');
    assert.equal(await packageLessons.inputValue(),'');
    await packageLessons.fill('12');assert.equal(await packageLessons.inputValue(),'12');

    passed++;
    await context.close();
  }
  console.log(JSON.stringify({passed,failed:0,fields:['ficha','aulas-avulsas','pacote-personalizado','cadastro-pacote']}));
} finally {
  await browser.close();
}
