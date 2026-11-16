import jsPDF from 'jspdf';

export function legalDocumentPdf(content:string,version:string,registered:boolean):Blob {
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 const margin=22,width=166,bottom=275;let y=25;
 const nextPage=()=>{pdf.addPage();y=25;};
 for(const raw of content.replace(/\r\n/g,'\n').split('\n')) {
  const trimmed=raw.trim();if(!trimmed){y+=3;continue;}
  if(/^---+$/.test(trimmed)){if(y>bottom-8)nextPage();pdf.setDrawColor(210,218,225);pdf.line(margin,y,188,y);y+=7;continue;}
  const title=/^#\s/.test(trimmed),heading=/^#{2,6}\s/.test(trimmed);
  const text=trimmed.replace(/^#{1,6}\s+/,'').replace(/\*\*/g,'').replace(/\*([^*]+)\*/g,'$1').replace(/^\*\s+/,'• ');
  pdf.setFont('times',title||heading?'bold':'normal');pdf.setFontSize(title?15:heading?11:11);
  const lines=pdf.splitTextToSize(text,width) as string[];const lineHeight=title?7:5.6;
  if((title||heading)&&y+Math.min(lines.length+2,8)*lineHeight>bottom)nextPage();
  if(heading)y+=4;
  for(const line of lines){if(y+lineHeight>bottom)nextPage();pdf.text(line,title?105:margin,y,{align:title?'center':'left'});y+=lineHeight;}
  y+=title?7:3;
 }
 const pages=pdf.getNumberOfPages();
 for(let page=1;page<=pages;page++) {pdf.setPage(page);pdf.setFont('helvetica','normal');pdf.setFontSize(8);pdf.setTextColor(80,95,110);pdf.text(registered?'Versão registrada — consulte os comprovantes de aceite na plataforma':'Minuta para conferência — sem comprovação de aceite',margin,286);pdf.text('v'+version+' · '+page+'/'+pages,188,286,{align:'right'});}
 pdf.setProperties({title:'Documento jurídico — Gestão AD',subject:registered?'Versão registrada':'Minuta para conferência'});
 return pdf.output('blob');
}
export function downloadLegalFile(blob:Blob,filename:string) {
 const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.style.display='none';document.body.appendChild(anchor);
 try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
