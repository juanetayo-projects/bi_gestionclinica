/* ============================================================================
   DESCUBRIMIENTO 2 - Catalogos demograficos y diagnostico (GoMedisys)
   100% SOLO LECTURA. Ejecutar y compartir resultados (CSV o pegado en chat).
   ========================================================================= */

-- 1. Llaves foraneas declaradas de userPeople -> revela las tablas catalogo
--    de sexo, estado civil, municipio y zona de residencia.
SELECT
    cp.name  AS columna_userPeople,
    OBJECT_NAME(fk.referenced_object_id) AS tabla_catalogo,
    cr.name  AS columna_catalogo
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE fk.parent_object_id = OBJECT_ID('userPeople')
  AND cp.name IN ('idAdministrativeSex','idMaritalStatus','idHomePlacePoliticalDivision','idResidenceArea');

-- 2. Si la consulta 1 no devuelve filas (FKs no declaradas), buscar los
--    catalogos por nombre:
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (
       TABLE_NAME LIKE '%dministrativeSex%'
    OR TABLE_NAME LIKE '%aritalStatus%'
    OR TABLE_NAME LIKE '%oliticalDivision%'
    OR TABLE_NAME LIKE '%esidenceArea%'
    OR TABLE_NAME LIKE '%eneralSex%'
    OR TABLE_NAME LIKE '%eneralArea%'
  )
ORDER BY TABLE_NAME;

-- 3. Columnas de esas tablas catalogo (ajustar nombres segun resultado de 1/2)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN (
    SELECT TABLE_NAME
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_TYPE = 'BASE TABLE'
      AND (
           TABLE_NAME LIKE '%dministrativeSex%'
        OR TABLE_NAME LIKE '%aritalStatus%'
        OR TABLE_NAME LIKE '%oliticalDivision%'
        OR TABLE_NAME LIKE '%esidenceArea%'
      )
)
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 4. Columnas para el diagnostico CIE-10 y el registro del encuentro
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('diagnostics', 'encounterRecords')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
