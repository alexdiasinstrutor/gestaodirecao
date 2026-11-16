import type {AccountReceivable,PackageOffer,Student,StudentPackageContract} from '../types';
export interface ResolvedStudentPackages {contracts:StudentPackageContract[];legacy:boolean;issue?:string;}
export function resolveStudentPackages(student:Student,offers:PackageOffer[],accounts:AccountReceivable[]):ResolvedStudentPackages {
 let stored:unknown=student.contratosPacotes;
 if(typeof stored==='string'){try{stored=JSON.parse(stored);}catch{stored=[];}}
 if(Array.isArray(stored)&&stored.length)return {contracts:stored,legacy:false};
 if(!student.pacoteId)return {contracts:[],legacy:false,issue:'A matrícula não possui pacote vinculado. Solicite a atualização ao instrutor.'};
 const offer=offers.find(item=>item.id===student.pacoteId&&item.organizacaoId===student.organizacaoId&&(!item.instrutorId||item.instrutorId===student.instrutorId));
 const invoices=accounts.filter(item=>item.alunoId===student.id&&item.organizacaoId===student.organizacaoId&&item.pacoteId===student.pacoteId&&item.status!=='CANCELADO');
 if(!offer)return {contracts:[],legacy:true,issue:'O pacote vinculado não foi localizado no cadastro do instrutor.'};
 if(invoices.length!==1)return {contracts:[],legacy:true,issue:'O instrutor precisa conferir o valor contratado no histórico financeiro desta matrícula.'};
 const invoice=invoices[0];
 return {legacy:true,contracts:[{id:'cnt_legacy_'+student.id+'_'+offer.id,alunoId:student.id,organizacaoId:student.organizacaoId,tipo:'PACOTE_BASE',pacoteId:offer.id,nome:student.pacoteNome||offer.nome,categoriaCnh:student.categoriaCnh,quantidadeAulas:student.totalAulasContratadas,valorCentavos:invoice.valorTotalCentavos,valorAulasCentavos:invoice.valorTotalCentavos,valorLocacaoExameCentavos:0,locacaoExameContratada:false,dataContratacao:student.dataCadastro,formaPagamento:offer.formaPagamento,contaReceberId:invoice.id,...offer.condicoesContratuais}]};
}
