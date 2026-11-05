import { createClient } from '@supabase/supabase-js';

// ============================================================
// Cliente Supabase — configurado via variáveis de ambiente Vite
// No Vercel: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
// ============================================================

const supabaseUrl = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || '') as string;
const supabaseAnonKey = ((typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || '') as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[Supabase] Variáveis VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não definidas. ' +
    'O sistema operará em modo localStorage (offline). ' +
    'Configure as variáveis no painel do Vercel para ativar o banco de dados em nuvem.'
  );
}

export const supabase = (supabaseUrl && supabaseAnonKey)
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

/**
 * Verifica se o Supabase está configurado e disponível
 */
export function isSupabaseEnabled(): boolean {
  return !!supabase;
}

/**
 * Testa a conectividade com o Supabase
 */
export async function testSupabaseClientConnection(): Promise<{ connected: boolean; message: string }> {
  if (!supabase) {
    return { connected: false, message: 'Supabase não configurado. Operando em modo localStorage.' };
  }
  try {
    const { error } = await supabase.from('organizations').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      return { connected: false, message: `Erro ao conectar: ${error.message}` };
    }
    return { connected: true, message: 'Conexão com Supabase estabelecida com sucesso!' };
  } catch (err: any) {
    return { connected: false, message: `Falha de rede: ${err.message}` };
  }
}

