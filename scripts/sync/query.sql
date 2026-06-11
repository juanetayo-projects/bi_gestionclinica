/* ============================================================================
   GESTION CLINICA - Script completo optimizado (GoMedisys / SQL Server)
   Reemplaza a scriptcompleto.sql. Ejecutar como un solo lote.

   CAMBIOS PRINCIPALES
   1. PASO 0 nuevo: se materializa primero #Encuentros (solo la empresa y el
      periodo del reporte, con estancia y fecha de ingreso real ya calculadas).
      Todas las temporales de eventos se unen a esa lista, en lugar de extraer
      la historia completa de TODOS los pacientes de TODAS las empresas.
   2. #EncounterEHREvents eliminada: era la misma consulta pesada que
      #AllEncounterEHREvents ejecutada dos veces; solo se usaba en un EXISTS.
   3. #AllEncounterCounts ya no re-escanea EHREvents: se deriva de
      #AllEncounterEHREvents con COUNT(DISTINCT idEHREvent).
   4. CORRECCION (posible bug del original): en #AllScales y
      #BarthelEvaluations se agrego ESCALA.idScale = MS.idScale. Sin esa
      condicion, si un evento registra varias escalas, SUM(value) sumaba las
      preguntas de TODAS las escalas del evento (puntaje inflado).
      >> VALIDAR: los valores de escala pueden cambiar vs. el reporte previo;
         el valor nuevo es el correcto.
   5. Se quito idScale 11 (Barthel) de #AllScales: el SELECT final nunca lo
      consumia (Barthel sale de #BarthelEvaluations).
   6. SELECT final: 26 LEFT JOINs repetidos a temporales reemplazados por 4
      pivotes; subconsultas escalares reemplazadas por JOIN/APPLY; WHERE de
      fechas SARGable; joins muertos eliminados (diagnostics, EncounterCounts,
      physicalLocations pl -- OJO: pl era INNER JOIN y filtraba encuentros sin
      idActualLocation valido; si ese filtro era intencional, restaurarlo).
   7. Parametrizado: fechas, empresa y perfil como variables.
   8. Indices en las temporales tras poblarlas.

   REVISAR (heredado del original):
   - idc_fecha e idc_intervencion usan ambos idElement = 4; verificar si la
     fecha IDC deberia venir de otro elemento.
   - Los "ultimos" registros (rn = 1) se ordenan solo por fecha: si hay dos
     eventos con la misma fecha/hora el resultado puede variar entre
     ejecuciones. Si ocurre, agregar idEHREvent DESC como desempate.

   INDICES RECOMENDADOS EN GOMEDISYS (si hay permisos; si no, el PASO 0 ya
   reduce el costo igual):
     EHREvents (idEncounter) INCLUDE (idEHREvent, idAction, actionRecordedDate, idPractitioner, idSpeciality, idPatientLocation)
     EHREvents (idAction, idPractitioner) INCLUDE (idEncounter, idEHREvent, actionRecordedDate)
     EHREventCustomActivities (idEvent, idConfigActivity, idElement)
     encounters (idUserCompany, idStatus, dateStart) INCLUDE (dateDischarge, idEncounterPartOf)
     encounters (idEncounterPartOf)
     encounterHistoricalRecords (idEncounter, idRecord) INCLUDE (idLocation)
   ========================================================================= */

SET NOCOUNT ON;

DECLARE @idCompany     INT      = 108240;
DECLARE @idProfile     INT      = 472;            -- perfil gestion clinica
DECLARE @FechaInicio   DATE     = @StartDate;     -- inicio del periodo (parametro)
DECLARE @FechaCorte    DATE     = @EndDate;       -- fin del periodo (parametro)
DECLARE @FechaCorteFin DATETIME = DATEADD(DAY, 1, CAST(@FechaCorte AS DATETIME)); -- limite exclusivo

IF OBJECT_ID('tempdb..#Encuentros')            IS NOT NULL DROP TABLE #Encuentros;
IF OBJECT_ID('tempdb..#AllEncounterEHREvents') IS NOT NULL DROP TABLE #AllEncounterEHREvents;
IF OBJECT_ID('tempdb..#AllEncounterCounts')    IS NOT NULL DROP TABLE #AllEncounterCounts;
IF OBJECT_ID('tempdb..#CustomActivities')      IS NOT NULL DROP TABLE #CustomActivities;
IF OBJECT_ID('tempdb..#AllScales')             IS NOT NULL DROP TABLE #AllScales;
IF OBJECT_ID('tempdb..#SASAnswers')            IS NOT NULL DROP TABLE #SASAnswers;
IF OBJECT_ID('tempdb..#BarthelEvaluations')    IS NOT NULL DROP TABLE #BarthelEvaluations;
IF OBJECT_ID('tempdb..#IDCActivities')         IS NOT NULL DROP TABLE #IDCActivities;

/* ---------------------------------------------------------------------------
   PASO 0: universo de encuentros del reporte (empresa + periodo + no-padres)
   con fecha de ingreso real (del padre si existe) y estancia precalculada.
   Todo lo demas se une contra esta tabla.
--------------------------------------------------------------------------- */
SELECT
    e.idEncounter,
    e.identifier,
    e.idOffice,
    e.idUserPatient,
    e.idStatus,
    e.dateStart,
    e.dateDischarge,
    CAST(COALESCE(ep.dateStart, e.dateStart) AS DATE) AS fechaIngresoReal,
    CAST(DATEDIFF(HOUR,
            COALESCE(ep.dateStart, e.dateStart),
            CASE WHEN e.idStatus = 4
                 THEN IIF(e.dateDischarge > @FechaCorte, CAST(@FechaCorte AS DATETIME), e.dateDischarge)
                 ELSE CAST(@FechaCorte AS DATETIME)
            END
        ) / 24.0 AS DECIMAL(5,1)) AS EstanciaTotal
INTO #Encuentros
FROM encounters e
    LEFT JOIN encounters ep ON ep.idEncounter = e.idEncounterPartOf
WHERE e.idUserCompany = @idCompany
    AND e.idStatus NOT IN (1,5)
    -- solapamiento del encuentro con [@FechaInicio, @FechaCorte], SARGable
    AND e.dateStart < @FechaCorteFin
    AND (e.dateDischarge IS NULL OR e.dateDischarge >= @FechaInicio)
    -- excluir encuentros que son padres de otro encuentro
    AND NOT EXISTS (
        SELECT 1 FROM encounters eo WHERE eo.idEncounterPartOf = e.idEncounter
    );

CREATE UNIQUE CLUSTERED INDEX IX_Encuentros ON #Encuentros (idEncounter);

/* ---------------------------------------------------------------------------
   PASO 1: eventos de gestion clinica (UNA sola pasada; antes se ejecutaba
   dos veces para #EncounterEHREvents y #AllEncounterEHREvents).
--------------------------------------------------------------------------- */
SELECT
    ehre.idEncounter,
    ehre.idEHREvent,
    ehre.actionRecordedDate,
    ehre.idAction,
    gs.name  AS specialty_name,
    plrc.name AS location_name,
    ga.name  AS action_name,
    CONCAT(u2.givenName, ' ', u2.familyName) AS practitioner_name,
    ehremc.medicalConcept,
    ROW_NUMBER() OVER (PARTITION BY ehre.idEncounter ORDER BY ehre.actionRecordedDate ASC)  AS FirstEventRn,
    ROW_NUMBER() OVER (PARTITION BY ehre.idEncounter ORDER BY ehre.actionRecordedDate DESC) AS LastEventRn,
    MAX(CASE WHEN ehre.idAction = 398 THEN ca_398.valueText END) OVER (PARTITION BY ehre.idEncounter) AS comentario_398,
    MAX(CASE WHEN ehre.idAction = 401 THEN ca_401.valueText END) OVER (PARTITION BY ehre.idEncounter) AS comentario_401,
    MAX(CASE WHEN ehre.idAction = 532 THEN ca_532.valueText END) OVER (PARTITION BY ehre.idEncounter) AS comentario_532
INTO #AllEncounterEHREvents
FROM EHREvents ehre
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehre.idEncounter
    INNER JOIN userProfiles up ON ehre.idPractitioner = up.idUser AND up.idProfile = @idProfile
    INNER JOIN users u2 ON up.idUser = u2.idUser
    LEFT JOIN generalSpecialties gs ON gs.idSpecialty = ehre.idSpeciality
    LEFT JOIN physicalLocations plrc ON plrc.idPhysicalLocation = ehre.idPatientLocation
    LEFT JOIN generalActions ga ON ehre.idAction = ga.idAction
    LEFT JOIN EHREventMedicalConcept ehremc ON ehre.idEHREvent = ehremc.idEHREvent
    LEFT JOIN EHREventCustomActivities ca_398 ON ca_398.idEvent = ehre.idEHREvent AND ca_398.idConfigActivity = 614
    LEFT JOIN EHREventCustomActivities ca_401 ON ca_401.idEvent = ehre.idEHREvent AND ca_401.idConfigActivity = 615
    LEFT JOIN EHREventCustomActivities ca_532 ON ca_532.idEvent = ehre.idEHREvent AND ca_532.idConfigActivity = 393
WHERE ehre.idAction IN (398,401,532,607,608);

CREATE CLUSTERED INDEX IX_AllEvents ON #AllEncounterEHREvents (idEncounter);

/* ---------------------------------------------------------------------------
   PASO 2: conteo de atenciones, derivado del PASO 1 (antes: tercer escaneo
   completo de EHREvents). COUNT(DISTINCT idEHREvent) replica el conteo
   original aunque los LEFT JOIN de comentarios dupliquen filas.
--------------------------------------------------------------------------- */
SELECT
    idEncounter,
    COUNT(DISTINCT idEHREvent) AS total_atenciones_count
INTO #AllEncounterCounts
FROM #AllEncounterEHREvents
GROUP BY idEncounter;

CREATE UNIQUE CLUSTERED INDEX IX_Counts ON #AllEncounterCounts (idEncounter);

/* ---------------------------------------------------------------------------
   PASO 3: actividades personalizadas (tipo de intervencion / causas larga
   estancia), restringidas al universo de encuentros.
--------------------------------------------------------------------------- */
SELECT
    ehre_gc.idEncounter,
    ehre_gc.actionRecordedDate,
    ehreca_gc.idElement,
    ehreca_gc.valueText,
    CASE
        WHEN ehreca_gc.idElement = 2 THEN 'Geriatria'
        WHEN ehreca_gc.idElement = 3 THEN 'Cuidado Paliativo'
        WHEN ehreca_gc.idElement = 4 THEN 'Larga Estancia'
        WHEN ehreca_gc.idElement = 5 THEN 'Intervencion Familiar'
        WHEN ehreca_gc.idElement = 6 THEN 'Comite de larga estancia'
        ELSE ehreca_gc.valueText
    END AS formatted_info,
    CASE
        WHEN ehreca_gc.idElement = 8  THEN 'Barreras administrativas'
        WHEN ehreca_gc.idElement = 9  THEN 'Condiciones Clinicas'
        WHEN ehreca_gc.idElement = 10 THEN 'Condiciones Sociales'
        WHEN ehreca_gc.idElement = 11 THEN 'Sin riesgo'
        ELSE ehreca_gc.valueText
    END AS formatted_causes
INTO #CustomActivities
FROM EHREventCustomActivities ehreca_gc
    INNER JOIN EHREvents ehre_gc ON ehreca_gc.idEvent = ehre_gc.idEHREvent
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehre_gc.idEncounter
    INNER JOIN userProfiles up ON ehre_gc.idPractitioner = up.idUser AND up.idProfile = @idProfile
WHERE ehreca_gc.idConfigActivity = 718
    AND ehre_gc.idAction IN (398,401,532,607,608)
    AND ehreca_gc.idElement IN (2,3,4,5,6,8,9,10,11)
    AND ehreca_gc.valueText IS NOT NULL;

CREATE CLUSTERED INDEX IX_CustomAct ON #CustomActivities (idEncounter, idElement, actionRecordedDate);

/* ---------------------------------------------------------------------------
   PASO 4: escalas. CORRECCION: ESCALA.idScale = MS.idScale (antes sumaba las
   preguntas de TODAS las escalas del evento). Se quito idScale 11 (no se usa).
--------------------------------------------------------------------------- */
SELECT
    ehr.idEncounter,
    ehr.actionRecordedDate,
    MS.idScale,
    CF.name AS scale_result,
    SUM(ESCALA.[value]) AS scale_value,
    ROW_NUMBER() OVER (PARTITION BY ehr.idEncounter, MS.idScale ORDER BY ehr.actionRecordedDate DESC) AS rn
INTO #AllScales
FROM EHREvents ehr
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehr.idEncounter
    INNER JOIN EHREventMedicalScales MS ON ehr.idEHREvent = MS.idEHREvent
    INNER JOIN EHRConfScaleValorations CF ON MS.idEvaluation = CF.idRecord AND MS.idScale = CF.idScale
    INNER JOIN EHREventMedicalScaleQuestions ESCALA ON ehr.idEHREvent = ESCALA.idEHREvent
        AND ESCALA.idScale = MS.idScale
WHERE MS.idScale IN (8,40,36,37,104,107,110,102,109,106)
GROUP BY ehr.idEncounter, ehr.actionRecordedDate, MS.idScale, CF.name;

CREATE CLUSTERED INDEX IX_AllScales ON #AllScales (idEncounter, idScale, rn);

/* ---------------------------------------------------------------------------
   PASO 5: respuestas SAS (escala ESAS, preguntas 1-10).
--------------------------------------------------------------------------- */
SELECT
    ehr.idEncounter,
    ESCALA.idQuestion,
    RESPUESTA.description AS sas_answer,
    ROW_NUMBER() OVER (PARTITION BY ehr.idEncounter, ESCALA.idQuestion ORDER BY ehr.actionRecordedDate DESC) AS rn
INTO #SASAnswers
FROM EHREvents ehr
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehr.idEncounter
    INNER JOIN EHREventMedicalScaleQuestions ESCALA ON ehr.idEHREvent = ESCALA.idEHREvent
    INNER JOIN EHRConfScaleQuestionAnswers RESPUESTA ON ESCALA.idScale = RESPUESTA.idScale
        AND ESCALA.idQuestion = RESPUESTA.idQuestion
        AND ESCALA.idAnswer = RESPUESTA.idAnswer
WHERE ESCALA.idScale = 40
    AND ESCALA.idQuestion BETWEEN 1 AND 10;

CREATE CLUSTERED INDEX IX_SAS ON #SASAnswers (idEncounter, idQuestion, rn);

/* ---------------------------------------------------------------------------
   PASO 6: Barthel (previo/actual/egreso). Misma correccion de idScale.
--------------------------------------------------------------------------- */
SELECT
    ehr.idEncounter,
    ehr.actionRecordedDate,
    ehreca.valueNumeric AS evaluation_type,
    CF.name AS scale_result,
    SUM(ESCALA.[value]) AS scale_value,
    ROW_NUMBER() OVER (PARTITION BY ehr.idEncounter, ehreca.valueNumeric ORDER BY ehr.actionRecordedDate DESC) AS rn
INTO #BarthelEvaluations
FROM EHREvents ehr
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehr.idEncounter
    INNER JOIN EHREventCustomActivities ehreca ON ehr.idEHREvent = ehreca.idEvent
    INNER JOIN EHREventMedicalScales MS ON ehr.idEHREvent = MS.idEHREvent
    INNER JOIN EHRConfScaleValorations CF ON MS.idEvaluation = CF.idRecord AND MS.idScale = CF.idScale
    INNER JOIN EHREventMedicalScaleQuestions ESCALA ON ehr.idEHREvent = ESCALA.idEHREvent
        AND ESCALA.idScale = MS.idScale
WHERE ehreca.idConfigActivity = 717
    AND ehreca.idElement = 1
    AND ehreca.valueNumeric IN (4729, 4730, 4731) -- Previo, Actual, Egreso
    AND MS.idScale = 11 -- Escala Barthel
GROUP BY ehr.idEncounter, ehr.actionRecordedDate, ehreca.valueNumeric, CF.name;

CREATE CLUSTERED INDEX IX_Barthel ON #BarthelEvaluations (idEncounter, evaluation_type, rn);

/* ---------------------------------------------------------------------------
   PASO 7: actividades IDC.
--------------------------------------------------------------------------- */
SELECT
    ehr.idEncounter,
    ehr.actionRecordedDate,
    ehreca.idElement,
    ehreca.valueText,
    ROW_NUMBER() OVER (PARTITION BY ehr.idEncounter, ehreca.idElement ORDER BY ehr.actionRecordedDate DESC) AS rn
INTO #IDCActivities
FROM EHREvents ehr
    INNER JOIN #Encuentros enc ON enc.idEncounter = ehr.idEncounter
    INNER JOIN EHREventCustomActivities ehreca ON ehr.idEHREvent = ehreca.idEvent
WHERE ehreca.idConfigActivity = 459
    AND ehreca.idElement IN (4, 5);

CREATE CLUSTERED INDEX IX_IDC ON #IDCActivities (idEncounter, idElement, rn);

/* ===========================================================================
   SELECT FINAL
   ========================================================================= */
WITH
CustomFechas AS (
    SELECT
        idEncounter,
        MIN(CASE WHEN idElement IN (2,3,4,5,6)  THEN actionRecordedDate END) AS info_primera,
        MAX(CASE WHEN idElement IN (2,3,4,5,6)  THEN actionRecordedDate END) AS info_ultima,
        MIN(CASE WHEN idElement IN (8,9,10,11)  THEN actionRecordedDate END) AS causas_primera,
        MAX(CASE WHEN idElement IN (8,9,10,11)  THEN actionRecordedDate END) AS causas_ultima
    FROM #CustomActivities
    GROUP BY idEncounter
),
CustomAgg AS (
    SELECT
        ca.idEncounter,
        STRING_AGG(CASE WHEN ca.idElement IN (2,3,4,5,6) AND ca.actionRecordedDate = cf.info_primera   THEN ca.formatted_info   END, ', ') AS primera_info,
        STRING_AGG(CASE WHEN ca.idElement IN (2,3,4,5,6) AND ca.actionRecordedDate = cf.info_ultima    THEN ca.formatted_info   END, ', ') AS ultima_info,
        STRING_AGG(CASE WHEN ca.idElement IN (8,9,10,11) AND ca.actionRecordedDate = cf.causas_primera THEN ca.formatted_causes END, ', ') AS primera_causas,
        STRING_AGG(CASE WHEN ca.idElement IN (8,9,10,11) AND ca.actionRecordedDate = cf.causas_ultima  THEN ca.formatted_causes END, ', ') AS ultima_causas
    FROM #CustomActivities ca
    INNER JOIN CustomFechas cf ON cf.idEncounter = ca.idEncounter
    GROUP BY ca.idEncounter
),
ScalesPivot AS (
    SELECT
        idEncounter,
        MAX(CASE WHEN idScale = 8   THEN actionRecordedDate END) AS cam_fecha,
        MAX(CASE WHEN idScale = 8   THEN scale_value        END) AS cam_valor,
        MAX(CASE WHEN idScale = 8   THEN scale_result       END) AS cam_resultado,
        MAX(CASE WHEN idScale = 40  THEN actionRecordedDate END) AS esas_fecha,
        MAX(CASE WHEN idScale = 36  THEN actionRecordedDate END) AS necpal_fecha,
        MAX(CASE WHEN idScale = 36  THEN scale_value        END) AS necpal_valor,
        MAX(CASE WHEN idScale = 36  THEN scale_result       END) AS necpal_resultado,
        MAX(CASE WHEN idScale = 37  THEN actionRecordedDate END) AS papscore_fecha,
        MAX(CASE WHEN idScale = 37  THEN scale_value        END) AS papscore_valor,
        MAX(CASE WHEN idScale = 37  THEN scale_result       END) AS papscore_resultado,
        MAX(CASE WHEN idScale = 104 THEN actionRecordedDate END) AS fragilidad_fecha,
        MAX(CASE WHEN idScale = 104 THEN scale_value        END) AS fragilidad_valor,
        MAX(CASE WHEN idScale = 104 THEN scale_result       END) AS fragilidad_resultado,
        MAX(CASE WHEN idScale = 107 THEN actionRecordedDate END) AS fois_fecha,
        MAX(CASE WHEN idScale = 107 THEN scale_value        END) AS fois_valor,
        MAX(CASE WHEN idScale = 107 THEN scale_result       END) AS fois_resultado,
        MAX(CASE WHEN idScale = 110 THEN actionRecordedDate END) AS resvech_fecha,
        MAX(CASE WHEN idScale = 110 THEN scale_value        END) AS resvech_valor,
        MAX(CASE WHEN idScale = 110 THEN scale_result       END) AS resvech_resultado,
        MAX(CASE WHEN idScale = 102 THEN actionRecordedDate END) AS mna_fecha,
        MAX(CASE WHEN idScale = 102 THEN scale_value        END) AS mna_valor,
        MAX(CASE WHEN idScale = 102 THEN scale_result       END) AS mna_resultado,
        MAX(CASE WHEN idScale = 109 THEN actionRecordedDate END) AS yesavage_fecha,
        MAX(CASE WHEN idScale = 109 THEN scale_value        END) AS yesavage_valor,
        MAX(CASE WHEN idScale = 109 THEN scale_result       END) AS yesavage_resultado,
        MAX(CASE WHEN idScale = 106 THEN actionRecordedDate END) AS gijon_fecha,
        MAX(CASE WHEN idScale = 106 THEN scale_value        END) AS gijon_valor,
        MAX(CASE WHEN idScale = 106 THEN scale_result       END) AS gijon_resultado
    FROM #AllScales
    WHERE rn = 1
    GROUP BY idEncounter
),
SASPivot AS (
    SELECT
        idEncounter,
        MAX(CASE WHEN idQuestion = 1  THEN sas_answer END) AS sas_dolor,
        MAX(CASE WHEN idQuestion = 2  THEN sas_answer END) AS sas_cansancio,
        MAX(CASE WHEN idQuestion = 3  THEN sas_answer END) AS sas_nauseas,
        MAX(CASE WHEN idQuestion = 4  THEN sas_answer END) AS sas_depresion,
        MAX(CASE WHEN idQuestion = 5  THEN sas_answer END) AS sas_ansiedad,
        MAX(CASE WHEN idQuestion = 6  THEN sas_answer END) AS sas_somnolencia,
        MAX(CASE WHEN idQuestion = 7  THEN sas_answer END) AS sas_apetito,
        MAX(CASE WHEN idQuestion = 8  THEN sas_answer END) AS sas_bienestar,
        MAX(CASE WHEN idQuestion = 9  THEN sas_answer END) AS sas_falta_aire,
        MAX(CASE WHEN idQuestion = 10 THEN sas_answer END) AS sas_dificultad_dormir
    FROM #SASAnswers
    WHERE rn = 1
    GROUP BY idEncounter
),
BarthelPivot AS (
    SELECT
        idEncounter,
        MAX(CASE WHEN evaluation_type = 4729 THEN actionRecordedDate END) AS previo_fecha,
        MAX(CASE WHEN evaluation_type = 4729 THEN scale_value        END) AS previo_valor,
        MAX(CASE WHEN evaluation_type = 4729 THEN scale_result       END) AS previo_resultado,
        MAX(CASE WHEN evaluation_type = 4730 THEN actionRecordedDate END) AS actual_fecha,
        MAX(CASE WHEN evaluation_type = 4730 THEN scale_value        END) AS actual_valor,
        MAX(CASE WHEN evaluation_type = 4730 THEN scale_result       END) AS actual_resultado,
        MAX(CASE WHEN evaluation_type = 4731 THEN actionRecordedDate END) AS egreso_fecha,
        MAX(CASE WHEN evaluation_type = 4731 THEN scale_value        END) AS egreso_valor,
        MAX(CASE WHEN evaluation_type = 4731 THEN scale_result       END) AS egreso_resultado
    FROM #BarthelEvaluations
    WHERE rn = 1
    GROUP BY idEncounter
),
IDCPivot AS (
    SELECT
        idEncounter,
        MAX(CASE WHEN idElement = 4 THEN actionRecordedDate END) AS idc_fecha,        -- REVISAR: mismo idElement que intervencion (heredado del original)
        MAX(CASE WHEN idElement = 4 THEN valueText          END) AS idc_intervencion,
        MAX(CASE WHEN idElement = 5 THEN valueText          END) AS idc_estado
    FROM #IDCActivities
    WHERE rn = 1
    GROUP BY idEncounter
)
SELECT
    co.name AS [Sede],
    enc.identifier AS [Ingreso],
    enc.fechaIngresoReal AS [FechaIngreso],
    ucon.shortBusinessName AS [Aseguradora],
    u.documentNumber AS [IdentificacionPaciente],
    CONCAT(u.givenName, ' ', u.familyName) AS [NombrePaciente],
    CAST(fe.actionRecordedDate AS DATE) AS [Fecha Primer Atencion Gestion Clinica],
    fe.specialty_name AS [Especialidad Primera Atencion Gestion Clinica],
    fe.practitioner_name AS [Profesional Primera valoracion Gestion Clinica],
    fe.location_name AS [Ubicacion Primera Atencion Gestion Clinica],
    fe.action_name AS [Esquema Historia Primera Valoracion Gestion Clinica],
    cagg.primera_info AS [PrimerTipoDeIntervencion],
    cagg.primera_causas AS [PrimerCausasLargaEstancia],
    CASE
        WHEN fe.idAction = 398 THEN fe.comentario_398
        WHEN fe.idAction = 401 THEN fe.comentario_401
        WHEN fe.idAction = 532 THEN fe.comentario_532
        WHEN fe.idAction IN (607,608) THEN fe.medicalConcept
    END AS [Comentario Primera Atencion Gestion Clinica],
    CAST(le.actionRecordedDate AS DATE) AS [Fecha Ultima valoracion Gestion Clinica],
    le.specialty_name AS [Especialidad Ultima Valoracion Gestion Clinica],
    le.practitioner_name AS [Profesional Ultima Valoracion Gestion Clinica],
    le.location_name AS [Ubicacion Ultima Valoracion Gestion Clinica],
    le.action_name AS [Esquema Historia Ultima Valoracion Gestion Clinica],
    cagg.ultima_info AS [UltimoTipoDeIntervencion],
    cagg.ultima_causas AS [UltimoCausasLargaEstancia],
    CASE
        WHEN le.idAction = 398 THEN le.comentario_398
        WHEN le.idAction = 401 THEN le.comentario_401
        WHEN le.idAction = 532 THEN le.comentario_532
        WHEN le.idAction IN (607,608) THEN le.medicalConcept
    END AS [Comentario Ultima Atencion Gestion Clinica],
    aec.total_atenciones_count AS [Cantidad Atenciones Gestion Clinica],
    enc.EstanciaTotal AS [EstanciaTotal(HastaUltimoDiaMes)],
    CASE WHEN enc.EstanciaTotal > 20 THEN 'Si' ELSE 'No' END AS [EstanciaMayor20Dias],
    CAST(enc.dateDischarge AS DATE) AS [FechaEgreso],
    CASE
        WHEN enc.dateDischarge IS NOT NULL AND le.actionRecordedDate IS NOT NULL
        THEN DATEDIFF(DAY, le.actionRecordedDate, enc.dateDischarge)
    END AS [DiferenciaDiasUltimaValoracion],
    servEgreso.name AS [ServicioEgreso],
    ehrced.name AS [DestinoUltimaAtencion],
    CAST(up.deathDate AS DATE) AS [FechaFallecido],

    sp.cam_fecha     AS [FECHA escala CAM],
    sp.cam_valor     AS [VALORACION escala CAM],
    sp.cam_resultado AS [RESULTADO escala CAM],

    sp.esas_fecha    AS [FECHA escala ESAS],

    sas.sas_dolor             AS [SAS_Dolor],
    sas.sas_cansancio         AS [SAS_Cansancio],
    sas.sas_nauseas           AS [SAS_Nauseas],
    sas.sas_depresion         AS [SAS_Depresion],
    sas.sas_ansiedad          AS [SAS_Ansiedad],
    sas.sas_somnolencia       AS [SAS_Somnolencia],
    sas.sas_apetito           AS [SAS_Apetito],
    sas.sas_bienestar         AS [SAS_Bienestar],
    sas.sas_falta_aire        AS [SAS_FaltaDeAire],
    sas.sas_dificultad_dormir AS [SAS_DificultadParaDormir],

    sp.necpal_fecha         AS [FECHA escala NECPAL],
    sp.necpal_valor         AS [VALORACION escala NECPAL],
    sp.necpal_resultado     AS [RESULTADO escala NECPAL],
    sp.papscore_fecha       AS [FECHA escala PAPSCORE],
    sp.papscore_valor       AS [VALORACION escala PAPSCORE],
    sp.papscore_resultado   AS [RESULTADO escala PAPSCORE],
    sp.fragilidad_fecha     AS [FECHA escala Fragilidad],
    sp.fragilidad_valor     AS [VALORACION escala Fragilidad],
    sp.fragilidad_resultado AS [RESULTADO escala Fragilidad],
    sp.fois_fecha           AS [FECHA escala Fois],
    sp.fois_valor           AS [VALORACION escala Fois],
    sp.fois_resultado       AS [RESULTADO escala Fois],
    sp.resvech_fecha        AS [FECHA escala RESVECH],
    sp.resvech_valor        AS [VALORACION escala RESVECH],
    sp.resvech_resultado    AS [RESULTADO escala RESVECH],
    sp.mna_fecha            AS [FECHA escala MNA],
    sp.mna_valor            AS [VALORACION escala MNA],
    sp.mna_resultado        AS [RESULTADO escala MNA],
    sp.yesavage_fecha       AS [FECHA escala YESAVAGE],
    sp.yesavage_valor       AS [VALORACION escala YESAVAGE],
    sp.yesavage_resultado   AS [RESULTADO escala YESAVAGE],
    sp.gijon_fecha          AS [FECHA escala GIJON],
    sp.gijon_valor          AS [VALORACION escala GIJON],
    sp.gijon_resultado      AS [RESULTADO escala GIJON],

    bp.previo_fecha     AS [FECHA Evaluacion Barthel Previo],
    bp.previo_valor     AS [VALORACION Evaluacion Barthel Previo],
    bp.previo_resultado AS [RESULTADO Evaluacion Barthel Previo],
    bp.actual_fecha     AS [FECHA Evaluacion Barthel Actual],
    bp.actual_valor     AS [VALORACION Evaluacion Barthel Actual],
    bp.actual_resultado AS [RESULTADO Evaluacion Barthel Actual],
    bp.egreso_fecha     AS [FECHA Evaluacion Barthel Egreso],
    bp.egreso_valor     AS [VALORACION Evaluacion Barthel Egreso],
    bp.egreso_resultado AS [RESULTADO Evaluacion Barthel Egreso],

    idc.idc_fecha        AS [FechaEscalaIDC],
    idc.idc_intervencion AS [IntervencionRecursosEspecificosIDC],
    idc.idc_estado       AS [EstadoSituacionIDC],

    -- Demografia y diagnostico (para piramide poblacional, CIE-10 y filtros)
    CAST(up.birthDate AS DATE) AS [FechaNacimiento],
    DATEDIFF(YEAR, up.birthDate, @FechaCorte)
      - IIF(DATEADD(YEAR, DATEDIFF(YEAR, up.birthDate, @FechaCorte), up.birthDate) > @FechaCorte, 1, 0)
      AS [Edad],
    sexo.name   AS [Sexo],
    ecivil.name AS [EstadoCivil],
    mun.name    AS [MunicipioResidencia],
    depto.name  AS [DepartamentoResidencia],
    zona.name   AS [ZonaResidencia],
    dx.code     AS [CodigoDiagnosticoPrincipal],
    dx.name     AS [NombreDiagnosticoPrincipal],
    plserv.name AS [ServicioActual]
FROM #Encuentros enc
    INNER JOIN encounterRecords er ON enc.idEncounter = er.idEncounter
    INNER JOIN companyOffices co ON co.idOffice = enc.idOffice
    INNER JOIN users u ON enc.idUserPatient = u.idUser
    INNER JOIN userPeople up ON u.idUser = up.idUser
    INNER JOIN contracts c ON er.idPrincipalContract = c.idContract
    INNER JOIN users ucon ON ucon.idUser = c.idUserContractee
    LEFT JOIN EHRConfEventDestination ehrced ON er.idDestination = ehrced.idEventDestination
    -- Catalogos demograficos y diagnostico (LEFT JOIN: no filtran filas)
    LEFT JOIN userConfAdministrativeSex sexo ON sexo.idAdministrativeSex = up.idAdministrativeSex
    LEFT JOIN userConfMaritalStatus ecivil ON ecivil.idMaritalStatus = up.idMaritalStatus
    LEFT JOIN generalPoliticalDivisions mun ON mun.idPoliticalDivision = up.idHomePlacePoliticalDivision
    LEFT JOIN generalPoliticalDivisions depto ON depto.idPoliticalDivision = mun.idParent
    LEFT JOIN userConfResidenceArea zona ON zona.idResidenceArea = up.idResidenceArea
    LEFT JOIN diagnostics dx ON dx.idDiagnostic = er.idActualDiagnosis
    LEFT JOIN physicalLocations plserv ON plserv.idPhysicalLocation = er.idActualLocation
    LEFT JOIN #AllEncounterEHREvents fe ON enc.idEncounter = fe.idEncounter AND fe.FirstEventRn = 1
    LEFT JOIN #AllEncounterEHREvents le ON enc.idEncounter = le.idEncounter AND le.LastEventRn = 1
    LEFT JOIN CustomAgg cagg ON enc.idEncounter = cagg.idEncounter
    LEFT JOIN #AllEncounterCounts aec ON enc.idEncounter = aec.idEncounter
    LEFT JOIN ScalesPivot sp ON enc.idEncounter = sp.idEncounter
    LEFT JOIN SASPivot sas ON enc.idEncounter = sas.idEncounter
    LEFT JOIN BarthelPivot bp ON enc.idEncounter = bp.idEncounter
    LEFT JOIN IDCPivot idc ON enc.idEncounter = idc.idEncounter
    OUTER APPLY (
        SELECT TOP 1 pld.name
        FROM encounterHistoricalRecords ehr
        INNER JOIN physicalLocations pld ON pld.idPhysicalLocation = ehr.idLocation
        WHERE ehr.idEncounter = enc.idEncounter
          AND enc.idStatus = 4
        ORDER BY ehr.idRecord DESC
    ) servEgreso
WHERE (aec.idEncounter IS NOT NULL OR enc.EstanciaTotal > 20);
