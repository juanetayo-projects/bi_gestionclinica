# Especificaciones — App BI Gestión Clínica (CAC Santa Bárbara)

> Base para el prompt de desarrollo. Derivado de: modelodelpowerbi.docx (modelo
> de referencia GESENCRO IPS — el logo NO se utilizará), scriptcompleto_optimizado.sql
> (extracción GoMedisys validada) y resultado.csv (4.098 filas, 79 columnas).

## 1. Objetivo

Dashboard web tipo Power BI para el programa de Gestión Clínica de pacientes de
alta complejidad (Clínica Santa Bárbara): valoraciones de gestión clínica,
cuidado paliativo y geriatría, escalas clínicas aplicadas y larga estancia
(>20 días), con histórico mensual.

## 2. Stack propuesto (consistente con proyectos previos del usuario)

- Frontend: React + Vite, desplegado en GitHub Pages.
- Datos: Supabase (Postgres + Auth + RLS).
- Gráficas: Recharts (o Highcharts, definir).
- ETL: script local/programado que ejecuta scriptcompleto_optimizado.sql contra
  GoMedisys (SQL Server) y hace upsert en Supabase con clave (ingreso, fecha_corte).
  Cada corrida mensual = un snapshot; el histórico mes a mes sale de acumular snapshots.

## 3. Páginas del dashboard (según modelo Power BI)

1. **Resumen general**: total pacientes valorados (tarjeta grande), tabla por
   aseguradora (n y %), tabla por sede de atención, tabla por municipio de
   residencia, estado del paciente (activo, egreso, fallecido, hospitalizado),
   histórico mensual de valorados.
2. **Caracterización demográfica**: pirámide poblacional (sexo x grupo etario
   quinquenal), distribución de edad por sexo (barras apiladas), tabla resumen
   edad por género (n, promedio, mín, máx), urbano/rural, estado civil.
3. **Diagnósticos**: agrupados por CIE-10 (capítulo/categoría).
4. **Tipo de valoración / programa**: gestión clínica vs cuidado paliativo vs
   geriatría; por asegurador; por servicio.
5. **Métricas mentales**: escala CAM (con delirio / sin delirio) + Yesavage
   depresión geriátrica (normal, moderado, severa).
6. **Valoración social (trabajo social)**: escala Gijón (buena, intermedia,
   deterioro social severo).
7. **Nutrición**: MNA-SF (malnutrición, riesgo de malnutrición, normal).
8. **Terapia física**: Barthel (independiente, dependencia leve, moderada,
   grave/total). Comparativo Previo / Actual / Egreso: barras con promedio
   numérico por momento + gráfica por categorías de resultado por momento.
9. **Heridas**: RESVECH (baja, mediana, alta complejidad).
10. **Fonoaudiología**: FOIS (niveles 1-7; el doc menciona 1, 2 y 3).
11. **Geriatría**: escala clínica de fragilidad (nivel 1-9 numérico).
12. **Cuidado paliativo**: NECPAL (positivo/negativo + estadio 1, 2, 3),
    ESAS/SAS (10 síntomas), PAPSCORE (>70, 30-70, <30), IDC-PAL (complejo /
    altamente complejo). % egreso posterior a la valoración.
13. **Larga estancia**: pacientes con estancia >20 días valorados por el equipo,
    evolución mes a mes, causas de larga estancia (barreras administrativas,
    condiciones clínicas, condiciones sociales, sin riesgo), tipo de
    intervención.

**Patrón común por página de escala**: total aplicados, distribución por sexo,
distribución por programa (gestión clínica / paliativo / geriatría), gráfico +
tabla de resultados por categoría.

## 4. Filtros globales (slicers)

Mes/periodo (fecha_corte), Aseguradora, Sede, Servicio/Ubicación, Médico
(profesional), Programa (gestión clínica / paliativo / geriatría), Sexo, Rango
de edad. El doc pide explícitamente filtro de programa en TODAS las gráficas.

## 5. Brechas de datos — agregar al script de extracción

> RESUELTO 2026-06-10: campos agregados a scripts/sync/query.sql (joins a
> userConfAdministrativeSex, userConfMaritalStatus, generalPoliticalDivisions,
> userConfResidenceArea, diagnostics, physicalLocations), migración 003 en
> Supabase y mapeo en el ETL. Columnas nuevas: FechaNacimiento, Edad, Sexo,
> EstadoCivil, MunicipioResidencia, DepartamentoResidencia, ZonaResidencia,
> CodigoDiagnosticoPrincipal, NombreDiagnosticoPrincipal, ServicioActual.

El resultado actual NO incluye campos que el modelo exige:

| Campo requerido | Fuente probable GoMedisys | Usado en |
|---|---|---|
| Sexo | users / userPeople (idGender) | Pirámide y todos los desgloses por sexo |
| Fecha nacimiento / edad | userPeople (birthDate) | Pirámide, grupos etarios |
| Municipio de residencia | userPeople / direcciones | Tabla municipios |
| Zona urbano/rural | userPeople | Demografía |
| Estado civil | userPeople | Demografía |
| Diagnóstico CIE-10 (código + nombre) | encounterRecords.idActualDiagnosis -> diagnostics | Página diagnósticos |
| Servicio/UGC actual | encounterRecords.idActualLocation -> physicalLocations | Filtro servicio |
| Estado del encuentro (texto) | encounters.idStatus | Tarjetas de estado |

Nota: el join a diagnostics existía en el script original pero no se
seleccionaba ninguna columna (se eliminó como join muerto); hay que
reincorporarlo seleccionando código y descripción.

## 6. Reglas de negocio a confirmar con el usuario

- Clasificación de "programa": ¿se deriva de PrimerTipoDeIntervencion /
  UltimoTipoDeIntervencion (Geriatría, Cuidado Paliativo, Larga Estancia,
  Intervención Familiar, Comité de larga estancia) o de otro campo?
- Definición exacta de "% egreso posterior a la valoración".
- Cortes de PAPSCORE: el doc dice ">70, 30-70, <30" (¿porcentaje de
  supervivencia o puntaje? verificar escala usada).
- FOIS: doc menciona "nivel 1 2 y 3" pero la escala tiene 7 niveles.
- Histórico: ¿desde qué mes hacer backfill?

## 7. Seguridad y normativa (datos de pacientes — crítico)

- El dataset contiene identificación y nombre de pacientes: aplica Ley 1581 de
  2012 (habeas data, Colombia) y reserva de la historia clínica.
- Supabase Auth obligatorio + RLS en todas las tablas; sin acceso anónimo.
- GitHub Pages solo aloja el frontend; jamás credenciales ni datos en el repo.
- Roles sugeridos: admin (ve detalle nominal) y consulta (solo agregados).
- Considerar seudonimizar el detalle nominal o dejarlo en una vista restringida.

## 8. Modelo de datos en Supabase (propuesto)

- Tabla ancha `gc_valoraciones` (1 fila por ingreso x fecha_corte), columnas
  snake_case sin tildes (ej. fecha_primera_atencion, sas_dolor, barthel_actual_valor).
- Tabla `gc_cortes` (fecha_corte, fecha_carga, total_filas) para control de ETL.
- Vistas/funciones RPC para agregados por página (evita bajar el detalle al cliente).
- Catálogos pequeños si se requieren (aseguradoras, sedes, escalas).

## 9. Branding / UI

- Logo: PENDIENTE — el de GESENCRO del modelo NO se usa. Solicitar logo y
  colores institucionales de CAC Santa Bárbara / Clínica Santa Bárbara.
- Estilo de referencia: encabezado de título por página, tarjeta KPI grande,
  slicers a la izquierda, paleta azul corporativa (ajustable).
- Idioma: español (Colombia). Responsive (uso en PC y tablet).
- Exportación a Excel/CSV de tablas y descarga de gráficas (definir alcance).
