-- ================================================================
-- BI GESTIÓN CLÍNICA · Migration 003 · Demografía y diagnóstico
-- Campos requeridos por el modelo Power BI: pirámide poblacional,
-- desgloses por sexo, urbano/rural, estado civil y CIE-10.
-- ================================================================

ALTER TABLE public.valoraciones
  ADD COLUMN IF NOT EXISTS fecha_nacimiento        DATE,
  ADD COLUMN IF NOT EXISTS edad                    SMALLINT,
  ADD COLUMN IF NOT EXISTS sexo                    TEXT,
  ADD COLUMN IF NOT EXISTS estado_civil            TEXT,
  ADD COLUMN IF NOT EXISTS municipio_residencia    TEXT,
  ADD COLUMN IF NOT EXISTS departamento_residencia TEXT,
  ADD COLUMN IF NOT EXISTS zona_residencia         TEXT,
  ADD COLUMN IF NOT EXISTS dx_principal_codigo     TEXT,
  ADD COLUMN IF NOT EXISTS dx_principal_nombre     TEXT,
  ADD COLUMN IF NOT EXISTS servicio_actual         TEXT;

CREATE INDEX IF NOT EXISTS idx_val_sexo ON public.valoraciones (sexo);
