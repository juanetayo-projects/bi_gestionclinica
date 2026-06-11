-- ================================================================
-- BI GESTIÓN CLÍNICA · Migration 004 · Vista de evolución mensual
-- Agregados por corte para el gráfico "evolución valorados mes a
-- mes" del modelo Power BI (cruza todos los snapshots).
-- security_invoker: respeta el RLS de valoraciones.
-- ================================================================

CREATE OR REPLACE VIEW public.v_evolucion
WITH (security_invoker = true) AS
SELECT
  fecha_corte,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE estancia_mayor_20_dias = 'Si')::int AS larga_estancia,
  COUNT(*) FILTER (WHERE sexo ILIKE 'muj%')::int AS mujeres,
  COUNT(*) FILTER (WHERE sexo ILIKE 'hom%')::int AS hombres,
  COUNT(*) FILTER (WHERE estado_paciente = 'Fallecido')::int AS fallecidos,
  ROUND(AVG(edad), 1) AS edad_promedio
FROM public.valoraciones
GROUP BY fecha_corte
ORDER BY fecha_corte;
