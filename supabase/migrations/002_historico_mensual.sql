-- ================================================================
-- BI GESTIÓN CLÍNICA · Migration 002 · Histórico mensual
-- La tabla valoraciones pasa de "estado actual" (UNIQUE ingreso) a
-- snapshots mensuales: una fila por (ingreso, fecha_corte).
-- fecha_corte = último día del mes del snapshot. El sync diario
-- refresca el mes en curso; los meses cerrados quedan congelados.
-- ================================================================

-- Columna de corte (la tabla está vacía al momento de migrar)
ALTER TABLE public.valoraciones
  ADD COLUMN IF NOT EXISTS fecha_corte DATE NOT NULL;

-- Reemplazar unicidad por ingreso -> (ingreso, fecha_corte)
ALTER TABLE public.valoraciones
  DROP CONSTRAINT IF EXISTS valoraciones_ingreso_key;
ALTER TABLE public.valoraciones
  ADD CONSTRAINT valoraciones_ingreso_corte_key UNIQUE (ingreso, fecha_corte);

-- Filtros rápidos por corte
CREATE INDEX IF NOT EXISTS idx_val_fecha_corte ON public.valoraciones (fecha_corte);

ALTER TABLE public.valoraciones
  ADD COLUMN IF NOT EXISTS anio_corte SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR  FROM fecha_corte)::SMALLINT) STORED,
  ADD COLUMN IF NOT EXISTS mes_corte  SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM fecha_corte)::SMALLINT) STORED;

-- Cortes disponibles (la app la usa para el selector de mes).
-- security_invoker: respeta el RLS de valoraciones del usuario que consulta.
CREATE OR REPLACE VIEW public.v_cortes
WITH (security_invoker = true) AS
SELECT DISTINCT fecha_corte
FROM public.valoraciones
ORDER BY fecha_corte DESC;
