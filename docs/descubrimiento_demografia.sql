/* ============================================================================
   DESCUBRIMIENTO DE COLUMNAS - GoMedisys (SQL Server)
   Objetivo: identificar los nombres reales de las columnas/tablas para
   agregar al reporte: sexo, fecha de nacimiento, municipio, zona
   urbano/rural, estado civil, diagnostico CIE-10 y servicio actual.

   Es 100% de SOLO LECTURA. Ejecutar contra GoMedisys y pegar los
   resultados en el chat (o exportarlos a CSV en bi_gestionclinica/docs).
   ========================================================================= */

-- 1. Columnas de las tablas de pacientes/personas
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('users', 'userPeople', 'people')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 2. Columnas de encuentros y registros (servicio actual, diagnostico)
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('encounters', 'encounterRecords', 'diagnostics')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

-- 3. Tablas catalogo candidatas (sexo/genero, municipio, estado civil, zona)
SELECT TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND (
       TABLE_NAME LIKE '%ender%'      -- gender
    OR TABLE_NAME LIKE '%sex%'
    OR TABLE_NAME LIKE '%own%'        -- towns
    OR TABLE_NAME LIKE '%unicip%'     -- municipios
    OR TABLE_NAME LIKE '%ivision%'    -- divisiones politicas
    OR TABLE_NAME LIKE '%arital%'     -- marital status
    OR TABLE_NAME LIKE '%ivil%'       -- estado civil
    OR TABLE_NAME LIKE '%one%'        -- zona
    OR TABLE_NAME LIKE '%rea%'        -- area (urbano/rural)
    OR TABLE_NAME LIKE 'general%'
  )
ORDER BY TABLE_NAME;

-- 4. Muestra de un paciente (verificar contenido real de userPeople)
--    Reemplazar 123456 por un idUser valido si se desea.
SELECT TOP 3 *
FROM userPeople;

-- 5. Muestra de diagnostics (codigo CIE-10 y descripcion)
SELECT TOP 3 *
FROM diagnostics;
