export type Perfil = 'Administrador' | 'Consulta'

export interface Profile {
  id: string
  email: string
  nombres: string
  telefono: string | null
  perfil_id: number
  created_at: string
  updated_at: string
  perfiles?: { id: number; perfil: Perfil }
}

export interface Valoracion {
  id: string
  fecha_corte: string
  sede: string | null
  ingreso: number
  fecha_ingreso: string | null
  aseguradora: string | null
  identificacion_paciente: string | null
  nombre_paciente: string | null

  fecha_primera_atencion: string | null
  especialidad_primera: string | null
  profesional_primera: string | null
  ubicacion_primera: string | null
  esquema_historia_primera: string | null
  primer_tipo_intervencion: string | null
  primer_causas_larga_estancia: string | null
  comentario_primera: string | null

  fecha_ultima_valoracion: string | null
  especialidad_ultima: string | null
  profesional_ultima: string | null
  ubicacion_ultima: string | null
  esquema_historia_ultima: string | null
  ultimo_tipo_intervencion: string | null
  ultimo_causas_larga_estancia: string | null
  comentario_ultima: string | null

  cantidad_atenciones: number | null
  estancia_total: number | null
  estancia_mayor_20_dias: string | null
  fecha_egreso: string | null
  diferencia_dias_ultima_val: number | null
  servicio_egreso: string | null
  destino_ultima_atencion: string | null
  fecha_fallecido: string | null

  cam_fecha: string | null
  cam_valoracion: string | null
  cam_resultado: string | null

  esas_fecha: string | null
  sas_dolor: number | null
  sas_cansancio: number | null
  sas_nauseas: number | null
  sas_depresion: number | null
  sas_ansiedad: number | null
  sas_somnolencia: number | null
  sas_apetito: number | null
  sas_bienestar: number | null
  sas_falta_aire: number | null
  sas_dificultad_dormir: number | null

  necpal_fecha: string | null
  necpal_valoracion: string | null
  necpal_resultado: string | null

  papscore_fecha: string | null
  papscore_valoracion: string | null
  papscore_resultado: string | null

  fragilidad_fecha: string | null
  fragilidad_valoracion: string | null
  fragilidad_resultado: string | null

  fois_fecha: string | null
  fois_valoracion: string | null
  fois_resultado: string | null

  resvech_fecha: string | null
  resvech_valoracion: string | null
  resvech_resultado: string | null

  mna_fecha: string | null
  mna_valoracion: string | null
  mna_resultado: string | null

  yesavage_fecha: string | null
  yesavage_valoracion: string | null
  yesavage_resultado: string | null

  gijon_fecha: string | null
  gijon_valoracion: string | null
  gijon_resultado: string | null

  barthel_previo_fecha: string | null
  barthel_previo_valoracion: string | null
  barthel_previo_resultado: string | null
  barthel_actual_fecha: string | null
  barthel_actual_valoracion: string | null
  barthel_actual_resultado: string | null
  barthel_egreso_fecha: string | null
  barthel_egreso_valoracion: string | null
  barthel_egreso_resultado: string | null

  idc_fecha: string | null
  idc_intervencion_recursos: string | null
  idc_estado_situacion: string | null

  fecha_nacimiento: string | null
  edad: number | null
  sexo: string | null
  estado_civil: string | null
  municipio_residencia: string | null
  departamento_residencia: string | null
  zona_residencia: string | null
  dx_principal_codigo: string | null
  dx_principal_nombre: string | null
  servicio_actual: string | null

  anio_primera: number | null
  mes_primera: number | null
  anio_ingreso: number | null
  mes_ingreso: number | null
  estado_paciente: 'Activo' | 'Egresado' | 'Fallecido'

  created_at: string
  updated_at: string
}

/** Definición de escalas para páginas genéricas */
export interface EscalaDef {
  key: string            // prefijo de columnas, p.ej. 'cam'
  nombre: string         // 'CAM'
  titulo: string         // 'Métricas Mentales — CAM (Delirium)'
  descripcion: string
}

export const ESCALAS: EscalaDef[] = [
  { key: 'cam',        nombre: 'CAM',        titulo: 'CAM — Delirium',                 descripcion: 'Confusion Assessment Method' },
  { key: 'yesavage',   nombre: 'Yesavage',   titulo: 'Yesavage — Depresión geriátrica', descripcion: 'Escala de depresión geriátrica' },
  { key: 'gijon',      nombre: 'Gijón',      titulo: 'Gijón — Valoración social',       descripcion: 'Valoración sociofamiliar' },
  { key: 'mna',        nombre: 'MNA',        titulo: 'MNA — Nutrición',                 descripcion: 'Mini Nutritional Assessment' },
  { key: 'resvech',    nombre: 'RESVECH',    titulo: 'RESVECH — Heridas',               descripcion: 'Complejidad de heridas' },
  { key: 'fois',       nombre: 'FOIS',       titulo: 'FOIS — Fonoaudiología',           descripcion: 'Functional Oral Intake Scale' },
  { key: 'fragilidad', nombre: 'Fragilidad', titulo: 'Escala Clínica de Fragilidad',    descripcion: 'Clinical Frailty Scale' },
  { key: 'necpal',     nombre: 'NECPAL',     titulo: 'NECPAL — Cuidado paliativo',      descripcion: 'Necesidades paliativas' },
  { key: 'papscore',   nombre: 'PAPSCORE',   titulo: 'PAPSCORE — Pronóstico paliativo', descripcion: 'Palliative Prognostic Score' },
]

export const MESES: Record<number, string> = {
  1: 'Enero', 2: 'Febrero', 3: 'Marzo', 4: 'Abril',
  5: 'Mayo', 6: 'Junio', 7: 'Julio', 8: 'Agosto',
  9: 'Septiembre', 10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
}

export interface Filtros {
  corte: string | null          // fecha_corte del snapshot mensual (null = más reciente)
  sexo: string[]
  anio: number | null
  mes: number | null
  aseguradora: string[]
  sede: string[]
  especialidad: string[]
  profesional: string[]
  estado: string[]            // Activo / Egresado / Fallecido
  largaEstancia: string | null // 'Si' | 'No' | null
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
  descripcion: string
  updated_at: string
}

export interface SyncLog {
  id: string
  executed_at: string
  status: 'success' | 'error' | 'partial'
  records_fetched: number
  records_upserted: number
  duration_ms: number | null
  error_message: string | null
  sync_from: string | null
  sync_to: string | null
  triggered_by: string
}

export interface ReporteEmail {
  id: string
  tipo: string
  destinatarios: string[]
  asunto: string
  cuerpo?: string
  fecha_envio: string
  estado: 'pending' | 'sent' | 'failed'
  error_mensaje?: string
}
