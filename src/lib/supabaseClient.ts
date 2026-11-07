import { createClient } from '@supabase/supabase-js';

// ============================================================
// Cliente Supabase — Sistema de Gestão de Direção
// Conexão oficial ao PostgreSQL com fallback de alta disponibilidade
// ============================================================

export const OFFICIAL_SUPABASE_URL = 'https://ozizhwejagjlhmaygvlf.supabase.co';
export const OFFICIAL_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96aXpod2VqYWdqbGhtYXlndmxmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNjc3MjgsImV4cCI6MjEwODk0MzcyOH0.GkI0Soeg4FoBbGI8PV7J34YbEpZEu3A5kWKUBin2iz4';

const envUrl = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '') as string;
const envKey = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '') as string;

export const supabaseUrl = envUrl || OFFICIAL_SUPABASE_URL;
export const supabaseAnonKey = envKey || OFFICIAL_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Verifica se o Supabase está configurado e disponível
 */
export function isSupabaseEnabled(): boolean {
  return !!supabase;
}

/**
 * Testa a conectividade com o Supabase e mede a latência em ms
 */
export async function testSupabaseClientConnection(): Promise<{
  connected: boolean;
  message: string;
  latencyMs?: number;
}> {
  if (!supabase) {
    return { connected: false, message: 'Supabase não inicializado.' };
  }
  const start = performance.now();
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    const latencyMs = Math.round(performance.now() - start);
    if (error && error.code !== 'PGRST116') {
      return { connected: false, message: `Erro no Supabase: ${error.message}`, latencyMs };
    }
    return {
      connected: true,
      message: `Conexão estabelecida com sucesso (${latencyMs}ms)!`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - start);
    return { connected: false, message: `Falha de rede: ${err.message}`, latencyMs };
  }
}

/**
 * Verifica se o provedor Google está habilitado no Supabase
 */
export async function checkIsGoogleAuthEnabled(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const res = await fetch(`${OFFICIAL_SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': OFFICIAL_SUPABASE_ANON_KEY,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data?.external?.google);
  } catch {
    return false;
  }
}

/**
 * Inicia fluxo de autenticação / cadastro via Google OAuth
 */
export async function signInWithGoogleOAuth(): Promise<{
  data: any;
  error: any;
  providerDisabled?: boolean;
}> {
  if (!supabase) {
    return { data: null, error: new Error('Supabase indisponível') };
  }

  // Pre-flight: verifica se o provedor Google está ativo no Supabase
  // para evitar redirecionar o usuário para a tela crua de erro HTTP 400 do Supabase
  const isEnabled = await checkIsGoogleAuthEnabled();
  if (!isEnabled) {
    return {
      data: null,
      error: new Error('Provedor Google ainda não habilitado no painel do Supabase.'),
      providerDisabled: true,
    };
  }

  try {
    const res = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return res;
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Obtém a sessão atual de autenticação (inclui sessões Google)
 */
export async function getSupabaseAuthSession() {
  if (!supabase) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) return null;
    return session;
  } catch {
    return null;
  }
}
