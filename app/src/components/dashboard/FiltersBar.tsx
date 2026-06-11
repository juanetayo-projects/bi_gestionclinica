import { useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useValoraciones, useCorteActivo } from '@/hooks/useValoraciones'
import { MESES } from '@/types'

function uniq(values: (string | null)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort()
}

/** '2026-05-31' → 'Mayo 2026' */
function labelCorte(corte: string): string {
  const [anio, mes] = corte.split('-')
  return `${MESES[Number(mes)] ?? mes} ${anio}`
}

export default function FiltersBar() {
  const { filtros, setFiltros, resetFiltros } = useStore()
  const { data: all = [] } = useValoraciones()
  const { corte, cortes } = useCorteActivo()

  const opciones = useMemo(() => ({
    anios: [...new Set(all.flatMap(v => [v.anio_primera, v.anio_ingreso]).filter(Boolean) as number[])].sort((a, b) => b - a),
    aseguradoras: uniq(all.map(v => v.aseguradora)),
    sedes: uniq(all.map(v => v.sede)),
    especialidades: uniq(all.map(v => v.especialidad_ultima)),
    sexos: uniq(all.map(v => v.sexo)),
  }), [all])

  const hayFiltros = filtros.anio || filtros.mes || filtros.aseguradora.length ||
    filtros.sede.length || filtros.especialidad.length || filtros.estado.length ||
    filtros.largaEstancia || filtros.sexo.length

  return (
    <div className="card p-3 flex flex-wrap items-end gap-3">
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Corte mensual</label>
        <select className="filter-select" value={corte ?? ''}
          onChange={e => setFiltros({ corte: e.target.value || null })}>
          {cortes.length === 0 && <option value="">Sin datos</option>}
          {cortes.map(c => <option key={c} value={c}>{labelCorte(c)}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Año</label>
        <select className="filter-select" value={filtros.anio ?? ''}
          onChange={e => setFiltros({ anio: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Todos</option>
          {opciones.anios.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mes</label>
        <select className="filter-select" value={filtros.mes ?? ''}
          onChange={e => setFiltros({ mes: e.target.value ? Number(e.target.value) : null })}>
          <option value="">Todos</option>
          {Object.entries(MESES).map(([n, label]) => <option key={n} value={n}>{label}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Aseguradora</label>
        <select className="filter-select max-w-[180px]" value={filtros.aseguradora[0] ?? ''}
          onChange={e => setFiltros({ aseguradora: e.target.value ? [e.target.value] : [] })}>
          <option value="">Todas</option>
          {opciones.aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sede</label>
        <select className="filter-select max-w-[160px]" value={filtros.sede[0] ?? ''}
          onChange={e => setFiltros({ sede: e.target.value ? [e.target.value] : [] })}>
          <option value="">Todas</option>
          {opciones.sedes.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Especialidad</label>
        <select className="filter-select max-w-[170px]" value={filtros.especialidad[0] ?? ''}
          onChange={e => setFiltros({ especialidad: e.target.value ? [e.target.value] : [] })}>
          <option value="">Todas</option>
          {opciones.especialidades.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Sexo</label>
        <select className="filter-select" value={filtros.sexo[0] ?? ''}
          onChange={e => setFiltros({ sexo: e.target.value ? [e.target.value] : [] })}>
          <option value="">Todos</option>
          {opciones.sexos.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Estado</label>
        <select className="filter-select" value={filtros.estado[0] ?? ''}
          onChange={e => setFiltros({ estado: e.target.value ? [e.target.value] : [] })}>
          <option value="">Todos</option>
          <option value="Activo">Activo</option>
          <option value="Egresado">Egresado</option>
          <option value="Fallecido">Fallecido</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Larga estancia</label>
        <select className="filter-select" value={filtros.largaEstancia ?? ''}
          onChange={e => setFiltros({ largaEstancia: e.target.value || null })}>
          <option value="">Todos</option>
          <option value="Si">Sí (&gt;20 días)</option>
          <option value="No">No</option>
        </select>
      </div>

      {hayFiltros ? (
        <button onClick={resetFiltros}
          className="btn-secondary text-xs flex items-center gap-1.5 ml-auto">
          <RotateCcw className="w-3.5 h-3.5" /> Limpiar
        </button>
      ) : null}
    </div>
  )
}
