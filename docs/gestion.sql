WITH
FirstEvents AS (
    SELECT * FROM #AllEncounterEHREvents WHERE FirstEventRn = 1
),
LastEvents AS (
    SELECT * FROM #AllEncounterEHREvents WHERE LastEventRn = 1
),
FirstCustomInfo AS (
    SELECT 
        ca.idEncounter,
        STRING_AGG(ca.formatted_info, ', ') WITHIN GROUP (ORDER BY ca.actionRecordedDate ASC) as primera_info
    FROM #CustomActivities ca
    INNER JOIN (
        SELECT idEncounter, MIN(actionRecordedDate) as primera_fecha
        FROM #CustomActivities 
        WHERE idElement IN (2,3,4,5,6)
        GROUP BY idEncounter
    ) primera ON ca.idEncounter = primera.idEncounter AND ca.actionRecordedDate = primera.primera_fecha
    WHERE ca.idElement IN (2,3,4,5,6)
    GROUP BY ca.idEncounter
),
FirstCustomCauses AS (
    SELECT 
        primera.idEncounter,
        STRING_AGG(ca.formatted_causes, ', ') WITHIN GROUP (ORDER BY ca.actionRecordedDate ASC) as primera_causas
    FROM (
        SELECT idEncounter, MIN(actionRecordedDate) as primera_fecha
        FROM #CustomActivities 
        WHERE idElement IN (8,9,10,11)
        GROUP BY idEncounter
    ) primera
    INNER JOIN #CustomActivities ca ON ca.idEncounter = primera.idEncounter 
        AND ca.actionRecordedDate = primera.primera_fecha
        AND ca.idElement IN (8,9,10,11)
    GROUP BY primera.idEncounter
),
LastCustomInfo AS (
    SELECT 
        ca.idEncounter,
        STRING_AGG(ca.formatted_info, ', ') WITHIN GROUP (ORDER BY ca.actionRecordedDate DESC) as ultima_info
    FROM #CustomActivities ca
    INNER JOIN (
        SELECT idEncounter, MAX(actionRecordedDate) as ultima_fecha
        FROM #CustomActivities 
        WHERE idElement IN (2,3,4,5,6)
        GROUP BY idEncounter
    ) ultima ON ca.idEncounter = ultima.idEncounter AND ca.actionRecordedDate = ultima.ultima_fecha
    WHERE ca.idElement IN (2,3,4,5,6)
    GROUP BY ca.idEncounter
),
LastCustomCauses AS (
    SELECT 
        ultima.idEncounter,
        STRING_AGG(ca.formatted_causes, ', ') WITHIN GROUP (ORDER BY ca.actionRecordedDate DESC) as ultima_causas
    FROM (
        SELECT idEncounter, MAX(actionRecordedDate) as ultima_fecha
        FROM #CustomActivities 
        WHERE idElement IN (8,9,10,11)
        GROUP BY idEncounter
    ) ultima
    INNER JOIN #CustomActivities ca ON ca.idEncounter = ultima.idEncounter 
        AND ca.actionRecordedDate = ultima.ultima_fecha
        AND ca.idElement IN (8,9,10,11)
    GROUP BY ultima.idEncounter
),
EncounterCounts AS (
    SELECT idEncounter, COUNT(*) as atenciones_count FROM #EncounterEHREvents GROUP BY idEncounter
),
ParentEncounters AS (
    SELECT idEncounter, dateStart FROM encounters
),
LatestScales AS (
    SELECT idEncounter, idScale, scale_result, scale_value, actionRecordedDate
    FROM #AllScales WHERE rn = 1
),
LatestSASAnswers AS (
    SELECT 
        idEncounter,
        idQuestion,
        sas_answer
    FROM #SASAnswers 
    WHERE rn = 1
),
LatestBarthelEvaluations AS (
    SELECT 
        idEncounter,
        evaluation_type,
        actionRecordedDate,
        scale_result,
        scale_value
    FROM #BarthelEvaluations 
    WHERE rn = 1
),
LatestIDCActivities AS (
    SELECT 
        idEncounter,
        idElement,
        actionRecordedDate,
        valueText
    FROM #IDCActivities 
    WHERE rn = 1
),
EstanciaCalculada AS (
    SELECT
        e.idEncounter,
        IIF(e.idEncounterPartOf IS NULL,
            IIF(e.idStatus = 4,
                CAST(DATEDIFF(HOUR, e.dateStart, 
                    IIF(e.dateDischarge > '2026-05-05',
                        '2026-05-05', 
                        e.dateDischarge)
                ) / 24.0 AS DECIMAL(5,1)),
                CAST(DATEDIFF(HOUR, e.dateStart, '2026-05-05') / 24.0 AS DECIMAL(5,1))),
            (SELECT IIF(e.idStatus = 4,
                CAST(DATEDIFF(HOUR, es.dateStart, 
                    IIF(e.dateDischarge > '2026-05-05',
                        '2026-05-05', 
                        e.dateDischarge)
                ) / 24.0 AS DECIMAL(5,1)),
                CAST(DATEDIFF(HOUR, es.dateStart, '2026-05-05') / 24.0 AS DECIMAL(5,1)))
            FROM ParentEncounters es
            WHERE es.idEncounter = e.idEncounterPartOf)
        ) AS EstanciaTotal
    FROM encounters e
)
SELECT
    co.name AS 'Sede',
    e.identifier AS 'Ingreso',
    IIF(e.idEncounterPartOf IS NULL, 
        CAST(e.dateStart AS DATE),
        (SELECT CAST(es.dateStart AS DATE) FROM ParentEncounters es WHERE es.idEncounter = e.idEncounterPartOf)
    ) AS 'FechaIngreso',
    ucon.shortBusinessName AS 'Aseguradora',
    u.documentNumber AS 'IdentificacionPaciente',
    CONCAT(u.givenName, ' ', u.familyName) AS 'NombrePaciente',
    CAST(fe.actionRecordedDate AS DATE) AS "Fecha Primer Atenci?n Gesti?n Clinica",
    fe.specialty_name AS 'Especialidad Primera Atencion Gestion Clinica',
    fe.practitioner_name AS "Profesional Primera valoracion Gestion Clinica",
    fe.location_name AS 'Ubicacion Primera Atencion Gestion Clinica',
    fe.action_name AS 'Esquema Historia Primera Valoraci?n Gestion Clinica',
    fci.primera_info AS 'PrimerTipoDeIntervencion',
    fcc.primera_causas AS 'PrimerCausasLargaEstancia',
    CASE 
        WHEN fe.idAction = 398 THEN fe.comentario_398
        WHEN fe.idAction = 401 THEN fe.comentario_401
        WHEN fe.idAction = 532 THEN fe.comentario_532
        WHEN fe.idAction IN (607,608) THEN fe.medicalConcept
    END AS 'Comentario Primera Atencion Gestion Clinica',
    CAST(le.actionRecordedDate AS DATE) AS 'Fecha Ultima valoracion Gestion Clinica',
    le.specialty_name AS 'Especialidad Ultima Valoracion Gestion Clinica',
    le.practitioner_name AS 'Profesional Ultima Valoracion Gestion Clinica',
    le.location_name AS 'Ubicacion Ultima Valoracion Gestion Clinica',
    le.action_name AS 'Esquema Historia Ultima Valoraci?n Gestion Clinica',
    lci.ultima_info AS 'UltimoTipoDeIntervencion',
    lcc.ultima_causas AS 'UltimoCausasLargaEstancia',
    CASE 
        WHEN le.idAction = 398 THEN le.comentario_398
        WHEN le.idAction = 401 THEN le.comentario_401
        WHEN le.idAction = 532 THEN le.comentario_532
        WHEN le.idAction IN (607,608) THEN le.medicalConcept
    END AS 'Comentario Ultima Atencion Gestion Clinica',
    aec.total_atenciones_count AS 'Cantidad Atenciones Gestion Clinica',
    ec2.EstanciaTotal AS 'EstanciaTotal(HastaUltimoDiaMes)',
    CASE WHEN ec2.EstanciaTotal > 20 THEN 'Si' ELSE 'No' END AS 'EstanciaMayor20Dias',
    CAST(e.dateDischarge AS DATE) AS 'FechaEgreso',
    CASE 
        WHEN e.dateDischarge IS NOT NULL AND le.actionRecordedDate IS NOT NULL THEN
            DATEDIFF(DAY, le.actionRecordedDate, e.dateDischarge)
        ELSE NULL
    END AS 'DiferenciaDiasUltimaValoracion',
    IIF(e.idStatus = 4,
        (SELECT TOP 1 pld.name
         FROM encounterHistoricalRecords ehr
         INNER JOIN physicalLocations pld ON pld.idPhysicalLocation = ehr.idLocation
         WHERE ehr.idEncounter = e.idEncounter
         ORDER BY ehr.idRecord DESC),
        NULL
    ) AS 'ServicioEgreso',
    ehrced.name AS 'DestinoUltimaAtencion',
    CAST(up.deathDate AS DATE) AS 'FechaFallecido',
    ls_cam.actionRecordedDate AS 'FECHA escala CAM',
    ls_cam.scale_value AS 'VALORACION escala CAM',
    ls_cam.scale_result AS 'RESULTADO escala CAM',
    
    ls_esas.actionRecordedDate AS 'FECHA escala ESAS',

    
    sas1.sas_answer AS 'SAS_Dolor',
    sas2.sas_answer AS 'SAS_Cansancio',
    sas3.sas_answer AS 'SAS_Nauseas',
    sas4.sas_answer AS 'SAS_Depresion',
    sas5.sas_answer AS 'SAS_Ansiedad',
    sas6.sas_answer AS 'SAS_Somnolencia',
    sas7.sas_answer AS 'SAS_Apetito',
    sas8.sas_answer AS 'SAS_Bienestar',
    sas9.sas_answer AS 'SAS_FaltaDeAire',
    sas10.sas_answer AS 'SAS_DificultadParaDormir',
    
    ls_necpal.actionRecordedDate AS 'FECHA escala NECPAL',
    ls_necpal.scale_value AS 'VALORACION escala NECPAL',
    ls_necpal.scale_result AS 'RESULTADO escala NECPAL',
    
    ls_papscore.actionRecordedDate AS 'FECHA escala PAPSCORE',
    ls_papscore.scale_value AS 'VALORACION escala PAPSCORE',
    ls_papscore.scale_result AS 'RESULTADO escala PAPSCORE',
    
    ls_fragilidad.actionRecordedDate AS 'FECHA escala Fragilidad',
    ls_fragilidad.scale_value AS 'VALORACION escala Fragilidad',
    ls_fragilidad.scale_result AS 'RESULTADO escala Fragilidad',
    
    ls_fois.actionRecordedDate AS 'FECHA escala Fois',
    ls_fois.scale_value AS 'VALORACION escala Fois',
    ls_fois.scale_result AS 'RESULTADO escala Fois',
    
    ls_resvech.actionRecordedDate AS 'FECHA escala RESVECH',
    ls_resvech.scale_value AS 'VALORACION escala RESVECH',
    ls_resvech.scale_result AS 'RESULTADO escala RESVECH',
    
    ls_mna.actionRecordedDate AS 'FECHA escala MNA',
    ls_mna.scale_value AS 'VALORACION escala MNA',
    ls_mna.scale_result AS 'RESULTADO escala MNA',
    
    ls_yesavage.actionRecordedDate AS 'FECHA escala YESAVAGE',
    ls_yesavage.scale_value AS 'VALORACION escala YESAVAGE',
    ls_yesavage.scale_result AS 'RESULTADO escala YESAVAGE',
    
    ls_gijon.actionRecordedDate AS 'FECHA escala GIJON',
    ls_gijon.scale_value AS 'VALORACION escala GIJON',
    ls_gijon.scale_result AS 'RESULTADO escala GIJON',
    
    barthel_previo.actionRecordedDate AS 'FECHA Evaluaci?n Barthel Previo',
    barthel_previo.scale_value AS 'VALORACION Evaluaci?n Barthel Previo',
    barthel_previo.scale_result AS 'RESULTADO Evaluaci?n Barthel Previo',
    
    barthel_actual.actionRecordedDate AS 'FECHA Evaluaci?n Barthel Actual',
    barthel_actual.scale_value AS 'VALORACION Evaluaci?n Barthel Actual',
    barthel_actual.scale_result AS 'RESULTADO Evaluaci?n Barthel Actual',
    
    barthel_egreso.actionRecordedDate AS 'FECHA Evaluaci?n Barthel Egreso',
    barthel_egreso.scale_value AS 'VALORACION Evaluaci?n Barthel Egreso',
    barthel_egreso.scale_result AS 'RESULTADO Evaluaci?n Barthel Egreso',
    
    idc_fecha.actionRecordedDate AS 'FechaEscalaIDC',
    idc_intervencion.valueText AS 'IntervencionRecursosEspecificosIDC',
    idc_estado.valueText AS 'EstadoSituacionIDC'
FROM encounters e
    INNER JOIN encounterRecords er ON e.idEncounter = er.idEncounter
    INNER JOIN physicalLocations pl ON pl.idPhysicalLocation = er.idActualLocation
    INNER JOIN companyOffices co ON co.idOffice = e.idOffice
    INNER JOIN users u ON e.idUserPatient = u.idUser
    INNER JOIN userPeople up ON u.idUser = up.idUser
    LEFT JOIN EHRConfEventDestination ehrced ON er.idDestination = ehrced.idEventDestination
    LEFT JOIN diagnostics d ON er.idActualDiagnosis = d.idDiagnostic
    INNER JOIN contracts c ON er.idPrincipalContract = c.idContract
    INNER JOIN users ucon ON ucon.idUser = c.idUserContractee
    LEFT JOIN FirstEvents fe ON e.idEncounter = fe.idEncounter
    LEFT JOIN LastEvents le ON e.idEncounter = le.idEncounter
    LEFT JOIN FirstCustomInfo fci ON e.idEncounter = fci.idEncounter
    LEFT JOIN FirstCustomCauses fcc ON e.idEncounter = fcc.idEncounter
    LEFT JOIN LastCustomInfo lci ON e.idEncounter = lci.idEncounter
    LEFT JOIN LastCustomCauses lcc ON e.idEncounter = lcc.idEncounter
    LEFT JOIN EncounterCounts ec ON e.idEncounter = ec.idEncounter
    LEFT JOIN #AllEncounterCounts aec ON e.idEncounter = aec.idEncounter
    LEFT JOIN EstanciaCalculada ec2 ON e.idEncounter = ec2.idEncounter
    LEFT JOIN LatestScales ls_cam ON e.idEncounter = ls_cam.idEncounter AND ls_cam.idScale = 8
    LEFT JOIN LatestScales ls_esas ON e.idEncounter = ls_esas.idEncounter AND ls_esas.idScale = 40
    LEFT JOIN LatestScales ls_necpal ON e.idEncounter = ls_necpal.idEncounter AND ls_necpal.idScale = 36
    LEFT JOIN LatestScales ls_papscore ON e.idEncounter = ls_papscore.idEncounter AND ls_papscore.idScale = 37
    LEFT JOIN LatestScales ls_fragilidad ON e.idEncounter = ls_fragilidad.idEncounter AND ls_fragilidad.idScale = 104
    LEFT JOIN LatestScales ls_fois ON e.idEncounter = ls_fois.idEncounter AND ls_fois.idScale = 107
    LEFT JOIN LatestScales ls_resvech ON e.idEncounter = ls_resvech.idEncounter AND ls_resvech.idScale = 110
    LEFT JOIN LatestScales ls_mna ON e.idEncounter = ls_mna.idEncounter AND ls_mna.idScale = 102
    LEFT JOIN LatestScales ls_yesavage ON e.idEncounter = ls_yesavage.idEncounter AND ls_yesavage.idScale = 109
    LEFT JOIN LatestScales ls_gijon ON e.idEncounter = ls_gijon.idEncounter AND ls_gijon.idScale = 106
    LEFT JOIN LatestSASAnswers sas1 ON e.idEncounter = sas1.idEncounter AND sas1.idQuestion = 1
    LEFT JOIN LatestSASAnswers sas2 ON e.idEncounter = sas2.idEncounter AND sas2.idQuestion = 2
    LEFT JOIN LatestSASAnswers sas3 ON e.idEncounter = sas3.idEncounter AND sas3.idQuestion = 3
    LEFT JOIN LatestSASAnswers sas4 ON e.idEncounter = sas4.idEncounter AND sas4.idQuestion = 4
    LEFT JOIN LatestSASAnswers sas5 ON e.idEncounter = sas5.idEncounter AND sas5.idQuestion = 5
    LEFT JOIN LatestSASAnswers sas6 ON e.idEncounter = sas6.idEncounter AND sas6.idQuestion = 6
    LEFT JOIN LatestSASAnswers sas7 ON e.idEncounter = sas7.idEncounter AND sas7.idQuestion = 7
    LEFT JOIN LatestSASAnswers sas8 ON e.idEncounter = sas8.idEncounter AND sas8.idQuestion = 8
    LEFT JOIN LatestSASAnswers sas9 ON e.idEncounter = sas9.idEncounter AND sas9.idQuestion = 9
    LEFT JOIN LatestSASAnswers sas10 ON e.idEncounter = sas10.idEncounter AND sas10.idQuestion = 10
    LEFT JOIN LatestBarthelEvaluations barthel_previo ON e.idEncounter = barthel_previo.idEncounter AND barthel_previo.evaluation_type = 4729
    LEFT JOIN LatestBarthelEvaluations barthel_actual ON e.idEncounter = barthel_actual.idEncounter AND barthel_actual.evaluation_type = 4730
    LEFT JOIN LatestBarthelEvaluations barthel_egreso ON e.idEncounter = barthel_egreso.idEncounter AND barthel_egreso.evaluation_type = 4731
    LEFT JOIN LatestIDCActivities idc_fecha ON e.idEncounter = idc_fecha.idEncounter AND idc_fecha.idElement = 4
    LEFT JOIN LatestIDCActivities idc_intervencion ON e.idEncounter = idc_intervencion.idEncounter AND idc_intervencion.idElement = 4
    LEFT JOIN LatestIDCActivities idc_estado ON e.idEncounter = idc_estado.idEncounter AND idc_estado.idElement = 5
WHERE e.idUserCompany = 108240
    AND e.idStatus NOT IN (1,5)
    AND ('2026-05-01' BETWEEN CAST(e.dateStart AS date) AND CAST(e.dateDischarge AS date)
        OR ('2026-05-01' >= CAST(e.dateStart AS date) AND e.dateDischarge IS NULL)
        OR '2026-05-05' BETWEEN CAST(e.dateStart AS date) AND CAST(e.dateDischarge AS date)
        OR (CAST(e.dateStart AS date) >= '2026-05-01' AND CAST(e.dateStart AS date) <= '2026-05-05'))
    AND NOT EXISTS (
        SELECT 1
        FROM encounters eo
        WHERE eo.idUserPatient = e.idUserPatient
            AND eo.idEncounterPartOf IS NOT NULL
            AND eo.idEncounterPartOf = e.idEncounter
    )
    AND (
        EXISTS (
            SELECT 1
            FROM #EncounterEHREvents ehre
            WHERE ehre.idEncounter = e.idEncounter
        )
        OR ec2.EstanciaTotal > 20
    )