/**
 * Utilitário para manter o rastreamento GPS ativo em dispositivos móveis:
 * 1. Screen Wake Lock API (evita o desligamento automático da tela)
 * 2. Silent MediaSession / <audio> keep-alive (mantém a aba priorizada caso o usuário bloqueie a tela ou troque de app)
 */

export interface MobileKeepAliveStatus {
  active: boolean;
  wakeLockActive: boolean;
  backgroundAudioActive: boolean;
  supported: boolean;
  detail: string;
}

type StatusListener = (status: MobileKeepAliveStatus) => void;

function createSilentWavDataUri(): string {
  // 1 segundo de silêncio PCM 8kHz mono 8-bit (valores 0x80) = 44 bytes header + 8000 samples
  const sampleRate = 8000;
  const numSamples = 8000;
  const buffer = new Uint8Array(44 + numSamples);
  const view = new DataView(buffer.buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      buffer[offset + i] = str.charCodeAt(i);
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  writeStr(36, 'data');
  view.setUint32(40, numSamples, true);
  buffer.fill(128, 44);

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(i, i + chunkSize));
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : '';
  return `data:audio/wav;base64,${b64}`;
}

class MobileGpsKeepAliveManager {
  private isActive = false;
  private wakeLockSentinel: any = null;
  private audioEl: HTMLAudioElement | null = null;
  private visibilityListener: (() => void) | null = null;
  private listeners = new Set<StatusListener>();
  private currentLabel = 'Aula Prática GPS Ativa';

  private status: MobileKeepAliveStatus = {
    active: false,
    wakeLockActive: false,
    backgroundAudioActive: false,
    supported: typeof navigator !== 'undefined' && ('wakeLock' in navigator || typeof Audio !== 'undefined'),
    detail: 'Inativo'
  };

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getStatus(): MobileKeepAliveStatus {
    return this.status;
  }

  private emit() {
    const parts: string[] = [];
    if (this.status.wakeLockActive) parts.push('Tela Ativa (WakeLock)');
    if (this.status.backgroundAudioActive) parts.push('Sessão 2º Plano Ativa');
    this.status = {
      ...this.status,
      active: this.isActive,
      detail: this.isActive
        ? parts.length > 0
          ? parts.join(' + ')
          : 'Monitoramento contínuo ativo'
        : 'Inativo'
    };
    this.listeners.forEach((fn) => fn(this.status));
  }

  private async acquireWakeLock(): Promise<void> {
    if (typeof navigator === 'undefined') return;
    const nav: any = navigator;
    if (!nav.wakeLock || typeof nav.wakeLock.request !== 'function') return;
    try {
      if (this.wakeLockSentinel) {
        return;
      }
      const sentinel = await nav.wakeLock.request('screen');
      this.wakeLockSentinel = sentinel;
      this.status.wakeLockActive = true;
      sentinel.addEventListener?.('release', () => {
        this.wakeLockSentinel = null;
        this.status.wakeLockActive = false;
        this.emit();
      });
      this.emit();
    } catch {
      this.status.wakeLockActive = false;
      this.emit();
    }
  }

  private startBackgroundAudio(studentName?: string): void {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return;
    try {
      if (!this.audioEl) {
        const audio = new Audio(createSilentWavDataUri());
        audio.loop = true;
        audio.volume = 0.001;
        audio.preload = 'auto';
        audio.setAttribute('playsinline', 'true');
        this.audioEl = audio;
      }
      const playPromise = this.audioEl.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            this.status.backgroundAudioActive = true;
            this.updateMediaSession(studentName);
            this.emit();
          })
          .catch(() => {
            this.status.backgroundAudioActive = false;
            this.emit();
          });
      } else {
        this.status.backgroundAudioActive = true;
        this.updateMediaSession(studentName);
        this.emit();
      }
    } catch {
      this.status.backgroundAudioActive = false;
    }
  }

  private updateMediaSession(studentName?: string): void {
    if (typeof navigator === 'undefined') return;
    const nav: any = navigator;
    if (!('mediaSession' in nav) || !nav.mediaSession) return;
    try {
      const MetaCtor = (typeof window !== 'undefined' && (window as any).MediaMetadata) || null;
      if (MetaCtor) {
        nav.mediaSession.metadata = new MetaCtor({
          title: this.currentLabel,
          artist: 'Gestão AD (Auto Direção)',
          album: studentName ? `Aluno: ${studentName}` : 'Check-in & Rota GPS'
        });
      }
      nav.mediaSession.playbackState = 'playing';
    } catch {
      // ignore unsupported browsers
    }
  }

  async start(studentName?: string): Promise<MobileKeepAliveStatus> {
    this.isActive = true;
    this.currentLabel = studentName ? `Aula GPS · ${studentName}` : 'Aula Prática GPS Ativa';

    if (typeof document !== 'undefined' && !this.visibilityListener) {
      this.visibilityListener = () => {
        if (!this.isActive) return;
        if (document.visibilityState === 'visible') {
          void this.acquireWakeLock();
          if (this.audioEl && this.audioEl.paused) {
            this.audioEl.play().catch(() => {});
          }
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);
    }

    this.startBackgroundAudio(studentName);
    await this.acquireWakeLock();
    this.emit();
    return this.status;
  }

  async refreshOnVisibility(studentName?: string): Promise<void> {
    if (!this.isActive) return;
    await this.acquireWakeLock();
    if (!this.status.backgroundAudioActive) {
      this.startBackgroundAudio(studentName);
    } else if (this.audioEl && this.audioEl.paused) {
      this.audioEl.play().catch(() => {});
    }
  }

  async stop(): Promise<void> {
    this.isActive = false;

    if (typeof document !== 'undefined' && this.visibilityListener) {
      document.removeEventListener('visibilitychange', this.visibilityListener);
      this.visibilityListener = null;
    }

    if (this.wakeLockSentinel) {
      try {
        await this.wakeLockSentinel.release();
      } catch {
        // ignore
      }
      this.wakeLockSentinel = null;
    }

    if (this.audioEl) {
      try {
        this.audioEl.pause();
        this.audioEl.currentTime = 0;
      } catch {
        // ignore
      }
      this.audioEl = null;
    }

    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        const nav: any = navigator;
        nav.mediaSession.playbackState = 'none';
        nav.mediaSession.metadata = null;
      } catch {
        // ignore
      }
    }

    this.status.wakeLockActive = false;
    this.status.backgroundAudioActive = false;
    this.emit();
  }
}

export const mobileGpsKeepAlive = new MobileGpsKeepAliveManager();
