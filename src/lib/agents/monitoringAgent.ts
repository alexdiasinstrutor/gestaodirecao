// Agente de Monitoramento em Tempo Real (Watchdog / Activity Monitoring Agent)
// Responsável por registrar, monitorar e verificar todas as ações do sistema

export type EventSeverity = 'INFO' | 'SEGURO' | 'AVISO' | 'CRITICO';

export type EventCategory = 
  | 'ALUNO'
  | 'PACOTE'
  | 'TRANSFERENCIA'
  | 'FINANCEIRO'
  | 'AGENDA'
  | 'SEGURANCA'
  | 'SISTEMA';

export interface MonitoringEvent {
  id: string;
  timestamp: string;
  categoria: EventCategory;
  severidade: EventSeverity;
  titulo: string;
  detalhe: string;
  ator?: string;
  meta?: Record<string, any>;
}

export interface SystemHealthMetrics {
  statusGeral: 'EXCELENTE' | 'ESTAVEL' | 'ATENCAO';
  taxaIntegridade: number; // 0 - 100%
  totalEventosHoje: number;
  alertasCriticos: number;
  armazenamentoKb: number;
  tempoAtivoMinutos: number;
  ultimaAuditoria: string;
}

const STORAGE_MONITOR_KEY = 'agd_monitoring_events_v1';
const MAX_EVENTS_IN_MEMORY = 300;

class MonitoringAgentService {
  private events: MonitoringEvent[] = [];
  private listeners: Array<(events: MonitoringEvent[]) => void> = [];
  private startTime = Date.now();

  constructor() {
    this.loadPersistedEvents();
    this.logEvent({
      categoria: 'SISTEMA',
      severidade: 'SEGURO',
      titulo: 'Agente de Monitoramento Ativado',
      detalhe: 'Vigilância contínua de operações, integridade de dados e auditoria em execução.',
      ator: 'Watchdog System Engine'
    });
  }

  private loadPersistedEvents() {
    try {
      const saved = localStorage.getItem(STORAGE_MONITOR_KEY);
      if (saved) {
        this.events = JSON.parse(saved);
      }
    } catch {
      this.events = [];
    }
  }

  private persistEvents() {
    try {
      const slice = this.events.slice(0, MAX_EVENTS_IN_MEMORY);
      localStorage.setItem(STORAGE_MONITOR_KEY, JSON.stringify(slice));
    } catch {
      // Storage safe catch
    }
  }

  public subscribe(listener: (events: MonitoringEvent[]) => void) {
    this.listeners.push(listener);
    listener([...this.events]);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    const copy = [...this.events];
    this.listeners.forEach((fn) => {
      try {
        fn(copy);
      } catch (err) {
        console.error('Erro no listener do monitor:', err);
      }
    });
  }

  public logEvent(params: {
    categoria: EventCategory;
    severidade: EventSeverity;
    titulo: string;
    detalhe: string;
    ator?: string;
    meta?: Record<string, any>;
  }): MonitoringEvent {
    const newEvent: MonitoringEvent = {
      id: `mon_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      categoria: params.categoria,
      severidade: params.severidade,
      titulo: params.titulo,
      detalhe: params.detalhe,
      ator: params.ator || 'Sistema',
      meta: params.meta
    };

    this.events.unshift(newEvent);
    if (this.events.length > MAX_EVENTS_IN_MEMORY) {
      this.events.pop();
    }

    this.persistEvents();
    this.notify();
    return newEvent;
  }

  public getEvents(): MonitoringEvent[] {
    return [...this.events];
  }

  public getMetrics(): SystemHealthMetrics {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const eventosHoje = this.events.filter((e) => e.timestamp.startsWith(todayStr));
    const alertasCriticos = this.events.filter((e) => e.severidade === 'CRITICO').length;

    // Calcular tamanho aproximado do LocalStorage
    let totalChars = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          totalChars += (localStorage.getItem(key) || '').length;
        }
      }
    } catch {
      totalChars = 0;
    }

    const kb = Math.round((totalChars * 2) / 1024);
    const uptimeMinutes = Math.floor((Date.now() - this.startTime) / (1000 * 60));

    let status: 'EXCELENTE' | 'ESTAVEL' | 'ATENCAO' = 'EXCELENTE';
    let taxaIntegridade = 100;

    if (alertasCriticos > 0) {
      status = 'ATENCAO';
      taxaIntegridade = Math.max(70, 100 - alertasCriticos * 10);
    } else if (this.events.some((e) => e.severidade === 'AVISO')) {
      status = 'ESTAVEL';
      taxaIntegridade = 98;
    }

    return {
      statusGeral: status,
      taxaIntegridade,
      totalEventosHoje: eventosHoje.length,
      alertasCriticos,
      armazenamentoKb: kb,
      tempoAtivoMinutos: uptimeMinutes,
      ultimaAuditoria: new Date().toLocaleTimeString('pt-BR')
    };
  }

  public exportReportJSON(): string {
    return JSON.stringify(
      {
        geradoEm: new Date().toISOString(),
        metrica: this.getMetrics(),
        totalRegistros: this.events.length,
        eventos: this.events
      },
      null,
      2
    );
  }

  public clearLogs() {
    this.events = [];
    this.persistEvents();
    this.logEvent({
      categoria: 'SISTEMA',
      severidade: 'INFO',
      titulo: 'Logs Reiniciados',
      detalhe: 'A pilha de eventos de monitoramento foi reiniciada pelo operador.',
      ator: 'Administrador'
    });
  }
}

export const monitoringAgent = new MonitoringAgentService();
