import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import type { Valoracion, Configuracion, SyncLog, EvolucionCorte } from '@/types'

const PAGE = 1000

/** Cortes mensuales disponibles (snapshots), más reciente primero */
export function useCortes() {
  return useQuery({
    queryKey: ['cortes'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_cortes').select('fecha_corte')
      if (error) throw error
      return (data as { fecha_corte: string }[]).map(d => d.fecha_corte)
    },
  })
}

/** Valor especial del filtro de corte: incluir todos los meses */
export const CORTE_TODOS = 'todos'

/** Corte efectivo: el seleccionado en filtros ('todos' = sin filtrar) o, por defecto, el más reciente */
export function useCorteActivo() {
  const { data: cortes = [], isLoading } = useCortes()
  const { filtros } = useStore()
  return { corte: filtros.corte ?? cortes[0] ?? null, cortes, isLoading }
}

/** Carga las valoraciones del corte activo (paginado interno de Supabase) */
export function useValoraciones() {
  const { corte, isLoading: loadingCortes } = useCorteActivo()
  return useQuery({
    queryKey: ['valoraciones', corte],
    staleTime: 5 * 60 * 1000,
    enabled: !loadingCortes,
    queryFn: async () => {
      let all: Valoracion[] = []
      let from = 0
      for (;;) {
        let q = supabase
          .from('valoraciones')
          .select('*')
          .order('fecha_ingreso', { ascending: false })
          .range(from, from + PAGE - 1)
        if (corte && corte !== CORTE_TODOS) q = q.eq('fecha_corte', corte)
        const { data, error } = await q
        if (error) throw error
        all = all.concat(data as Valoracion[])
        if (!data || data.length < PAGE) break
        from += PAGE
      }
      return all
    },
  })
}

/** Valoraciones con los filtros globales aplicados (client-side) */
export function useValoracionesFiltradas() {
  const { data: all = [], isLoading, error } = useValoraciones()
  const { filtros } = useStore()

  const data = useMemo(() => {
    return all.filter(v => {
      if (filtros.anio && v.anio_primera !== filtros.anio && v.anio_ingreso !== filtros.anio) return false
      if (filtros.mes && v.mes_primera !== filtros.mes && v.mes_ingreso !== filtros.mes) return false
      if (filtros.aseguradora.length && !filtros.aseguradora.includes(v.aseguradora ?? '')) return false
      if (filtros.sede.length && !filtros.sede.includes(v.sede ?? '')) return false
      if (filtros.especialidad.length && !filtros.especialidad.includes(v.especialidad_ultima ?? '')) return false
      if (filtros.profesional.length && !filtros.profesional.includes(v.profesional_ultima ?? '')) return false
      if (filtros.estado.length && !filtros.estado.includes(v.estado_paciente)) return false
      if (filtros.largaEstancia && v.estancia_mayor_20_dias !== filtros.largaEstancia) return false
      if (filtros.sexo.length && !filtros.sexo.includes(v.sexo ?? '')) return false
      return true
    })
  }, [all, filtros])

  return { data, all, isLoading, error }
}

/** Agregados por corte (todos los meses) — para gráficos de evolución */
export function useEvolucion() {
  return useQuery({
    queryKey: ['evolucion'],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_evolucion').select('*')
      if (error) throw error
      return data as EvolucionCorte[]
    },
  })
}

export function useConfiguracion() {
  return useQuery({
    queryKey: ['configuracion'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracion').select('*').order('clave')
      if (error) throw error
      return data as Configuracion[]
    },
  })
}

export function useSyncLogs() {
  return useQuery({
    queryKey: ['sync_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return data as SyncLog[]
    },
  })
}

/** Utilidades de agregación */
export function countBy<T>(rows: T[], key: (r: T) => string | null | undefined): { name: string; value: number }[] {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = key(r) || 'Sin dato'
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}
