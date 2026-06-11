/* ============================================================================
   GESTION CLINICA - SELECT final optimizado
   Cambios principales vs. gestion.sql:
   1. Parametrizado (fechas, empresa) -> listo para convertir en stored procedure.
   2. 10 JOINs a #SASAnswers, 10 a #AllScales, 3 a #BarthelEvaluations y 3 a
      #IDCActivities reemplazados por 4 pivotes con agregacion condicional
      (1 sola pasada por tabla temporal en lugar de 26 joins).
   3. 4 CTEs sobre #CustomActivities (8 escaneos) reducidas a 2 (2 escaneos).
   4. Subconsultas escalares correlacionadas al encuentro padre reemplazadas
      por un unico LEFT JOIN (ep).
   5. EstanciaCalculada ya no escanea TODA la tabla encounters: se calcula
      inline con CROSS APPLY sobre las filas ya filtradas.
   6. WHERE de fechas reescrito en forma SARGable (sin CAST sobre columnas)
      y los 4 ORs colapsados a la condicion de solapamiento de intervalos.
      NOTA: asume dateDischarge >= dateStart (integridad esperada).
   7. Eliminados joins muertos: diagnostics (no se usaba), EncounterCounts
      (no se usaba) y physicalLocations pl (no se usaba en el SELECT; OJO:
      al ser INNER JOIN filtraba encuentros sin idActualLocation valido --
      si ese filtro era intencional, restaurarlo).
   8. ServicioEgreso como OUTER APPLY (mas claro, mismo plan o mejor).

   REVISAR (posible bug heredado): idc_fecha e idc_intervencion usaban ambos
   idElement = 4. Se mantuvo igual, pero verificar si la fecha IDC deberia
   venir de otro idElement.

   Indices recomendados sobre las temporales (crear DESPUES de poblarlas):
     CREATE CLUSTERED INDEX IX_AllEvents  ON #AllEncounterEHREvents (idEncounter);
     CREATE CLUSTERED INDEX IX_CustomAct  ON #CustomActivities (idEncounter, idElement, actionRecordedDate);
     CREATE CLUSTERED INDEX IX_AllScales  ON #AllScales (idEncounter, idScale);
     CREATE CLUSTERED INDEX IX_SAS        ON #SASAnswers (idEncounter, idQuestion);
     CREATE CLUSTERED INDEX IX_Barthel    ON #BarthelEvaluations (idEncounter, evaluation_type);
     CREATE CLUSTERED INDEX IX_IDC        ON #IDCActivities (idEncounter, idElement);

   Indices recomendados en tablas base (verificar si ya existen):
     encounters (idUserCompany, idStatus, dateStart) INCLUDE (dateDischarge, idEncounterPartOf, ...)
     encounters (idEncounterPartOf)
     encounterHistoricalRecords (idEncounter, idRecord DESC) INCLUDE (idLocation)
   ========================================================================= */

DECLARE @idCompany     INT      = 108240;
DECLARE @FechaInicio   DATE     = '2026-05-01';  -- inicio del periodo
DECLARE @FechaCorte    DATE     = '2026-05-05';  -- fin del periodo / corte de estancia
DECLARE @FechaCorteFin DATETIME = DATEADD(DAY, 1, CAST(@FechaCorte AS DATETIME)); -- limite exclusivo

WITH
-- Min/Max de fecha por encuentro y grupo de elementos (1 escaneo)
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
-- STRING_AGG ignora NULLs, asi que un solo GROUP BY resuelve las 4 columnas (1 escaneo)
CustomAgg AS (
    SELECT
        ca.idEncounter,
        STRING_AGG(CASE WHEN ca.idElement IN (2,3,4,5,6)  AND ca.actionRecordedDate = cf.info_primera   THEN ca.formatted_info   END, ', ') AS primera_info,
        STRING_AGG(CASE WHEN ca.idElement IN (2,3,4,5,6)  AND ca.actionRecordedDate = cf.info_ultima    THEN ca.formatted_info   END, ', ') AS ultima_info,
        STRING_AGG(CASE WHEN ca.idElement IN (8,9,10,11)  AND ca.actionRecordedDate = cf.causas_primera THEN ca.formatted_causes END, ', ') AS primera_causas,
        STRING_AGG(CASE WHEN ca.idElement IN (8,9,10,11)  AND ca.actionRecordedDate = cf.causas_ultima  THEN ca.formatted_causes END, ', ') AS ultima_causas
    FROM #CustomActivities ca
    INNER JOIN CustomFechas cf ON cf.idEncounter = ca.idEncounter
    GROUP BY ca.idEncounter
),
-- Pivote de escalas: 1 escaneo en lugar de 10 LEFT JOINs
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
-- Pivote SAS: 1 escaneo en lugar de 10 LEFT JOINs
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
-- Pivote Barthel: 1 escaneo en lugar de 3 LEFT JOINs
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
-- Pivote IDC: 1 escaneo en lugar de 3 LEFT JOINs
IDCPivot AS (
    SELECT
        idEncounter,
        MAX(CASE WHEN idElement = 4 THEN actionRecordedDate END) AS idc_fecha,        -- REVISAR: mismo idElement que intervencion en el script original
        MAX(CASE WHEN idElement = 4 THEN valueText          END) AS idc_intervencion,
        MAX(CASE WHEN idElement = 5 THEN valueText          END) AS idc_estado
    FROM #IDCActivities
    WHERE rn = 1
    GROUP BY idEncounter
)
SELECT
    co.name AS [Sede],
    e.identifier AS [Ingreso],
    CAST(COALESCE(ep.dateStart, e.dateStart) AS DATE) AS [FechaIngreso],
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
    est.EstanciaTotal AS [EstanciaTotal(HastaUltimoDiaMes)],
    CASE WHEN est.EstanciaTotal > 20 THEN 'Si' ELSE 'No' END AS [EstanciaMayor20Dias],
    CAST(e.dateDischarge AS DATE) AS [FechaEgreso],
    CASE
        WHEN e.dateDischarge IS NOT NULL AND le.actionRecordedDate IS NOT NULL
        THEN DATEDIFF(DAY, le.actionRecordedDate, e.dateDischarge)
    END AS [DiferenciaDiasUltimaValoracion],
    servEgreso.name AS [ServicioEgreso],
    ehrced.name AS [DestinoUltimaAtencion],
    CAST(up.deathDate AS DATE) AS [FechaFallecido],

    sp.cam_fecha        AS [FECHA escala CAM],
    sp.cam_valor        AS [VALORACION escala CAM],
    sp.cam_resultado    AS [RESULTADO escala CAM],

    sp.esas_fecha       AS [FECHA escala ESAS],

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

    bp.previo_fecha      AS [FECHA Evaluacion Barthel Previo],
    bp.previo_valor      AS [VALORACION Evaluacion Barthel Previo],
    bp.previo_resultado  AS [RESULTADO Evaluacion Barthel Previo],
    bp.actual_fecha      AS [FECHA Evaluacion Barthel Actual],
    bp.actual_valor      AS [VALORACION Evaluacion Barthel Actual],
    bp.actual_resultado  AS [RESULTADO Evaluacion Barthel Actual],
    bp.egreso_fecha      AS [FECHA Evaluacion Barthel Egreso],
    bp.egreso_valor      AS [VALORACION Evaluacion Barthel Egreso],
    bp.egreso_resultado  AS [RESULTADO Evaluacion Barthel Egreso],

    idc.idc_fecha        AS [FechaEscalaIDC],
    idc.idc_intervencion AS [IntervencionRecursosEspecificosIDC],
    idc.idc_estado       AS [EstadoSituacionIDC]
FROM encounters e
    INNER JOIN encounterRecords er ON e.idEncounter = er.idEncounter
    INNER JOIN companyOffices co ON co.idOffice = e.idOffice
    INNER JOIN users u ON e.idUserPatient = u.idUser
    INNER JOIN userPeople up ON u.idUser = up.idUser
    INNER JOIN contracts c ON er.idPrincipalContract = c.idContract
    INNER JOIN users ucon ON ucon.idUser = c.idUserContractee
    LEFT JOIN EHRConfEventDestination ehrced ON er.idDestination = ehrced.idEventDestination
    -- Encuentro padre (reemplaza las subconsultas escalares a ParentEncounters)
    LEFT JOIN encounters ep ON ep.idEncounter = e.idEncounterPartOf
    LEFT JOIN #AllEncounterEHREvents fe ON e.idEncounter = fe.idEncounter AND fe.FirstEventRn = 1
    LEFT JOIN #AllEncounterEHREvents le ON e.idEncounter = le.idEncounter AND le.LastEventRn = 1
    LEFT JOIN CustomAgg cagg ON e.idEncounter = cagg.idEncounter
    LEFT JOIN #AllEncounterCounts aec ON e.idEncounter = aec.idEncounter
    LEFT JOIN ScalesPivot sp ON e.idEncounter = sp.idEncounter
    LEFT JOIN SASPivot sas ON e.idEncounter = sas.idEncounter
    LEFT JOIN BarthelPivot bp ON e.idEncounter = bp.idEncounter
    LEFT JOIN IDCPivot idc ON e.idEncounter = idc.idEncounter
    -- Estancia calculada solo para las filas filtradas (antes: CTE sobre TODA la tabla encounters)
    CROSS APPLY (
        SELECT EstanciaTotal = CAST(
            DATEDIFF(HOUR,
                COALESCE(ep.dateStart, e.dateStart),
                CASE WHEN e.idStatus = 4
                     THEN IIF(e.dateDischarge > @FechaCorte, CAST(@FechaCorte AS DATETIME), e.dateDischarge)
                     ELSE CAST(@FechaCorte AS DATETIME)
                END
            ) / 24.0 AS DECIMAL(5,1))
    ) est
    -- Ultimo servicio registrado, solo para egresados (reemplaza subconsulta escalar TOP 1)
    OUTER APPLY (
        SELECT TOP 1 pld.name
        FROM encounterHistoricalRecords ehr
        INNER JOIN physicalLocations pld ON pld.idPhysicalLocation = ehr.idLocation
        WHERE ehr.idEncounter = e.idEncounter
          AND e.idStatus = 4
        ORDER BY ehr.idRecord DESC
    ) servEgreso
WHERE e.idUserCompany = @idCompany
    AND e.idStatus NOT IN (1,5)
    -- Solapamiento del encuentro con [@FechaInicio, @FechaCorte], forma SARGable
    AND e.dateStart < @FechaCorteFin
    AND (e.dateDischarge IS NULL OR e.dateDischarge >= @FechaInicio)
    -- Excluir encuentros que son padres de otro encuentro
    AND NOT EXISTS (
        SELECT 1
        FROM encounters eo
        WHERE eo.idEncounterPartOf = e.idEncounter
    )
    AND (
        EXISTS (
            SELECT 1
            FROM #EncounterEHREvents ehre
            WHERE ehre.idEncounter = e.idEncounter
        )
        OR est.EstanciaTotal > 20
    );
