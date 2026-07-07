'use strict';

/**
 * sync/index.js — BI Gestión Clínica
 * Sincronización: GoMedisys (Azure SQL) → Supabase
 *
 * Modos (env):
 *   MODE=initial  → backfill de los últimos MONTHS_BACK meses (default 6)
 *   MODE=daily    → meses tocados por la ventana de DAYS_BACK días (default 35):
 *                   refresca el mes en curso y re-cierra el anterior.
 *
 * Modelo de snapshots mensuales: la query se ejecuta UNA VEZ POR MES
 * (@StartDate = inicio de mes, @EndDate = fin de mes o hoy si es el mes en
 * curso) y el upsert es por (ingreso, fecha_corte) con fecha_corte = último
 * día del mes. Los meses cerrados quedan congelados como histórico; el mes
 * en curso se refresca en cada corrida (estancia calculada hasta @EndDate).
 */

const sql = require('mssql');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const fs = require('fs');
const path = require('path');

const COLOMBIA_OFFSET_H = -5;

function todayColombia() {
  const d = new Date(Date.now() + COLOMBIA_OFFSET_H * 3_600_000);
  return d.toISOString().substring(0, 10);
}

function dateMinus(base, { days = 0, months = 0 }) {
  const d = new Date(base + 'T00:00:00Z');
  if (months) d.setUTCMonth(d.getUTCMonth() - months);
  if (days) d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().substring(0, 10);
}

/**
 * Meses (snapshots) que cubre el rango [from, to]:
 * [{ start: '2026-05-01', end: '2026-05-31', corte: '2026-05-31' }, ...]
 * Para el mes en curso, end se recorta a 'to' (hoy) pero el corte sigue
 * siendo el fin de mes: ese snapshot se refresca hasta que el mes cierre.
 */
function monthWindows(from, to) {
  const windows = [];
  let y = parseInt(from.substring(0, 4), 10);
  let m = parseInt(from.substring(5, 7), 10);
  const yTo = parseInt(to.substring(0, 4), 10);
  const mTo = parseInt(to.substring(5, 7), 10);

  while (y < yTo || (y === yTo && m <= mTo)) {
    const start = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).toISOString().substring(0, 10); // día 0 del mes siguiente
    windows.push({ start, end: lastDay < to ? lastDay : to, corte: lastDay });
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return windows;
}

// ── Transformación ─────────────────────────────────────────────────────────

function toDateStr(val) {
  if (val == null) return null;
  if (val instanceof Date) return isNaN(val) ? null : val.toISOString().substring(0, 10);
  const s = String(val).trim().substring(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function toInt(val) {
  if (val == null || val === '') return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toNum(val) {
  if (val == null || val === '') return null;
  const n = parseFloat(String(val).replace(',', '.'));
  return isNaN(n) ? null : n;
}

function toText(val) {
  if (val == null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

function mapRow(r, fechaCorte) {
  return {
    fecha_corte:             fechaCorte,
    sede:                    toText(r['Sede']),
    ingreso:                 toInt(r['Ingreso']),
    fecha_ingreso:           toDateStr(r['FechaIngreso']),
    aseguradora:             toText(r['Aseguradora']),
    identificacion_paciente: toText(r['IdentificacionPaciente']),
    nombre_paciente:         toText(r['NombrePaciente']),

    fecha_primera_atencion:       toDateStr(r['Fecha Primer Atencion Gestion Clinica']),
    especialidad_primera:         toText(r['Especialidad Primera Atencion Gestion Clinica']),
    profesional_primera:          toText(r['Profesional Primera valoracion Gestion Clinica']),
    ubicacion_primera:            toText(r['Ubicacion Primera Atencion Gestion Clinica']),
    esquema_historia_primera:     toText(r['Esquema Historia Primera Valoracion Gestion Clinica']),
    primer_tipo_intervencion:     toText(r['PrimerTipoDeIntervencion']),
    primer_causas_larga_estancia: toText(r['PrimerCausasLargaEstancia']),
    comentario_primera:           toText(r['Comentario Primera Atencion Gestion Clinica']),

    fecha_ultima_valoracion:      toDateStr(r['Fecha Ultima valoracion Gestion Clinica']),
    especialidad_ultima:          toText(r['Especialidad Ultima Valoracion Gestion Clinica']),
    profesional_ultima:           toText(r['Profesional Ultima Valoracion Gestion Clinica']),
    ubicacion_ultima:             toText(r['Ubicacion Ultima Valoracion Gestion Clinica']),
    esquema_historia_ultima:      toText(r['Esquema Historia Ultima Valoracion Gestion Clinica']),
    ultimo_tipo_intervencion:     toText(r['UltimoTipoDeIntervencion']),
    ultimo_causas_larga_estancia: toText(r['UltimoCausasLargaEstancia']),
    comentario_ultima:            toText(r['Comentario Ultima Atencion Gestion Clinica']),

    cantidad_atenciones:        toInt(r['Cantidad Atenciones Gestion Clinica']),
    estancia_total:             toInt(r['EstanciaTotal(HastaUltimoDiaMes)']),
    estancia_mayor_20_dias:     toText(r['EstanciaMayor20Dias']),
    fecha_egreso:               toDateStr(r['FechaEgreso']),
    diferencia_dias_ultima_val: toInt(r['DiferenciaDiasUltimaValoracion']),
    servicio_egreso:            toText(r['ServicioEgreso']),
    destino_ultima_atencion:    toText(r['DestinoUltimaAtencion']),
    fecha_fallecido:            toDateStr(r['FechaFallecido']),

    cam_fecha:      toDateStr(r['FECHA escala CAM']),
    cam_valoracion: toText(r['VALORACION escala CAM']),
    cam_resultado:  toText(r['RESULTADO escala CAM']),

    esas_fecha:            toDateStr(r['FECHA escala ESAS']),
    sas_dolor:             toNum(r['SAS_Dolor']),
    sas_cansancio:         toNum(r['SAS_Cansancio']),
    sas_nauseas:           toNum(r['SAS_Nauseas']),
    sas_depresion:         toNum(r['SAS_Depresion']),
    sas_ansiedad:          toNum(r['SAS_Ansiedad']),
    sas_somnolencia:       toNum(r['SAS_Somnolencia']),
    sas_apetito:           toNum(r['SAS_Apetito']),
    sas_bienestar:         toNum(r['SAS_Bienestar']),
    sas_falta_aire:        toNum(r['SAS_FaltaDeAire']),
    sas_dificultad_dormir: toNum(r['SAS_DificultadParaDormir']),

    necpal_fecha:      toDateStr(r['FECHA escala NECPAL']),
    necpal_valoracion: toText(r['VALORACION escala NECPAL']),
    necpal_resultado:  toText(r['RESULTADO escala NECPAL']),

    papscore_fecha:      toDateStr(r['FECHA escala PAPSCORE']),
    papscore_valoracion: toText(r['VALORACION escala PAPSCORE']),
    papscore_resultado:  toText(r['RESULTADO escala PAPSCORE']),

    fragilidad_fecha:      toDateStr(r['FECHA escala Fragilidad']),
    fragilidad_valoracion: toText(r['VALORACION escala Fragilidad']),
    fragilidad_resultado:  toText(r['RESULTADO escala Fragilidad']),

    fois_fecha:      toDateStr(r['FECHA escala Fois']),
    fois_valoracion: toText(r['VALORACION escala Fois']),
    fois_resultado:  toText(r['RESULTADO escala Fois']),

    resvech_fecha:      toDateStr(r['FECHA escala RESVECH']),
    resvech_valoracion: toText(r['VALORACION escala RESVECH']),
    resvech_resultado:  toText(r['RESULTADO escala RESVECH']),

    mna_fecha:      toDateStr(r['FECHA escala MNA']),
    mna_valoracion: toText(r['VALORACION escala MNA']),
    mna_resultado:  toText(r['RESULTADO escala MNA']),

    yesavage_fecha:      toDateStr(r['FECHA escala YESAVAGE']),
    yesavage_valoracion: toText(r['VALORACION escala YESAVAGE']),
    yesavage_resultado:  toText(r['RESULTADO escala YESAVAGE']),

    gijon_fecha:      toDateStr(r['FECHA escala GIJON']),
    gijon_valoracion: toText(r['VALORACION escala GIJON']),
    gijon_resultado:  toText(r['RESULTADO escala GIJON']),

    barthel_previo_fecha:      toDateStr(r['FECHA Evaluacion Barthel Previo']),
    barthel_previo_valoracion: toText(r['VALORACION Evaluacion Barthel Previo']),
    barthel_previo_resultado:  toText(r['RESULTADO Evaluacion Barthel Previo']),
    barthel_actual_fecha:      toDateStr(r['FECHA Evaluacion Barthel Actual']),
    barthel_actual_valoracion: toText(r['VALORACION Evaluacion Barthel Actual']),
    barthel_actual_resultado:  toText(r['RESULTADO Evaluacion Barthel Actual']),
    barthel_egreso_fecha:      toDateStr(r['FECHA Evaluacion Barthel Egreso']),
    barthel_egreso_valoracion: toText(r['VALORACION Evaluacion Barthel Egreso']),
    barthel_egreso_resultado:  toText(r['RESULTADO Evaluacion Barthel Egreso']),

    idc_fecha:                 toDateStr(r['FechaEscalaIDC']),
    idc_intervencion_recursos: toText(r['IntervencionRecursosEspecificosIDC']),
    idc_estado_situacion:      toText(r['EstadoSituacionIDC']),

    fecha_nacimiento:        toDateStr(r['FechaNacimiento']),
    edad:                    toInt(r['Edad']),
    sexo:                    toText(r['Sexo']),
    estado_civil:            toText(r['EstadoCivil']),
    municipio_residencia:    toText(r['MunicipioResidencia']),
    departamento_residencia: toText(r['DepartamentoResidencia']),
    zona_residencia:         toText(r['ZonaResidencia']),
    dx_principal_codigo:     toText(r['CodigoDiagnosticoPrincipal']),
    dx_principal_nombre:     toText(r['NombreDiagnosticoPrincipal']),
    servicio_actual:         toText(r['ServicioActual']),
  };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now();
  const triggeredBy = process.env.TRIGGERED_BY || 'cron';
  const mode = (process.env.MODE || 'daily').toLowerCase();

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false }, realtime: { transport: ws } }
  );

  const end = todayColombia();
  const start = mode === 'initial'
    ? dateMinus(end, { months: parseInt(process.env.MONTHS_BACK || '6', 10) })
    : dateMinus(end, { days: parseInt(process.env.DAYS_BACK || '35', 10) });

  const windows = monthWindows(start, end);
  console.log(`[sync] Modo: ${mode} | Rango: ${start} → ${end} | Snapshots: ${windows.map(w => w.corte).join(', ')} | Por: ${triggeredBy}`);

  let recordsFetched = 0;
  let recordsUpserted = 0;
  let errorMessage = null;
  let status = 'success';
  let pool;

  try {
    pool = await sql.connect({
      server:   process.env.GOMEDISYS_HOST,
      port:     parseInt(process.env.GOMEDISYS_PORT || '1433', 10),
      database: process.env.GOMEDISYS_DATABASE,
      user:     process.env.GOMEDISYS_USERNAME,
      password: process.env.GOMEDISYS_PASSWORD,
      options: {
        encrypt: true,
        trustServerCertificate: false,
        connectTimeout: 30_000,
        // Parche temporal (2026-07-07): el query venia degradando (88s -> 600s+
        // en un mes) porque a GoMedisys le faltan los indices recomendados en
        // query.sql (EHREvents crece con TODA la actividad del hospital, no
        // solo Gestion Clinica). Subir el timeout solo compra tiempo; el fix
        // real es crear esos indices en el servidor de GoMedisys.
        requestTimeout: 1_200_000,   // 20 min
      },
    });
    console.log('[sync] Conexión a GoMedisys establecida');

    const querySQL = fs.readFileSync(path.join(__dirname, 'query.sql'), 'utf8');

    for (const win of windows) {
      console.log(`[sync] Snapshot ${win.corte}: consultando ${win.start} → ${win.end}…`);
      const req = pool.request();
      req.input('StartDate', sql.Date, win.start);
      req.input('EndDate',   sql.Date, win.end);

      const result = await req.query(querySQL);
      recordsFetched += result.recordset.length;
      console.log(`[sync] Snapshot ${win.corte}: ${result.recordset.length} registros`);

      const rows = result.recordset
        .map(r => mapRow(r, win.corte))
        .filter(r => r.ingreso !== null);

      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { error } = await supabase
          .from('valoraciones')
          .upsert(batch, { onConflict: 'ingreso,fecha_corte' });

        if (error) throw new Error(`Supabase upsert (${win.corte}): ${error.message}`);
        recordsUpserted += batch.length;
      }
      console.log(`[sync] Snapshot ${win.corte}: upsert completo (${rows.length} filas)`);
    }

  } catch (err) {
    console.error('[sync] ERROR:', err.message);
    errorMessage = err.message;
    status = recordsUpserted > 0 ? 'partial' : 'error';

  } finally {
    if (pool) await pool.close().catch(() => {});
  }

  const duration = Date.now() - t0;
  const { error: logErr } = await supabase.from('sync_logs').insert({
    status,
    records_fetched:  recordsFetched,
    records_upserted: recordsUpserted,
    duration_ms:      duration,
    error_message:    errorMessage,
    sync_from:        start,
    sync_to:          end,
    triggered_by:     `${triggeredBy} (${mode})`,
  });
  if (logErr) console.error('[sync] No se pudo guardar el log:', logErr.message);

  console.log(`[sync] Finalizado: ${status} | obtenidos=${recordsFetched} actualizados=${recordsUpserted} duración=${duration}ms`);

  if (status === 'error') process.exit(1);
}

main().catch(err => {
  console.error('[sync] Error fatal:', err);
  process.exit(1);
});
