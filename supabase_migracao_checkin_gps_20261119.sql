-- ==============================================================================
-- MIGRAÇÃO ADITIVA E ANTI-FALHA: MÓDULO CHECK-IN DE AULA & TELEMETRIA GPS
-- Execute no SQL Editor do Supabase quando desejar espelhar na tabela nativa.
-- (Mesmo antes da execução, o Cloud Vault garante 100% da persistência sem falhas.)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.lesson_checkins (
  id VARCHAR(120) PRIMARY KEY,
  organizacao_id VARCHAR(100) NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  aula_id VARCHAR(120) NOT NULL,
  aluno_id VARCHAR(120) NOT NULL,
  aluno_nome VARCHAR(255) NOT NULL,
  instrutor_id VARCHAR(120) NOT NULL,
  instrutor_nome VARCHAR(255) NOT NULL,
  veiculo_id VARCHAR(120),
  data_agendamento DATE NOT NULL,
  hora_inicio_agendamento VARCHAR(10) NOT NULL,
  hora_fim_agendamento VARCHAR(10) NOT NULL,
  topico_aula TEXT,
  checkin_em TIMESTAMPTZ NOT NULL,
  checkout_em TIMESTAMPTZ,
  iniciado_por_id VARCHAR(120) NOT NULL,
  iniciado_por_papel VARCHAR(40) NOT NULL,
  finalizado_por_id VARCHAR(120),
  finalizado_por_papel VARCHAR(40),
  tempo_total_segundos INTEGER DEFAULT 0,
  tempo_deslocamento_segundos INTEGER DEFAULT 0,
  tempo_parada_segundos INTEGER DEFAULT 0,
  distancia_km NUMERIC(10, 3) DEFAULT 0,
  coordenadas JSONB DEFAULT '[]'::jsonb,
  modo_hardware VARCHAR(40) NOT NULL DEFAULT 'LIVE_MAP',
  motivo_hardware_limitado TEXT,
  status VARCHAR(40) NOT NULL DEFAULT 'EM_ANDAMENTO',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_checkins_org ON public.lesson_checkins(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_lesson_checkins_instrutor ON public.lesson_checkins(instrutor_id);
CREATE INDEX IF NOT EXISTS idx_lesson_checkins_aluno ON public.lesson_checkins(aluno_id);
CREATE INDEX IF NOT EXISTS idx_lesson_checkins_aula ON public.lesson_checkins(aula_id);
CREATE INDEX IF NOT EXISTS idx_lesson_checkins_data ON public.lesson_checkins(data_agendamento DESC);

ALTER TABLE public.lesson_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_full_access_lesson_checkins" ON public.lesson_checkins;
CREATE POLICY "app_full_access_lesson_checkins"
  ON public.lesson_checkins
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
