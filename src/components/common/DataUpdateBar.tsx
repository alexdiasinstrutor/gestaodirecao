import React, { useEffect, useRef, useState } from 'react';
import { Clock3, History, Download, X, ShieldCheck, Database } from 'lucide-react';
import { getDataUpdateStatus, getDataCheckpoints, DataCheckpoint } from '../../lib/dataHistory';
import { db } from '../../lib/storage';
import type { User } from '../../types';

export function DataUpdateBar({ user }: { user: User }) {
  const isMasterAdmin = user.papel === 'SUPER_ADMIN' || user.email === 'cassiordcosta@gmail.com';
  const [state, setState] = useState(getDataUpdateStatus);
  const [points, setPoints] = useState<DataCheckpoint[] | null>(null);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!points) return;
    const previous = document.activeElement as HTMLElement;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', trap);
      previous?.focus();
    };
  }, [points]);

  useEffect(() => {
    const update = () => setState(getDataUpdateStatus());
    update();
    window.addEventListener('agd:history-updated', update);
    window.addEventListener('storage', update);
    return () => {
      window.removeEventListener('agd:history-updated', update);
      window.removeEventListener('storage', update);
    };
  }, [user.id]);

  // Alunos e não-administradores não visualizam barra de históricos/backups
  if (!isMasterAdmin) {
    return null;
  }

  const labels: Record<string, string> = {
    agd_users: 'Cadastro do instrutor',
    agd_students: 'Alunos',
    agd_packages: 'Planos de aulas',
    agd_saas_custom_plans_v1: 'Planos do sistema',
    agd_vehicles: 'Veículos',
    agd_lessons: 'Aulas',
    agd_slots: 'Agenda',
    agd_accounts: 'Contas a receber',
    agd_payments: 'Pagamentos',
    agd_expenses: 'Despesas',
    agd_investments: 'Investimentos',
    agd_organizations: 'Instituições',
    agd_discount_coupons: 'Cupons',
    agd_coupon_redemptions: 'Uso de cupons',
    agd_credited_lessons: 'Créditos de aulas',
    agd_student_notifications: 'Notificações',
    agd_instructor_coverage: 'Área de atendimento',
    agd_student_leads: 'Alunos procurando instrutor'
  };

  const format = (value: string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const openHistory = async () => {
    setError('');
    try {
      setPoints(await getDataCheckpoints(user));
    } catch {
      setError('Não foi possível abrir os pontos de recuperação deste dispositivo.');
    }
  };

  const download = (point: DataCheckpoint) => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 1, ...point }, null, 2)], { type: 'application/json' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-' + point.id + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadFullPlatformBackup = () => {
    const fullExport = {
      exportedAt: new Date().toISOString(),
      exportedBy: user.email,
      platform: 'Gestão AD (Auto Direção)',
      ...db.getAllDataForExport()
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json;charset=utf-8' })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup-completo-plataforma-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500" aria-live="polite">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-2">
            <Clock3 size={14} /> Última alteração dos dados:{' '}
            <strong className="text-slate-700">
              {state.timestamp ? format(state.timestamp) : 'Nenhuma alteração registrada'}
            </strong>
          </span>
          {state.backup !== 'idle' && (
            <span className={state.backup === 'error' ? 'text-amber-700' : 'text-emerald-700'}>
              {state.backup === 'saving'
                ? 'Registrando ponto de recuperação…'
                : state.backup === 'saved'
                  ? 'Ponto de recuperação registrado'
                  : 'Backup pendente — verificar conexão'}
            </span>
          )}
        </div>
        <button
          onClick={openHistory}
          className="inline-flex items-center gap-2 min-h-11 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
        >
          <History size={15} /> Histórico e backups
        </button>
      </div>
      {error && (
        <p role="alert" className="mb-4 text-sm text-amber-700">
          {error}
        </p>
      )}
      {points && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPoints(null);
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Histórico e backups"
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-auto p-6"
          >
            <div className="flex justify-between items-start gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Histórico e backups (Master)</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Exclusivo do Administrador: backup completo de todos os cadastros e histórico de alterações da plataforma.
                </p>
              </div>
              <button
                autoFocus
                onClick={() => setPoints(null)}
                aria-label="Fechar histórico"
                className="p-3 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="my-4 p-4 rounded-xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-purple-950 flex items-start gap-2.5">
                <Database size={18} className="shrink-0 text-purple-700 mt-0.5" />
                <div>
                  <p className="font-bold">Backup Completo da Plataforma (Tudo e Todos)</p>
                  <p className="text-purple-800 mt-0.5">
                    Exporta todas as organizações, instrutores, alunos, veículos, aulas, faturas, pagamentos e auditoria em JSON.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={downloadFullPlatformBackup}
                className="shrink-0 min-h-10 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download size={14} />
                <span>Baixar Backup Geral</span>
              </button>
            </div>

            <p className="mb-4 rounded-xl bg-blue-50 text-blue-800 p-3.5 text-xs flex gap-3">
              <ShieldCheck size={18} className="shrink-0" /> Os pontos de recuperação abaixo registram versões anteriores e posteriores de cada alteração feita na plataforma.
            </p>

            {points.length === 0 ? (
              <p className="py-8 text-center text-slate-500 text-sm">
                Os pontos aparecerão aqui após uma alteração nos dados.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {points.map((p) => (
                  <li key={p.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">
                        {labels[p.key] || 'Atualização de cadastro'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {format(p.timestamp)} · {p.userName || 'Usuário cadastrado'}
                      </p>
                    </div>
                    <button
                      onClick={() => download(p)}
                      className="shrink-0 min-h-10 px-3 rounded-lg border border-slate-200 text-xs font-semibold flex items-center gap-2 hover:bg-slate-50 cursor-pointer"
                    >
                      <Download size={14} /> Exportar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}
