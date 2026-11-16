import {downloadLegalFile,legalDocumentPdf} from '../../legal/documentExport';
import { resolveStudentPackages } from '../../legal/legacyPackages';
import { resolveStudentIdentity } from '../../legal/studentIdentity';
import { supabase } from '../../lib/supabaseClient';
import { supabaseAdapter } from '../../lib/supabaseAdapter';
import type { Student, User, PackageOffer } from '../../types';
import { LegalDocument } from './LegalDocument';
import { acceptLegalContract, loadLegalContracts, prepareLegalContract, LegalContractVersion } from '../../legal/contractStore';
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../../lib/storage';
import { legalDefaults, legalContractValues, legalDocuments, legalHash, renderLegalDocument } from '../../legal/documents';

export function LegalDocumentsAccess({buttonLabel='Termos, privacidade e contratos',initialDocument='TERMOS_DE_USO'}:{buttonLabel?:string;initialDocument?:string} = {}) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(initialDocument);
  const [values, setValues] = useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [packageId, setPackageId] = useState('');
  const [versions, setVersions] = useState<LegalContractVersion[]>([]);
  const [version, setVersion] = useState<LegalContractVersion | null>(null);
  const [general, setGeneral] = useState(false);
  const [clauses, setClauses] = useState(false);
  const [busy, setBusy] = useState(false);
  const operation = useRef({ key: '', id: '' });
  const resetAcceptance = () => {setVersion(null);setGeneral(false);setClauses(false);};
  const run = async (action: () => Promise<void>) => {setBusy(true);setNotice('');try {await action();}catch(error){setNotice(error instanceof Error ? error.message : String((error as {message?:string})?.message || 'Falha ao comunicar com o banco.'));}finally{setBusy(false);}};

  const dialog = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const rendered = useMemo(() => renderLegalDocument(code, values), [code, values]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]') || []);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previous?.focus(); };
  }, [open]);
  const [authRevision,setAuthRevision]=useState(0);
  useEffect(()=>{const {data}=supabase.auth.onAuthStateChange(()=>setAuthRevision(value=>value+1));return()=>data.subscription.unsubscribe();},[]);
  const currentUser = open ? db.getCurrentUser() : null;
  const students = currentUser && ['INSTRUTOR','ADMIN_ORG'].includes(currentUser.papel) ? db.getStudents(currentUser.organizacaoId, currentUser.id) : [];
  const [studentId, setStudentId] = useState('');
  const [source,setSource] = useState<{student:Student;users:User[];packages:PackageOffer[];legacy?:boolean} | null>(null);
  const selectedStudent = source?.student;
  const selectStudent = (id: string) => {
    const candidate=students.find(item=>item.id===id);
    if(!candidate || !currentUser)return;
    resetAcceptance();setPackageId('');setStudentId(id);setSource(null);setValues(legalDefaults(null));
    void run(async()=>{
      const [users,remoteStudents,packages,accounts]=await Promise.all([supabaseAdapter.getUsers(),supabaseAdapter.getStudents(candidate.organizacaoId),supabaseAdapter.getPackages(candidate.organizacaoId),supabaseAdapter.getAccountsReceivable(candidate.organizacaoId)]);
      let student=remoteStudents.find(item=>item.id===id && item.instrutorId===currentUser.id && item.organizacaoId===currentUser.organizacaoId);
      if(!student)throw new Error('O vínculo do aluno não foi confirmado no banco. Atualize o cadastro e tente novamente.');
      const resolved=resolveStudentPackages(student,packages,accounts);student={...student,contratosPacotes:resolved.contracts};if(resolved.issue)setNotice(resolved.issue);
      const relatedUsers=users.filter(user=>user.organizacaoId===student.organizacaoId);
      setSource({student,users:relatedUsers,packages,legacy:resolved.legacy});
      const instructor=relatedUsers.find(user=>user.id===student.instrutorId) || null;
      const matches=relatedUsers.filter(user=>user.papel==='ALUNO' && !!student.cpfFingerprint && user.cpfFingerprint===student.cpfFingerprint);
      setValues(legalDefaults(instructor,student,matches.length===1?matches[0]:undefined));
    });
  };
  useEffect(() => {
    if(!open || code!=='CONTRATO_AULA_PRATICA' || currentUser?.papel!=='ALUNO')return;
    let active=true;
    setBusy(true);setNotice('');setSource(null);setValues(legalDefaults(null));resetAcceptance();setPackageId('');
    const actor=currentUser;
    Promise.all([supabaseAdapter.getUsers(),supabaseAdapter.getStudents(actor.organizacaoId),supabaseAdapter.getPackages(actor.organizacaoId),supabaseAdapter.getAccountsReceivable(actor.organizacaoId)]).then(async ([users,remoteStudents,packages,accounts])=>{
      if(!active)return;
      const matchedStudent=resolveStudentIdentity(remoteStudents,actor);
      if(!matchedStudent)throw new Error('Não foi possível identificar uma matrícula única vinculada ao seu cadastro. Solicite a conferência do vínculo ao instrutor.');
      const resolved=resolveStudentPackages(matchedStudent,packages,accounts);
      const student={...matchedStudent,contratosPacotes:resolved.contracts};if(resolved.issue)setNotice(resolved.issue);
      const relatedUsers=users.filter(user=>user.organizacaoId===actor.organizacaoId);
      const instructor=relatedUsers.find(user=>user.id===student.instrutorId) || null;
      const account=relatedUsers.find(user=>user.id===actor.id);
      if(!account)throw new Error('Sua conta não foi confirmada no banco. Entre novamente e tente consultar o contrato.');
      setSource({student,users:relatedUsers,packages});setStudentId(student.id);
      const contracts=student.contratosPacotes || [];
      const contract=contracts.length===1?contracts[0]:undefined;
      if(contract){
        const offer=packages.find(item=>item.id===contract.pacoteId);
        const conditions={...offer?.condicoesContratuais,...Object.fromEntries(Object.entries(contract).filter(([,value])=>value!==undefined))};
        setPackageId(contract.id);setValues(legalContractValues(instructor,student,account,{...contract,...conditions}));
      }else setValues(legalDefaults(instructor,student,account));
      try {
        const published=(await loadLegalContracts()).filter(item=>item.student_id===student.id&&item.student_user_id===actor.id&&item.instructor_user_id===student.instrutorId);
        if(!active)return;setVersions(published);
        const packageIds=new Set(published.map(item=>item.package_contract_id));
        if(packageIds.size===1&&published.length){setVersion(published[0]);setGeneral(false);setClauses(false);}
        if(!published.length)setNotice(resolved.issue || 'A minuta foi carregada. O instrutor precisa registrar uma versão para disponibilizar o aceite.');
      }catch(error){if(active)setNotice(error instanceof Error?error.message:'Não foi possível consultar a versão para aceite.');}
    }).catch(error=>{if(active)setNotice(error instanceof Error?error.message:'Não foi possível carregar os dados da matrícula.');}).finally(()=>{if(active)setBusy(false);});
    return ()=>{active=false;};
  },[open,code,currentUser?.id,currentUser?.papel,authRevision]);
  const show = () => { setValues(legalDefaults(null));setSource(null); setStudentId('');setPackageId('');resetAcceptance();setVersions([]); setNotice(''); setOpen(true); };
  const [exporting,setExporting]=useState(false);
  const exportReady=()=>{if(code==='CONTRATO_AULA_PRATICA'&&currentUser?.papel==='ALUNO'&&!packageId&&!version){setNotice('Selecione o pacote contratado ou uma versão publicada antes de exportar o documento.');return false;}return true;};
  const downloadPdf = async () => {
    if(!exportReady())return;setExporting(true);
    try {downloadLegalFile(legalDocumentPdf(version?.content || rendered.content,version?.template_version || rendered.definition.versao,!!version),code+'-minuta.pdf');setNotice('Download do PDF iniciado. Confira os downloads do navegador.');}
    catch {setNotice('Não foi possível gerar o PDF. Tente novamente.');}finally{setExporting(false);}
  };
  const download = async () => {
    if(!exportReady())return;
    try {
      const snapshot = { codigo: code, versao: version?.template_version || rendered.definition.versao, status: version ? 'VERSAO_REGISTRADA_CONSULTAR_ACEITES_NO_BANCO' : 'MINUTA_SEM_ACEITE', geradoEm: new Date().toISOString(), pendencias: rendered.missing, conteudo: version?.content || rendered.content, sha256: await legalHash(version?.content || rendered.content) };
      downloadLegalFile(new Blob([JSON.stringify(snapshot,null,2)], {type:'application/json;charset=utf-8'}),code+'-minuta.json');
      setNotice('Documento exportado com conteúdo e hash SHA-256.');
    } catch { setNotice('Não foi possível exportar a minuta. Tente novamente.'); }
  };
  return <>
    <button ref={trigger} type="button" onClick={show} className="min-h-11 rounded-lg px-3 py-2 text-xs font-semibold underline underline-offset-4">{buttonLabel}</button>
    {open && createPortal(<div className="fixed inset-0 z-[1100] bg-slate-950/70 p-3 flex items-center justify-center">
      <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-white text-slate-800 rounded-2xl shadow-xl w-full max-w-4xl grid grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden" style={{height:'min(800px, calc(100dvh - 24px))'}}>
        <header className="legal-reader-header p-4 border-b flex items-center justify-between gap-3"><h2 id={titleId} className="text-lg font-bold">Documentos jurídicos</h2><button type="button" onClick={() => setOpen(false)} aria-label="Fechar documentos jurídicos" className="min-h-11 px-3 rounded-lg border">Fechar</button></header>
        <main className="legal-reader-body overflow-y-auto min-h-0 p-4 space-y-4">
          <label className="block font-semibold">Documento<select aria-label="Documento jurídico" value={code} onChange={event => {setCode(event.target.value);resetAcceptance();setNotice('');}} className="block w-full border rounded-lg p-3 mt-1"><option value="TERMOS_DE_USO">Termos de uso</option><option value="POLITICA_PRIVACIDADE_LGPD">Política de privacidade</option><option value="CONTRATO_AULA_PRATICA">Contrato de aulas práticas</option></select></label>
          <p className="text-sm bg-amber-50 p-3 rounded-lg">Minuta para conferência. Dados preenchidos automaticamente pelos cadastros e pelo pacote contratado. Versão {rendered.definition.versao}.</p>
          {code === 'CONTRATO_AULA_PRATICA' && students.length > 0 && <label className="block font-semibold">Aluno vinculado<select aria-label="Aluno do contrato" disabled={busy} value={studentId} onChange={event => selectStudent(event.target.value)} className="block w-full border rounded-lg p-3"><option value="" disabled>Selecione o aluno</option>{students.map(student => <option key={student.id} value={student.id}>{student.nome}</option>)}</select></label>}
          {code === 'CONTRATO_AULA_PRATICA' && selectedStudent && <label className="block font-semibold">Pacote contratado<select aria-label="Pacote do contrato" value={packageId} disabled={busy} key={studentId} onChange={event => {
            resetAcceptance();setPackageId(event.target.value);
            const contract = selectedStudent.contratosPacotes?.find(item => item.id === event.target.value);
            if (!contract) return;
            const matches=(source?.users || []).filter(user=>user.papel==='ALUNO' && !!selectedStudent.cpfFingerprint && user.cpfFingerprint===selectedStudent.cpfFingerprint);
            const offer=(source?.packages || []).find(item=>item.id===contract.pacoteId);
            const conditions={...offer?.condicoesContratuais,...Object.fromEntries(Object.entries(contract).filter(([,value])=>value!==undefined))};
            setValues(legalContractValues((source?.users.find(user=>user.id===selectedStudent.instrutorId) || null),selectedStudent,matches.length===1?matches[0]:undefined,{...contract,...conditions}));
          }} className="block w-full border rounded-lg p-3"><option value="" disabled>Selecione o contrato do aluno</option>{selectedStudent.contratosPacotes?.map(contract => <option key={contract.id} value={contract.id}>{contract.nome}</option>)}</select></label>}
          {code === 'CONTRATO_AULA_PRATICA' && currentUser && <section className="border rounded-xl p-3 space-y-3">
            <button disabled={busy} type="button" className="min-h-11 border rounded-lg px-3" onClick={() => run(async () => {setVersions(await loadLegalContracts());setNotice('Versões acessíveis carregadas do banco.');})}>Consultar contratos para aceite</button>
            {versions.length > 0 && <label className="block">Versão registrada<select aria-label="Versão registrada para aceite" value={version?.id || ''} onChange={event => {setVersion(versions.find(item => item.id===event.target.value) || null);setGeneral(false);setClauses(false);}} className="block w-full border rounded-lg p-3"><option value="">Selecione uma versão</option>{versions.map(item => <option value={item.id} key={item.id}>{item.package_contract_id} · {new Date(item.created_at).toLocaleString('pt-BR')}</option>)}</select></label>}
            {currentUser.papel!=='ALUNO' && selectedStudent && packageId && !version && <button disabled={busy} type="button" className="min-h-11 bg-blue-600 text-white rounded-lg px-3" onClick={() => run(async () => {
              if(rendered.missing.length)throw new Error('Atualize os cadastros ou as condições do pacote para resolver as pendências antes de registrar.');
              if(source?.legacy){await db.saveStudentAsync(selectedStudent,currentUser.id);}
              const key=JSON.stringify([studentId,packageId,values]);if(operation.current.key!==key)operation.current={key,id:crypto.randomUUID()};
              setVersion(await prepareLegalContract(operation.current.id,studentId,packageId,values));setGeneral(false);setClauses(false);setNotice('Versão registrada. Confira o conteúdo antes do aceite.');
            })}>Registrar versão para aceite</button>}
            {version && <><p className="text-xs break-all">Versão {version.id} · SHA-256 {version.content_sha256}</p><label className="flex items-start gap-2"><input type="checkbox" checked={general} onChange={event => setGeneral(event.target.checked)} />Li e concordo com os termos do Contrato de Prestação de Serviços.</label><label className="flex items-start gap-2 border-2 border-amber-400 bg-amber-50 rounded-lg p-3"><input type="checkbox" checked={clauses} onChange={event => setClauses(event.target.checked)} />{legalDocuments[0].checkboxes_obrigatorios?.[1]}</label><button type="button" disabled={busy || !general || !clauses} className="min-h-11 px-3 rounded-lg bg-emerald-700 text-white disabled:opacity-50" onClick={() => run(async () => {const receipt=await acceptLegalContract(version,general,clauses);window.dispatchEvent(new Event('agd:legal-contract-accepted'));setNotice('Aceite confirmado pelo banco em '+new Date(receipt.accepted_at).toLocaleString('pt-BR')+'. Comprovante '+receipt.id);})}>Confirmar meu aceite</button></>}
          </section>}
          {!version && (code!=='CONTRATO_AULA_PRATICA' || (!!selectedStudent && !!packageId)) && rendered.missing.length>0 && <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><h3 className="font-semibold">Dados pendentes no cadastro</h3><p>Atualize a identificação e o endereço nos cadastros do aluno e do instrutor. Duração, prazos e multa são definidos na contratação do pacote.</p><ul className="list-disc pl-5">{rendered.missing.map(key=><li key={key}>{key.replaceAll('_',' ')}</li>)}</ul></section>}
          {code==='CONTRATO_AULA_PRATICA' && currentUser?.papel==='ALUNO' && (!selectedStudent || !packageId) && !version ? <p role="status" className="rounded-xl border bg-white p-4">{busy?'Carregando sua matrícula e os dados do contrato…':selectedStudent?'Selecione o pacote contratado para visualizar o documento completo.':'Contrato indisponível até a confirmação da matrícula vinculada.'}</p> : <LegalDocument content={version?.content || rendered.content} />}
          {code === 'CONTRATO_AULA_PRATICA' && <section className="border-2 border-amber-400 bg-amber-50 p-4 rounded-xl"><h3 className="font-bold">Ciência específica das cláusulas Quarta e Quinta</h3><p className="text-sm mt-2">{legalDocuments[0].checkboxes_obrigatorios?.[1]}</p></section>}
        </main>
        <footer className="legal-reader-footer p-3 border-t"><p role="status" className="text-xs flex-1 min-w-0">{notice || 'Exportação da minuta para revisão das partes.'}</p><div className="legal-export-actions"><button type="button" onClick={download} className="min-h-11 rounded-lg px-3 py-2 border border-slate-300 text-sm">Exportar dados (JSON)</button><button type="button" onClick={downloadPdf} disabled={exporting} className="min-h-11 rounded-lg px-4 py-2 bg-blue-600 text-white font-semibold disabled:opacity-50">{exporting?'Gerando PDF…':'Exportar minuta'}</button></div></footer>
      </div>
    </div>,document.body)}
  </>;
}
