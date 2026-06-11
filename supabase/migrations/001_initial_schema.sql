-- ================================================================
-- BI GESTIÓN CLÍNICA · Clínica Santa Bárbara
-- Supabase PostgreSQL Migration 001 · Schema inicial
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- PERFILES (catálogo de roles)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.perfiles (
  id     SERIAL PRIMARY KEY,
  perfil TEXT NOT NULL UNIQUE CHECK (perfil IN ('Administrador', 'Consulta'))
);

INSERT INTO public.perfiles (perfil) VALUES ('Administrador'), ('Consulta')
ON CONFLICT (perfil) DO NOTHING;

-- ----------------------------------------------------------------
-- PROFILES (usuarios de la app — extiende auth.users)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT        NOT NULL,
  nombres    TEXT,
  telefono   TEXT,
  perfil_id  INTEGER     NOT NULL DEFAULT 2 REFERENCES public.perfiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- VALORACIONES (tabla principal — snapshot del extract GoMedisys)
-- Una fila por ingreso. El sync diario hace upsert por 'ingreso':
-- siempre refleja el estado más reciente del paciente.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.valoraciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificación
  sede                    TEXT,
  ingreso                 BIGINT NOT NULL UNIQUE,
  fecha_ingreso           DATE,
  aseguradora             TEXT,
  identificacion_paciente TEXT,
  nombre_paciente         TEXT,

  -- Primera atención de gestión clínica
  fecha_primera_atencion        DATE,
  especialidad_primera          TEXT,
  profesional_primera           TEXT,
  ubicacion_primera             TEXT,
  esquema_historia_primera      TEXT,
  primer_tipo_intervencion      TEXT,
  primer_causas_larga_estancia  TEXT,
  comentario_primera            TEXT,

  -- Última valoración de gestión clínica
  fecha_ultima_valoracion       DATE,
  especialidad_ultima           TEXT,
  profesional_ultima            TEXT,
  ubicacion_ultima              TEXT,
  esquema_historia_ultima       TEXT,
  ultimo_tipo_intervencion      TEXT,
  ultimo_causas_larga_estancia  TEXT,
  comentario_ultima             TEXT,

  -- Métricas de estancia / egreso
  cantidad_atenciones           INTEGER,
  estancia_total                INTEGER,
  estancia_mayor_20_dias        TEXT,
  fecha_egreso                  DATE,
  diferencia_dias_ultima_val    INTEGER,
  servicio_egreso               TEXT,
  destino_ultima_atencion       TEXT,
  fecha_fallecido               DATE,

  -- Escala CAM (delirium)
  cam_fecha       DATE,
  cam_valoracion  TEXT,
  cam_resultado   TEXT,

  -- Escala ESAS/SAS (síntomas cuidado paliativo)
  esas_fecha            DATE,
  sas_dolor             NUMERIC(5,2),
  sas_cansancio         NUMERIC(5,2),
  sas_nauseas           NUMERIC(5,2),
  sas_depresion         NUMERIC(5,2),
  sas_ansiedad          NUMERIC(5,2),
  sas_somnolencia       NUMERIC(5,2),
  sas_apetito           NUMERIC(5,2),
  sas_bienestar         NUMERIC(5,2),
  sas_falta_aire        NUMERIC(5,2),
  sas_dificultad_dormir NUMERIC(5,2),

  -- Escala NECPAL
  necpal_fecha      DATE,
  necpal_valoracion TEXT,
  necpal_resultado  TEXT,

  -- Escala PAPSCORE
  papscore_fecha      DATE,
  papscore_valoracion TEXT,
  papscore_resultado  TEXT,

  -- Escala Fragilidad
  fragilidad_fecha      DATE,
  fragilidad_valoracion TEXT,
  fragilidad_resultado  TEXT,

  -- Escala FOIS
  fois_fecha      DATE,
  fois_valoracion TEXT,
  fois_resultado  TEXT,

  -- Escala RESVECH (heridas)
  resvech_fecha      DATE,
  resvech_valoracion TEXT,
  resvech_resultado  TEXT,

  -- Escala MNA (nutrición)
  mna_fecha      DATE,
  mna_valoracion TEXT,
  mna_resultado  TEXT,

  -- Escala Yesavage (depresión geriátrica)
  yesavage_fecha      DATE,
  yesavage_valoracion TEXT,
  yesavage_resultado  TEXT,

  -- Escala Gijón (valoración social)
  gijon_fecha      DATE,
  gijon_valoracion TEXT,
  gijon_resultado  TEXT,

  -- Barthel (previo / actual / egreso)
  barthel_previo_fecha      DATE,
  barthel_previo_valoracion TEXT,
  barthel_previo_resultado  TEXT,
  barthel_actual_fecha      DATE,
  barthel_actual_valoracion TEXT,
  barthel_actual_resultado  TEXT,
  barthel_egreso_fecha      DATE,
  barthel_egreso_valoracion TEXT,
  barthel_egreso_resultado  TEXT,

  -- IDC-PAL
  idc_fecha       DATE,
  idc_intervencion_recursos TEXT,
  idc_estado_situacion      TEXT,

  -- Campos generados (filtros rápidos por mes/año de primera atención)
  anio_primera SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR  FROM fecha_primera_atencion)::SMALLINT) STORED,
  mes_primera  SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM fecha_primera_atencion)::SMALLINT) STORED,
  anio_ingreso SMALLINT GENERATED ALWAYS AS (EXTRACT(YEAR  FROM fecha_ingreso)::SMALLINT) STORED,
  mes_ingreso  SMALLINT GENERATED ALWAYS AS (EXTRACT(MONTH FROM fecha_ingreso)::SMALLINT) STORED,

  -- Estado derivado del paciente
  estado_paciente TEXT GENERATED ALWAYS AS (
    CASE
      WHEN fecha_fallecido IS NOT NULL THEN 'Fallecido'
      WHEN fecha_egreso    IS NOT NULL THEN 'Egresado'
      ELSE 'Activo'
    END
  ) STORED,

  -- Auditoría
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- SYNC_LOGS (log de sincronizaciones ETL)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  executed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status           TEXT        NOT NULL CHECK (status IN ('success','partial','error')),
  records_fetched  INTEGER     DEFAULT 0,
  records_upserted INTEGER     DEFAULT 0,
  duration_ms      INTEGER,
  error_message    TEXT,
  sync_from        DATE,
  sync_to          DATE,
  triggered_by     TEXT        DEFAULT 'cron'
);

-- ----------------------------------------------------------------
-- REPORTES_EMAIL (log de envíos vía Resend)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reportes_email (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo          TEXT        NOT NULL DEFAULT 'manual',
  destinatarios TEXT[]      NOT NULL,
  asunto        TEXT        NOT NULL,
  cuerpo        TEXT,
  fecha_envio   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estado        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (estado IN ('pending','sent','failed')),
  error_mensaje TEXT,
  enviado_por   UUID        REFERENCES public.profiles(id)
);

-- ----------------------------------------------------------------
-- CONFIGURACION
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.configuracion (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave       TEXT        NOT NULL UNIQUE,
  valor       TEXT        NOT NULL,
  descripcion TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID        REFERENCES public.profiles(id)
);

INSERT INTO public.configuracion (clave, valor, descripcion) VALUES
  ('nombre_clinica',  'Clínica de Alta Complejidad Santa Bárbara', 'Nombre de la institución'),
  ('umbral_larga_estancia', '20', 'Días para considerar larga estancia'),
  ('email_reporte_default', 'juan.etayo@cacsantabarbara.co', 'Email destino para reportes')
ON CONFLICT (clave) DO NOTHING;

-- ================================================================
-- ÍNDICES
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_val_fecha_ingreso   ON public.valoraciones (fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_val_fecha_primera   ON public.valoraciones (fecha_primera_atencion);
CREATE INDEX IF NOT EXISTS idx_val_anio_mes        ON public.valoraciones (anio_primera, mes_primera);
CREATE INDEX IF NOT EXISTS idx_val_aseguradora     ON public.valoraciones (aseguradora);
CREATE INDEX IF NOT EXISTS idx_val_sede            ON public.valoraciones (sede);
CREATE INDEX IF NOT EXISTS idx_val_especialidad    ON public.valoraciones (especialidad_ultima);
CREATE INDEX IF NOT EXISTS idx_val_estado          ON public.valoraciones (estado_paciente);
CREATE INDEX IF NOT EXISTS idx_val_larga_estancia  ON public.valoraciones (estancia_mayor_20_dias);

-- ================================================================
-- ROW LEVEL SECURITY
-- ================================================================
ALTER TABLE public.perfiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.valoraciones   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reportes_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion  ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario actual es Administrador?
CREATE OR REPLACE FUNCTION public.fn_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.perfiles pf ON pf.id = p.perfil_id
    WHERE p.id = auth.uid() AND pf.perfil = 'Administrador'
  );
$$;

-- Perfiles: lectura para autenticados
CREATE POLICY "perfiles_select" ON public.perfiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Profiles: todos los autenticados leen; admin gestiona; cada quien edita lo suyo
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.fn_is_admin());
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.fn_is_admin());
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.fn_is_admin());

-- Valoraciones: autenticados leen; solo admin escribe (CRUD desde la app)
CREATE POLICY "val_select" ON public.valoraciones
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "val_insert" ON public.valoraciones
  FOR INSERT WITH CHECK (public.fn_is_admin());
CREATE POLICY "val_update" ON public.valoraciones
  FOR UPDATE USING (public.fn_is_admin());
CREATE POLICY "val_delete" ON public.valoraciones
  FOR DELETE USING (public.fn_is_admin());

-- Sync logs: autenticados leen (el ETL escribe con service_role, bypassa RLS)
CREATE POLICY "sync_select" ON public.sync_logs
  FOR SELECT USING (auth.role() = 'authenticated');

-- Reportes
CREATE POLICY "rep_select" ON public.reportes_email
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "rep_insert" ON public.reportes_email
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Configuración: autenticados leen, admin escribe
CREATE POLICY "config_select" ON public.configuracion
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "config_write" ON public.configuracion
  FOR ALL USING (public.fn_is_admin());

-- ================================================================
-- TRIGGERS
-- ================================================================
CREATE OR REPLACE FUNCTION public.fn_update_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_val_updated_at
  BEFORE UPDATE ON public.valoraciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

CREATE TRIGGER trg_config_updated_at
  BEFORE UPDATE ON public.configuracion
  FOR EACH ROW EXECUTE FUNCTION public.fn_update_timestamp();

-- Auto-crear profile al registrar usuario en auth
CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombres, perfil_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombres', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'perfil_id')::INTEGER, 2)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();
