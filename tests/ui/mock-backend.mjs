export async function isolateServices(context) {
 const database=new Map();const requests=[];
 await context.addInitScript(()=>{
  window.__UI_AUDIT_AUTHORIZED__=true;window.__UI_AUDIT_EVENTS__=[];
  window.open=(url)=>{window.__UI_AUDIT_EVENTS__.push({name:'window.open',payload:[url]});return null;};
  window.print=()=>window.__UI_AUDIT_EVENTS__.push({name:'window.print'});
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.__UI_AUDIT_CLIPBOARD__=text;}}});
 });
 await context.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
  requests.push({method:req.method(),host:url.hostname,path:url.pathname});
  const table=url.pathname.split('/rest/v1/')[1];
  if(!url.hostname.endsWith('.supabase.co')||!table)return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(url.hostname.includes('ibge.gov.br')?(url.pathname.endsWith('/estados')?[{id:31,sigla:'MG',nome:'Minas Gerais'}]:[{id:3106200,nome:'Belo Horizonte'}]):url.hostname.includes('viacep')?{cep:'30140-071',logradouro:'Avenida de Teste',bairro:'Centro',localidade:'Belo Horizonte',uf:'MG'}:{})});
  let rows=database.get(table)||[];
  if(req.method()==='GET'||req.method()==='HEAD') {for(const [field,value] of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[field])===value.slice(3));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rows)});}
  if(['POST','PATCH'].includes(req.method())) {const body=req.postDataJSON();for(const row of Array.isArray(body)?body:[body]){const index=rows.findIndex(r=>r.id===row.id);if(index<0)rows.push(row);else rows[index]={...rows[index],...row};}database.set(table,rows);}
  if(req.method()==='DELETE'){for(const [field,value] of url.searchParams)if(value.startsWith('eq.'))rows=rows.filter(row=>String(row[field])!==value.slice(3));database.set(table,rows);}
  return route.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 return {requests,database};
}
