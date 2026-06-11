import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, Trash2, Eye, X, ChevronLeft, ChevronRight, HeartPulse, LogOut, Ribbon } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '@/components/layout/Header'
import FiltersBar from '@/components/dashboard/FiltersBar'
import ExportButtons from '@/components/ui/ExportButtons'
import { useValoracionesFiltradas, useCorteActivo } from '@/hooks/useValoraciones'
import { subtituloExport } from '@/utils/format'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Valoracion } from '@/types'

/** Badge de estado del paciente con icono (cinta negra = fallecido) */
function EstadoBadge({ estado }: { estado: Valoracion['estado_paciente'] }) {
  if (estado === 'Fallecido') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-white">
        <Ribbon className="w-3 h-3" /> Fallecido
      </span>
    )
  }
  if (estado === 'Egresado') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-700">
        <LogOut className="w-3 h-3" /> Egresado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
      <HeartPulse className="w-3 h-3" /> Activo
    </span>
  )
}

const PAGE_SIZE = 25

export default function ValoracionesPage() {
  const { data, isLoading } = useValoracionesFiltradas()
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()

  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [detalle, setDetalle] = useState<Valoracion | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Valoracion | null>(null)

  const filtradas = useMemo(() => {
    if (!busqueda.trim()) return data
    const q = busqueda.toLowerCase()
    return data.filter(v =>
      v.nombre_paciente?.toLowerCase().includes(q) ||
      v.identificacion_paciente?.includes(q) ||
      String(v.ingreso).includes(q)
    )
  }, [data, busqueda])

  const totalPaginas = Math.ceil(filtradas.length / PAGE_SIZE)
  const visibles = filtradas.slice(pagina * PAGE_SIZE, (pagina + 1) * PAGE_SIZE)
  const { corte } = useCorteActivo()

  const buildExport = () => {
    if (!filtradas.length) return null
    return {
      titulo: 'Listado de Valoraciones — Gestión Clínica',
      subtitulo: subtituloExport(corte, filtradas.length),
      head: ['Ingreso', 'Paciente', 'Identificación', 'Aseguradora', 'F. Ingreso', 'Últ. Valoración', 'Especialidad', 'Estancia (d)', '>20 días', 'Estado'],
      body: filtradas.map(v => [
        v.ingreso, v.nombre_paciente, v.identificacion_paciente, v.aseguradora,
        v.fecha_ingreso, v.fecha_ultima_valoracion, v.especialidad_ultima,
        v.estancia_total, v.estancia_mayor_20_dias, v.estado_paciente,
      ]),
      nombreArchivo: `valoraciones_${corte ?? 'actual'}`,
    }
  }

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('valoraciones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['valoraciones'] })
      toast.success('Registro eliminado')
      setConfirmDelete(null)
    },
    onError: (e: Error) => toast.error(`Error: ${e.message}`),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <Header title="Valoraciones" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-clinic-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Valoraciones" subtitle={`${filtradas.length.toLocaleString('es-CO')} registros`} />

      <div className="flex-1 p-5 space-y-4 overflow-auto">
        <FiltersBar />

        {/* Búsqueda + exportes */}
        <div className="card p-3 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
              placeholder="Buscar por nombre, identificación o ingreso..."
              className="filter-select w-full pl-9"
            />
          </div>
          <ExportButtons build={buildExport} />
        </div>

        {/* Tabla */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-clinic-600">
                <tr className="text-left">
                  {['Ingreso', 'Paciente', 'Identificación', 'Aseguradora', 'F. Ingreso', 'Últ. Valoración', 'Especialidad', 'Estancia', 'Estado', ''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-xs font-semibold text-white uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibles.map(v => (
                  <tr key={v.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-clinic-600">{v.ingreso}</td>
                    <td className="px-3 py-2 text-slate-700 max-w-[220px] truncate">{v.nombre_paciente}</td>
                    <td className="px-3 py-2 text-slate-500">{v.identificacion_paciente}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[160px] truncate">{v.aseguradora}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{v.fecha_ingreso}</td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{v.fecha_ultima_valoracion}</td>
                    <td className="px-3 py-2 text-slate-500 max-w-[150px] truncate">{v.especialidad_ultima}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                        v.estancia_mayor_20_dias === 'Si' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {v.estancia_total ?? '—'}d
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <EstadoBadge estado={v.estado_paciente} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button title="Ver detalle" onClick={() => setDetalle(v)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-clinic-600 hover:bg-clinic-50">
                          <Eye className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button title="Eliminar" onClick={() => setConfirmDelete(v)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!visibles.length && (
                  <tr><td colSpan={10} className="px-3 py-8 text-center text-slate-400">Sin registros para los filtros aplicados</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                Página {pagina + 1} de {totalPaginas} · {filtradas.length.toLocaleString('es-CO')} registros
              </p>
              <div className="flex gap-1">
                <button disabled={pagina === 0} onClick={() => setPagina(p => p - 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button disabled={pagina >= totalPaginas - 1} onClick={() => setPagina(p => p + 1)}
                  className="p-1.5 rounded-lg border border-slate-200 text-slate-500 disabled:opacity-30 hover:bg-slate-50">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: 'linear-gradient(135deg, #0D2D6B 0%, #16468E 100%)' }}>
              <div>
                <h2 className="text-white font-bold">{detalle.nombre_paciente}</h2>
                <p className="text-white/60 text-xs">Ingreso {detalle.ingreso} · {detalle.identificacion_paciente}</p>
              </div>
              <button onClick={() => setDetalle(null)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 text-sm">
              <Section title="Datos generales" rows={[
                ['Sede', detalle.sede], ['Aseguradora', detalle.aseguradora],
                ['Fecha ingreso', detalle.fecha_ingreso], ['Fecha egreso', detalle.fecha_egreso ?? '—'],
                ['Estado', detalle.estado_paciente], ['Estancia total', `${detalle.estancia_total ?? '—'} días`],
                ['Larga estancia', detalle.estancia_mayor_20_dias ?? '—'], ['Servicio egreso', detalle.servicio_egreso ?? '—'],
              ]} />
              <Section title="Primera atención" rows={[
                ['Fecha', detalle.fecha_primera_atencion], ['Especialidad', detalle.especialidad_primera],
                ['Profesional', detalle.profesional_primera], ['Ubicación', detalle.ubicacion_primera],
                ['Tipo intervención', detalle.primer_tipo_intervencion], ['Causas larga estancia', detalle.primer_causas_larga_estancia],
              ]} />
              <Section title="Última valoración" rows={[
                ['Fecha', detalle.fecha_ultima_valoracion], ['Especialidad', detalle.especialidad_ultima],
                ['Profesional', detalle.profesional_ultima], ['Ubicación', detalle.ubicacion_ultima],
                ['Tipo intervención', detalle.ultimo_tipo_intervencion], ['Atenciones totales', detalle.cantidad_atenciones],
              ]} />
              <Section title="Escalas aplicadas" rows={[
                ['CAM', detalle.cam_resultado], ['Yesavage', detalle.yesavage_resultado],
                ['Gijón', detalle.gijon_resultado], ['MNA', detalle.mna_resultado],
                ['RESVECH', detalle.resvech_resultado], ['FOIS', detalle.fois_resultado],
                ['Fragilidad', detalle.fragilidad_resultado], ['NECPAL', detalle.necpal_resultado],
                ['PAPSCORE', detalle.papscore_resultado],
                ['Barthel previo', detalle.barthel_previo_resultado],
                ['Barthel actual', detalle.barthel_actual_resultado],
                ['Barthel egreso', detalle.barthel_egreso_resultado],
              ]} />
              {(detalle.comentario_ultima || detalle.comentario_primera) && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-clinic-600 mb-2">Comentario última atención</h4>
                  <p className="text-slate-600 text-xs whitespace-pre-wrap bg-slate-50 rounded-lg p-3 max-h-48 overflow-y-auto">
                    {detalle.comentario_ultima || detalle.comentario_primera}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirmar eliminación */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-slate-800 mb-2">Eliminar registro</h3>
            <p className="text-sm text-slate-500 mb-4">
              ¿Eliminar la valoración del ingreso <strong>{confirmDelete.ingreso}</strong> ({confirmDelete.nombre_paciente})?
              El registro volverá a aparecer si el paciente sigue en el rango del próximo sync.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary text-xs">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-red-700 flex items-center gap-1.5 disabled:opacity-50">
                {deleteMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: [string, string | number | null | undefined][] }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-wider text-clinic-600 mb-2">{title}</h4>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 border-b border-slate-50 py-1">
            <span className="text-slate-400 text-xs">{label}</span>
            <span className="text-slate-700 text-xs font-medium text-right">{value ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
